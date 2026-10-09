import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronRight, FilePlus2, FolderPlus, Folder, FolderOpen, FileText, Pencil, Trash2, CopyPlus, Pin, PinOff, Search, ArrowLeft, MoreHorizontal, NotebookPen,
} from 'lucide-react';
import { useNotes, type Note, type NoteFolder } from '../../store/notes';
import { askText, confirmAction, toast } from '../../store/ui';
import { ContextMenu, type MenuItem } from '../../components/Overlays';
import { cx, normalize, relativeTime, stripHtml } from '../../lib/utils';
import NoteEditor from './NoteEditor';

const DRAG_NOTE = 'application/x-cop-note';
const DRAG_FOLDER = 'application/x-cop-note-folder';

export default function NotesPage() {
  const [params, setParams] = useSearchParams();
  const { notes, folders } = useNotes();
  const store = useNotes.getState();
  const noteId = params.get('note');
  const folderParam = params.get('dossier');
  const active = notes.find(n => n.id === noteId);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(folders.map(f => f.id)));
  const [focusFolder, setFocusFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);

  const openNote = (id: string | null) => setParams(id ? { note: id } : {});

  // Links like /notes?dossier=… (from Copilot or search) reveal that folder.
  useEffect(() => {
    if (!folderParam) return;
    setFocusFolder(folderParam);
    setExpanded(s => new Set([...s, folderParam]));
  }, [folderParam]);

  // Reveal the folder of the opened note.
  useEffect(() => {
    if (active?.folderId) setExpanded(s => (s.has(active.folderId!) ? s : new Set([...s, active.folderId!])));
  }, [active?.folderId]);

  // Dashboard "+ Note" shortcut (guarded: StrictMode runs effects twice in dev).
  const handledNew = useRef(false);
  useEffect(() => {
    if (params.get('nouvelle') && !handledNew.current) {
      handledNew.current = true;
      const n = useNotes.getState().createNote();
      setParams({ note: n.id });
    }
  }, [params, setParams]);

  const targetFolder = focusFolder ?? active?.folderId ?? null;

  const newNote = (folderId: string | null = targetFolder) => {
    const n = store.createNote({ folderId });
    if (folderId) setExpanded(s => new Set([...s, folderId]));
    openNote(n.id);
    setTimeout(() => document.getElementById('note-title')?.focus(), 50);
  };

  const newFolder = async (parentId: string | null = targetFolder) => {
    const name = await askText(parentId ? 'Nouveau sous-dossier' : 'Nouveau dossier', 'Nouveau dossier', 'Créer');
    if (name === null) return;
    const f = store.createFolder(name, parentId);
    setExpanded(s => new Set([...s, f.id, ...(parentId ? [parentId] : [])]));
    setFocusFolder(f.id);
  };

  const renameFolder = async (f: NoteFolder) => {
    const name = await askText('Renommer le dossier', f.name, 'Renommer');
    if (name) store.renameFolder(f.id, name);
  };

  const renameNote = async (n: Note) => {
    const name = await askText('Renommer la note', n.title, 'Renommer');
    if (name) store.updateNote(n.id, { title: name });
  };

  const deleteFolder = async (f: NoteFolder) => {
    const count = notes.filter(n => n.folderId === f.id).length;
    if (!(await confirmAction(`Supprimer le dossier « ${f.name} » ?`, count ? `Ses ${count} note(s) et sous-dossiers seront aussi supprimés.` : undefined))) return;
    if (active?.folderId === f.id) openNote(null);
    store.removeFolder(f.id);
    toast('Dossier supprimé', 'success');
  };

  const deleteNote = async (n: Note) => {
    if (!(await confirmAction(`Supprimer « ${n.title} » ?`, 'Cette action est définitive.'))) return;
    if (n.id === noteId) openNote(null);
    store.removeNote(n.id);
    toast('Note supprimée', 'success');
  };

  const noteMenu = (n: Note): MenuItem[] => [
    { label: 'Ouvrir', icon: <FileText size={15} />, onClick: () => openNote(n.id) },
    { label: 'Renommer', icon: <Pencil size={15} />, onClick: () => void renameNote(n) },
    { label: 'Dupliquer', icon: <CopyPlus size={15} />, onClick: () => { const c = store.duplicateNote(n.id); if (c) openNote(c.id); } },
    { label: n.pinned ? 'Désépingler' : 'Épingler en haut', icon: n.pinned ? <PinOff size={15} /> : <Pin size={15} />, onClick: () => store.updateNote(n.id, { pinned: !n.pinned }) },
    ...(n.folderId ? [{ label: 'Sortir du dossier', icon: <FolderOpen size={15} />, onClick: () => store.updateNote(n.id, { folderId: null }) }] : []),
    { label: '', divider: true, onClick: () => {} },
    { label: 'Supprimer', icon: <Trash2 size={15} />, danger: true, onClick: () => void deleteNote(n) },
  ];

  const folderMenu = (f: NoteFolder): MenuItem[] => [
    { label: 'Nouvelle note ici', icon: <FilePlus2 size={15} />, onClick: () => newNote(f.id) },
    { label: 'Nouveau sous-dossier', icon: <FolderPlus size={15} />, onClick: () => void newFolder(f.id) },
    { label: 'Renommer', icon: <Pencil size={15} />, onClick: () => void renameFolder(f) },
    ...(f.parentId ? [{ label: 'Remonter à la racine', icon: <FolderOpen size={15} />, onClick: () => store.moveFolder(f.id, null) }] : []),
    { label: '', divider: true, onClick: () => {} },
    { label: 'Supprimer', icon: <Trash2 size={15} />, danger: true, onClick: () => void deleteFolder(f) },
  ];

  const sortNotes = (list: Note[]) => [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  // ── Drag & drop (notes and folders into folders) ─────────────────────────
  const dropProps = (folderId: string | null, key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_NOTE) && !e.dataTransfer.types.includes(DRAG_FOLDER)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropOn(key);
    },
    onDragLeave: () => setDropOn(d => (d === key ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropOn(null);
      const nid = e.dataTransfer.getData(DRAG_NOTE);
      const fid = e.dataTransfer.getData(DRAG_FOLDER);
      if (nid) store.updateNote(nid, { folderId });
      if (fid && fid !== folderId) store.moveFolder(fid, folderId);
      if (folderId) setExpanded(s => new Set([...s, folderId]));
    },
  });

  const q = normalize(query);
  const results = useMemo(
    () => (q ? sortNotes(notes.filter(n => normalize(n.title).includes(q) || normalize(stripHtml(n.content)).includes(q))) : []),
    [q, notes],
  );

  const renderNote = (n: Note, depth: number) => (
    <div
      key={n.id}
      draggable
      onDragStart={e => e.dataTransfer.setData(DRAG_NOTE, n.id)}
      onClick={() => { openNote(n.id); setFocusFolder(null); }}
      onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: noteMenu(n) }); }}
      className={cx(
        'group flex h-8 cursor-pointer items-center gap-2 rounded-md pr-1 text-[13px] transition-colors',
        n.id === noteId ? 'bg-stone-100 font-medium text-ink' : 'text-stone-600 hover:bg-stone-50 hover:text-ink',
      )}
      style={{ paddingLeft: 10 + depth * 16 }}
    >
      <FileText size={14} className="shrink-0 text-stone-400" />
      <span className="flex-1 truncate">{n.title}</span>
      {n.pinned && <Pin size={11} className="shrink-0 text-stone-400" />}
      <button
        className="rounded p-0.5 text-stone-400 opacity-0 hover:text-ink group-hover:opacity-100"
        onClick={e => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, items: noteMenu(n) }); }}
      >
        <MoreHorizontal size={14} />
      </button>
    </div>
  );

  const renderFolder = (f: NoteFolder, depth: number): React.ReactNode => {
    const open = expanded.has(f.id);
    const kids = folders.filter(x => x.parentId === f.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const fnotes = sortNotes(notes.filter(n => n.folderId === f.id));
    return (
      <div key={f.id}>
        <div
          draggable
          onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData(DRAG_FOLDER, f.id); }}
          {...dropProps(f.id, f.id)}
          onClick={() => {
            setFocusFolder(f.id);
            setExpanded(s => {
              const n = new Set(s);
              if (n.has(f.id)) n.delete(f.id);
              else n.add(f.id);
              return n;
            });
          }}
          onDoubleClick={() => void renameFolder(f)}
          onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: folderMenu(f) }); }}
          className={cx(
            'group flex h-8 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-[13px] font-medium transition-colors',
            dropOn === f.id ? 'bg-brand-50 ring-1 ring-brand-500' : focusFolder === f.id ? 'bg-stone-100 text-ink' : 'text-stone-700 hover:bg-stone-50',
          )}
          style={{ paddingLeft: 4 + depth * 16 }}
        >
          <ChevronRight size={13} className={cx('shrink-0 text-stone-400 transition-transform', open && 'rotate-90')} />
          {open ? <FolderOpen size={15} className="shrink-0 text-stone-500" /> : <Folder size={15} className="shrink-0 text-stone-500" />}
          <span className="flex-1 truncate">{f.name}</span>
          <span className="tabular text-[11px] font-normal text-stone-400 group-hover:hidden">{fnotes.length || ''}</span>
          <button
            className="hidden rounded p-0.5 text-stone-400 hover:text-ink group-hover:block"
            title="Nouvelle note dans ce dossier"
            onClick={e => { e.stopPropagation(); newNote(f.id); }}
          >
            <FilePlus2 size={14} />
          </button>
          <button
            className="hidden rounded p-0.5 text-stone-400 hover:text-ink group-hover:block"
            onClick={e => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, items: folderMenu(f) }); }}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
        {open && (
          <div>
            {kids.map(k => renderFolder(k, depth + 1))}
            {fnotes.map(n => renderNote(n, depth + 1))}
            {kids.length === 0 && fnotes.length === 0 && (
              <p className="py-1.5 text-[12px] text-stone-400" style={{ paddingLeft: 30 + depth * 16 }}>
                Dossier vide
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = folders.filter(f => f.parentId === null).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const rootNotes = sortNotes(notes.filter(n => n.folderId === null));

  return (
    <div className="flex h-full gap-4 px-4 pb-4 md:px-8">
      {/* Sidebar */}
      <aside className={cx('w-full shrink-0 flex-col md:flex md:w-[268px]', active ? 'hidden' : 'flex')}>
        <div className="flex items-center gap-1.5 pb-4 pt-2">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Notes</h1>
          <button className="icon-btn ml-auto" title="Nouveau dossier" onClick={() => void newFolder(null)}>
            <FolderPlus size={16} />
          </button>
          <button className="btn-primary h-8 px-3" onClick={() => newNote()} title="Nouvelle note">
            <FilePlus2 size={14} /> Nouvelle note
          </button>
        </div>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher dans les notes" className="field w-full pl-8" />
        </div>
        <div
          className={cx('min-h-0 flex-1 overflow-y-auto rounded-lg p-1', dropOn === 'root' && 'ring-1 ring-brand-500')}
          {...dropProps(null, 'root')}
          onClick={() => setFocusFolder(null)}
        >
          {q ? (
            results.length ? (
              results.map(n => (
                <button key={n.id} onClick={() => openNote(n.id)} className={cx('block w-full rounded-md px-2.5 py-2 text-left hover:bg-stone-50', n.id === noteId && 'bg-stone-100')}>
                  <p className="truncate text-[13px] font-medium">{n.title}</p>
                  <p className="truncate text-[12px] text-stone-500">{stripHtml(n.content) || 'Note vide'}</p>
                </button>
              ))
            ) : (
              <p className="p-4 text-center text-[13px] text-stone-400">Aucune note trouvée</p>
            )
          ) : (
            <div onClick={e => e.stopPropagation()}>
              {rootFolders.map(f => renderFolder(f, 0))}
              {rootNotes.length > 0 && rootFolders.length > 0 && <div className="mx-2 my-2 h-px bg-stone-200/70" />}
              {rootNotes.map(n => renderNote(n, 0))}
              {notes.length === 0 && folders.length === 0 && <p className="p-6 text-center text-[13px] text-stone-400">Aucune note pour l'instant.</p>}
            </div>
          )}
        </div>
        <p className="hidden pt-2 text-[11px] text-stone-400 md:block">Glisse une note sur un dossier pour la ranger.</p>
      </aside>

      {/* Editor */}
      <section className={cx('card min-w-0 flex-1 flex-col overflow-hidden md:mt-2', active ? 'flex' : 'hidden md:flex')}>
        {active ? (
          <>
            <div className="flex items-start gap-1 px-4 pt-6 md:px-12">
              <button className="icon-btn mt-1 md:hidden" onClick={() => openNote(null)} title="Retour">
                <ArrowLeft size={17} />
              </button>
              <div className="min-w-0 flex-1">
                <input
                  id="note-title"
                  key={active.id}
                  defaultValue={active.title === 'Sans titre' ? '' : active.title}
                  placeholder="Sans titre"
                  onChange={e => store.updateNote(active.id, { title: e.target.value.trim() || 'Sans titre' })}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), document.querySelector<HTMLElement>('.prose-note')?.focus())}
                  className="w-full bg-transparent text-[26px] font-semibold tracking-[-0.02em] outline-none placeholder:text-stone-300"
                />
                <p className="mt-1 text-[12px] text-stone-400">
                  {folders.find(f => f.id === active.folderId)?.name ?? 'Sans dossier'} · modifiée {relativeTime(active.updatedAt)}
                </p>
              </div>
              <button className="icon-btn mt-1" title={active.pinned ? 'Désépingler' : 'Épingler'} onClick={() => store.updateNote(active.id, { pinned: !active.pinned })}>
                {active.pinned ? <PinOff size={15} /> : <Pin size={15} />}
              </button>
              <button className="icon-btn mt-1" title="Plus" onClick={e => setMenu({ x: e.clientX - 180, y: e.clientY + 10, items: noteMenu(active) })}>
                <MoreHorizontal size={16} />
              </button>
            </div>
            <NoteEditor key={active.id} note={active} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <NotebookPen size={28} strokeWidth={1.5} className="text-stone-300" />
            <p className="mt-3 text-[14px] font-medium">Aucune note ouverte</p>
            <p className="mt-1 text-[13px] text-stone-500">Choisis une note à gauche ou crée-en une.</p>
            <button className="btn-secondary mt-4" onClick={() => newNote()}>
              <FilePlus2 size={15} /> Nouvelle note
            </button>
          </div>
        )}
      </section>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

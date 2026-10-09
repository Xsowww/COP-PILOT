import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronRight, ClipboardPaste, Copy, CopyPlus, Download, Eye, FolderInput, FolderPlus, FolderUp, HardDrive, LayoutGrid,
  List, Pencil, Scissors, Star, Trash2, Upload, Clock, ArrowUpDown, X, MousePointer2,
} from 'lucide-react';
import { useDrive, childrenOf, pathOf, categoryOf, folderSize, type DriveItem } from '../../store/drive';
import { askText, confirmAction, toast, useUi } from '../../store/ui';
import { formatBytes, relativeTime, cx } from '../../lib/utils';
import FileIcon from '../../components/FileIcon';
import { ContextMenu, type MenuItem } from '../../components/Overlays';
import PreviewModal from './PreviewModal';
import { downloadItem } from './download';
import MoveDialog from './MoveDialog';
import { filesFromDrop, filesFromInput, uploadPending } from './upload';

type Tab = 'all' | 'starred' | 'recent';
type SortKey = 'name' | 'date' | 'size';

const DRAG_MIME = 'application/x-cop-drive';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

export default function DrivePage() {
  const [params, setParams] = useSearchParams();
  const folderId = params.get('dossier');
  const previewId = params.get('fichier');
  const drive = useDrive();
  const { items, clipboard } = drive;

  const [tab, setTab] = useState<Tab>('all');
  const [view, setView] = useState<'grid' | 'list'>(() => readPref('cop:drive-view', 'grid'));
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; target: string | null } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | 'here' | null>(null);
  const [moveIds, setMoveIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const current = folderId ? items.find(i => i.id === folderId && i.kind === 'folder') : undefined;
  const parentId = current?.id ?? null;
  const breadcrumb = pathOf(items, parentId);
  const previewItem = previewId ? items.find(i => i.id === previewId && i.kind === 'file') : undefined;

  const visible = useMemo(() => {
    let list: DriveItem[];
    if (tab === 'starred') list = items.filter(i => i.starred);
    else if (tab === 'recent') list = items.filter(i => i.kind === 'file').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40);
    else list = childrenOf(items, parentId);
    if (tab === 'recent') return list;
    const dir = sort.asc ? 1 : -1;
    const size = (i: DriveItem) => (i.kind === 'folder' ? folderSize(items, i.id) : (i.size ?? 0));
    return [...list].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      if (sort.key === 'date') return dir * a.updatedAt.localeCompare(b.updatedAt);
      if (sort.key === 'size') return dir * (size(a) - size(b));
      return dir * a.name.localeCompare(b.name, 'fr', { numeric: true });
    });
  }, [items, parentId, tab, sort]);

  const selectedIds = useMemo(() => [...selected].filter(id => items.some(i => i.id === id)), [selected, items]);
  const single = selectedIds.length === 1 ? items.find(i => i.id === selectedIds[0]) : undefined;

  // ── Navigation ────────────────────────────────────────────────────────────
  const openFolder = useCallback(
    (id: string | null) => {
      setTab('all');
      setSelected(new Set());
      setParams(id ? { dossier: id } : {});
    },
    [setParams],
  );

  const openItem = useCallback(
    (item: DriveItem) => {
      if (item.kind === 'folder') openFolder(item.id);
      else setParams(p => {
        const n = new URLSearchParams(p);
        n.set('fichier', item.id);
        return n;
      });
    },
    [openFolder, setParams],
  );

  const closePreview = useCallback(
    () =>
      setParams(p => {
        const n = new URLSearchParams(p);
        n.delete('fichier');
        return n;
      }),
    [setParams],
  );

  // Select the file targeted by a link (e.g. from search or Copilot).
  useEffect(() => {
    if (previewId) setSelected(new Set([previewId]));
  }, [previewId]);

  // "Importer" shortcut from the dashboard.
  const handledImport = useRef(false);
  useEffect(() => {
    if (params.get('import') && !handledImport.current) {
      handledImport.current = true;
      fileInput.current?.click();
      setParams(p => {
        const n = new URLSearchParams(p);
        n.delete('import');
        return n;
      });
    }
  }, [params, setParams]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const doUpload = useCallback(
    async (pending: Awaited<ReturnType<typeof filesFromDrop>>, target: string | null) => {
      if (!pending.length) return;
      setBusy(true);
      try {
        const n = await uploadPending(pending, target);
        toast(n ? `${n} fichier${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}` : 'Dossier importé', 'success');
      } catch {
        toast("L'import a échoué (espace de stockage du navigateur plein ?)", 'error');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const newFolder = useCallback(async () => {
    const name = await askText('Nouveau dossier', 'Nouveau dossier', 'Créer');
    if (name === null) return;
    const f = useDrive.getState().createFolder(name, parentId);
    setTab('all');
    setSelected(new Set([f.id]));
  }, [parentId]);

  const rename = useCallback(async (item: DriveItem) => {
    const name = await askText(item.kind === 'folder' ? 'Renommer le dossier' : 'Renommer le fichier', item.name, 'Renommer');
    if (name !== null && name.trim() && name !== item.name) useDrive.getState().rename(item.id, name);
  }, []);

  const remove = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const all = useDrive.getState().items;
    const first = all.find(i => i.id === ids[0]);
    const ok = await confirmAction(
      ids.length === 1 ? `Supprimer « ${first?.name} » ?` : `Supprimer ${ids.length} éléments ?`,
      ids.some(id => all.find(i => i.id === id)?.kind === 'folder') ? 'Le contenu des dossiers sera aussi supprimé. Cette action est définitive.' : 'Cette action est définitive.',
    );
    if (!ok) return;
    useDrive.getState().remove(ids);
    setSelected(new Set());
    toast(ids.length > 1 ? `${ids.length} éléments supprimés` : 'Élément supprimé', 'success');
  }, []);

  const copy = useCallback((ids: string[]) => {
    if (!ids.length) return;
    useDrive.getState().copy(ids);
    toast(`${ids.length} élément${ids.length > 1 ? 's' : ''} copié${ids.length > 1 ? 's' : ''}`);
  }, []);

  const cut = useCallback((ids: string[]) => {
    if (!ids.length) return;
    useDrive.getState().cut(ids);
    toast(`${ids.length} élément${ids.length > 1 ? 's' : ''} coupé${ids.length > 1 ? 's' : ''}`);
  }, []);

  const paste = useCallback(
    async (target: string | null) => {
      const clip = useDrive.getState().clipboard;
      if (!clip?.ids.length) return;
      if (clip.mode === 'cut' && target && useDrive.getState().items.some(i => i.id === target) && clip.ids.includes(target)) {
        return toast('Impossible de déplacer un dossier dans lui-même', 'error');
      }
      const before = useDrive.getState().items.length;
      await useDrive.getState().paste(target);
      if (clip.mode === 'copy' && useDrive.getState().items.length === before) return;
      toast(clip.mode === 'cut' ? 'Éléments déplacés' : 'Éléments collés', 'success');
    },
    [],
  );

  const duplicate = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    await useDrive.getState().duplicate(ids);
    toast('Copie créée', 'success');
  }, []);

  const moveTo = useCallback((ids: string[], target: string | null) => {
    const moved = useDrive.getState().move(ids, target);
    if (moved) toast(`${moved} élément${moved > 1 ? 's' : ''} déplacé${moved > 1 ? 's' : ''}`, 'success');
    else if (target && ids.includes(target)) toast('Impossible de déplacer un dossier dans lui-même', 'error');
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────
  const onItemClick = (e: React.MouseEvent, item: DriveItem) => {
    e.stopPropagation();
    if (e.shiftKey && anchor) {
      const a = visible.findIndex(i => i.id === anchor);
      const b = visible.findIndex(i => i.id === item.id);
      const [from, to] = a < b ? [a, b] : [b, a];
      setSelected(new Set(visible.slice(from, to + 1).map(i => i.id)));
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      setSelected(s => {
        const n = new Set(s);
        if (n.has(item.id)) n.delete(item.id);
        else n.add(item.id);
        return n;
      });
    } else {
      setSelected(new Set([item.id]));
    }
    setAnchor(item.id);
  };

  const onItemContext = (e: React.MouseEvent, item: DriveItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected.has(item.id)) setSelected(new Set([item.id]));
    setMenu({ x: e.clientX, y: e.clientY, target: item.id });
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, [contenteditable="true"]') || previewItem || moveIds || useUi.getState().dialog) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'a') {
        e.preventDefault();
        setSelected(new Set(visible.map(i => i.id)));
      } else if (mod && k === 'c') copy(selectedIds);
      else if (mod && k === 'x') cut(selectedIds);
      else if (mod && k === 'v' && tab === 'all') void paste(parentId);
      else if (mod && k === 'd') {
        e.preventDefault();
        void duplicate(selectedIds);
      } else if (e.key === 'Delete' || (e.key === 'Backspace' && (isMac || mod))) {
        e.preventDefault();
        void remove(selectedIds);
      } else if (e.key === 'F2' && single) {
        e.preventDefault();
        void rename(single);
      } else if (e.key === 'Enter' && single) openItem(single);
      else if (e.key === 'Escape') setSelected(new Set());
      else if (e.key === 'Backspace' && !mod && current) openFolder(current.parentId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, selectedIds, single, parentId, tab, current, previewItem, moveIds, copy, cut, paste, duplicate, remove, rename, openItem, openFolder]);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, item: DriveItem) => {
    const ids = selected.has(item.id) ? selectedIds : [item.id];
    if (!selected.has(item.id)) setSelected(new Set([item.id]));
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const isInternal = (e: React.DragEvent) => e.dataTransfer.types.includes(DRAG_MIME);
  const isExternal = (e: React.DragEvent) => e.dataTransfer.types.includes('Files') && !isInternal(e);

  const dropOn = async (e: React.DragEvent, target: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDropTarget(null);
    if (isInternal(e)) {
      const ids: string[] = JSON.parse(e.dataTransfer.getData(DRAG_MIME) || '[]');
      if (e.altKey) {
        // Alt + drop = copy instead of move
        useDrive.getState().copy(ids);
        await useDrive.getState().paste(target);
        toast('Éléments copiés', 'success');
      } else moveTo(ids, target);
    } else if (e.dataTransfer.types.includes('Files')) {
      await doUpload(await filesFromDrop(e.dataTransfer), target);
    }
  };

  const folderDropProps = (target: string | null, key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!isInternal(e) && !isExternal(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = isInternal(e) ? (e.altKey ? 'copy' : 'move') : 'copy';
      if (dropTarget !== key) setDropTarget(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.stopPropagation();
      if (dropTarget === key) setDropTarget(tabAll ? 'here' : null);
    },
    onDrop: (e: React.DragEvent) => void dropOn(e, target),
  });

  const tabAll = tab === 'all';

  // ── Context menu definitions ──────────────────────────────────────────────
  const menuItems: MenuItem[] = useMemo(() => {
    if (!menu) return [];
    if (menu.target === null) {
      return [
        { label: 'Nouveau dossier', icon: <FolderPlus size={15} />, onClick: () => void newFolder() },
        { label: 'Importer des fichiers', icon: <Upload size={15} />, onClick: () => fileInput.current?.click() },
        { label: 'Importer un dossier', icon: <FolderUp size={15} />, onClick: () => folderInput.current?.click() },
        { label: '', divider: true, onClick: () => {} },
        { label: 'Coller', icon: <ClipboardPaste size={15} />, shortcut: `${MOD}V`, disabled: !clipboard?.ids.length || !tabAll, onClick: () => void paste(parentId) },
        { label: 'Tout sélectionner', icon: <MousePointer2 size={15} />, shortcut: `${MOD}A`, onClick: () => setSelected(new Set(visible.map(i => i.id))) },
      ];
    }
    const ids = selectedIds.length ? selectedIds : [menu.target];
    const item = items.find(i => i.id === menu.target);
    const one = ids.length === 1 && item;
    return [
      ...(one ? [{ label: item.kind === 'folder' ? 'Ouvrir' : 'Aperçu', icon: <Eye size={15} />, shortcut: 'Entrée', onClick: () => openItem(item) }] : []),
      ...(one && item.kind === 'file' ? [{ label: 'Télécharger', icon: <Download size={15} />, onClick: () => downloadItem(item) }] : []),
      { label: '', divider: true, onClick: () => {} },
      { label: 'Copier', icon: <Copy size={15} />, shortcut: `${MOD}C`, onClick: () => copy(ids) },
      { label: 'Couper', icon: <Scissors size={15} />, shortcut: `${MOD}X`, onClick: () => cut(ids) },
      ...(one && item.kind === 'folder' ? [{ label: 'Coller dans ce dossier', icon: <ClipboardPaste size={15} />, disabled: !clipboard?.ids.length, onClick: () => void paste(item.id) }] : []),
      { label: 'Dupliquer', icon: <CopyPlus size={15} />, shortcut: `${MOD}D`, onClick: () => void duplicate(ids) },
      { label: 'Déplacer vers…', icon: <FolderInput size={15} />, onClick: () => setMoveIds(ids) },
      ...(one ? [{ label: 'Renommer', icon: <Pencil size={15} />, shortcut: 'F2', onClick: () => void rename(item) }] : []),
      ...(one ? [{ label: item.starred ? 'Retirer des favoris' : 'Ajouter aux favoris', icon: <Star size={15} />, onClick: () => useDrive.getState().toggleStar(item.id) }] : []),
      { label: '', divider: true, onClick: () => {} },
      { label: 'Supprimer', icon: <Trash2 size={15} />, shortcut: 'Suppr', danger: true, onClick: () => void remove(ids) },
    ];
  }, [menu, selectedIds, items, clipboard, tabAll, parentId, visible, newFolder, paste, openItem, copy, cut, duplicate, rename, remove]);

  const cutIds = clipboard?.mode === 'cut' ? new Set(clipboard.ids) : new Set<string>();

  const itemProps = (item: DriveItem) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => onDragStart(e, item),
    onClick: (e: React.MouseEvent) => onItemClick(e, item),
    onDoubleClick: () => openItem(item),
    onContextMenu: (e: React.MouseEvent) => onItemContext(e, item),
    ...(item.kind === 'folder' ? folderDropProps(item.id, item.id) : {}),
  });

  const sortBtn = (key: SortKey, label: string) => (
    <button
      className={cx('flex items-center gap-1 hover:text-slate-700', sort.key === key && 'text-slate-700')}
      onClick={() => setSort(s => ({ key, asc: s.key === key ? !s.asc : true }))}
    >
      {label} {sort.key === key && <ArrowUpDown size={11} />}
    </button>
  );

  return (
    <div
      className="flex h-full flex-col px-4 pb-4 pt-2 md:px-8"
      onDragEnter={e => {
        if (!tabAll || (!isExternal(e) && !isInternal(e))) return;
        dragDepth.current++;
        if (isExternal(e)) setDropTarget(t => t ?? 'here');
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDropTarget(null);
      }}
      onDragOver={e => {
        if (tabAll && isExternal(e)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={e => (tabAll ? void dropOn(e, parentId) : e.preventDefault())}
    >
      <input ref={fileInput} type="file" multiple hidden onChange={e => { if (e.target.files) void doUpload(filesFromInput(e.target.files), parentId); e.target.value = ''; }} />
      <input
        ref={folderInput}
        type="file"
        hidden
        // @ts-expect-error non-standard but widely supported folder picker
        webkitdirectory=""
        onChange={e => { if (e.target.files) void doUpload(filesFromInput(e.target.files), parentId); e.target.value = ''; }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 py-2">
        <h1 className="mr-2 text-2xl font-bold tracking-tight">Drive</h1>
        <div className="flex rounded-xl bg-white/60 p-1 text-sm">
          {([
            ['all', 'Mon Drive', HardDrive],
            ['starred', 'Favoris', Star],
            ['recent', 'Récents', Clock],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => { setTab(k); setSelected(new Set()); }}
              className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition', tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-soft" onClick={() => void newFolder()}>
            <FolderPlus size={16} /> <span className="hidden sm:inline">Dossier</span>
          </button>
          <button className="btn-primary" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload size={16} /> <span className="hidden sm:inline">{busy ? 'Import…' : 'Importer'}</span>
          </button>
          <button className="icon-btn h-9 w-9" title="Importer un dossier" onClick={() => folderInput.current?.click()}>
            <FolderUp size={17} />
          </button>
          <button
            className="icon-btn h-9 w-9"
            title={view === 'grid' ? 'Affichage liste' : 'Affichage grille'}
            onClick={() => setView(v => {
              const n = v === 'grid' ? 'list' : 'grid';
              try { localStorage.setItem('cop:drive-view', n); } catch { /* ignore */ }
              return n;
            })}
          >
            {view === 'grid' ? <List size={17} /> : <LayoutGrid size={17} />}
          </button>
        </div>
      </div>

      {/* Breadcrumb / selection bar */}
      <div className="flex min-h-11 items-center gap-1 rounded-2xl px-1 text-sm">
        {selectedIds.length > 1 || (selectedIds.length === 1 && !previewItem) ? (
          <div className="fade-up flex w-full flex-wrap items-center gap-1 rounded-2xl bg-indigo-600 px-2 py-1 text-white shadow-lg shadow-indigo-600/20">
            <button className="rounded-lg p-1.5 hover:bg-white/15" onClick={() => setSelected(new Set())} title="Désélectionner (Échap)">
              <X size={15} />
            </button>
            <span className="mr-2 font-medium">{selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}</span>
            {[
              { icon: Copy, label: 'Copier', fn: () => copy(selectedIds) },
              { icon: Scissors, label: 'Couper', fn: () => cut(selectedIds) },
              { icon: CopyPlus, label: 'Dupliquer', fn: () => void duplicate(selectedIds) },
              { icon: FolderInput, label: 'Déplacer', fn: () => setMoveIds(selectedIds) },
              ...(single ? [{ icon: Pencil, label: 'Renommer', fn: () => void rename(single) }] : []),
              ...(single?.kind === 'file' ? [{ icon: Download, label: 'Télécharger', fn: () => downloadItem(single) }] : []),
              { icon: Trash2, label: 'Supprimer', fn: () => void remove(selectedIds) },
            ].map(a => (
              <button key={a.label} onClick={a.fn} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/15" title={a.label}>
                <a.icon size={15} /> <span className="hidden lg:inline">{a.label}</span>
              </button>
            ))}
          </div>
        ) : tabAll ? (
          <>
            <button
              onClick={() => openFolder(null)}
              {...folderDropProps(null, 'crumb-root')}
              className={cx('rounded-lg px-2 py-1 font-medium text-slate-500 hover:bg-white/70 hover:text-slate-900', dropTarget === 'crumb-root' && 'bg-indigo-100 text-indigo-700')}
            >
              Mon Drive
            </button>
            {breadcrumb.map(b => (
              <span key={b.id} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-slate-300" />
                <button
                  onClick={() => openFolder(b.id)}
                  {...folderDropProps(b.id, `crumb-${b.id}`)}
                  className={cx(
                    'max-w-48 truncate rounded-lg px-2 py-1 font-medium hover:bg-white/70',
                    b.id === parentId ? 'text-slate-900' : 'text-slate-500',
                    dropTarget === `crumb-${b.id}` && 'bg-indigo-100 text-indigo-700',
                  )}
                >
                  {b.name}
                </button>
              </span>
            ))}
            {clipboard?.ids.length ? (
              <button className="btn-ghost ml-auto py-1 text-xs" onClick={() => void paste(parentId)}>
                <ClipboardPaste size={14} /> Coller ici ({clipboard.ids.length})
              </button>
            ) : null}
          </>
        ) : (
          <p className="px-2 font-medium text-slate-500">{tab === 'starred' ? 'Tes éléments favoris' : 'Fichiers modifiés récemment'}</p>
        )}
      </div>

      {/* Content */}
      <div
        className={cx(
          'relative mt-2 min-h-0 flex-1 overflow-y-auto rounded-[28px] border-2 border-transparent p-2 transition',
          dropTarget === 'here' && 'border-dashed border-indigo-400 bg-indigo-50/60',
        )}
        onClick={() => setSelected(new Set())}
        onContextMenu={e => {
          e.preventDefault();
          setSelected(new Set());
          setMenu({ x: e.clientX, y: e.clientY, target: null });
        }}
      >
        {visible.length === 0 ? (
          <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/80 shadow-sm">
              {tab === 'starred' ? <Star size={34} className="text-amber-400" /> : <Upload size={34} className="text-indigo-400" />}
            </div>
            <p className="font-semibold text-slate-700">{tab === 'starred' ? 'Aucun favori' : tab === 'recent' ? 'Aucun fichier récent' : 'Ce dossier est vide'}</p>
            <p className="mt-1 max-w-xs text-sm text-slate-400">
              {tab === 'all' ? 'Glisse-dépose des fichiers ou des dossiers ici, ou utilise le bouton Importer.' : 'Clic droit sur un élément › Ajouter aux favoris.'}
            </p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
            {visible.map(item => {
              const sel = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  {...itemProps(item)}
                  className={cx(
                    'group relative flex cursor-default select-none flex-col items-center rounded-3xl p-3 pt-4 text-center transition',
                    sel ? 'bg-indigo-100/80 ring-2 ring-indigo-400' : 'hover:bg-white/70',
                    dropTarget === item.id && 'scale-105 bg-indigo-100 ring-2 ring-indigo-500',
                    cutIds.has(item.id) && 'opacity-45',
                  )}
                  title={item.name}
                >
                  {item.starred && <Star size={12} className="absolute right-3 top-3 fill-amber-400 text-amber-400" />}
                  <FileIcon category={categoryOf(item)} size={64} />
                  <p className="mt-2 line-clamp-2 w-full break-words text-[13px] font-medium leading-tight text-slate-800">{item.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {item.kind === 'folder' ? `${items.filter(i => i.parentId === item.id).length} élément(s)` : formatBytes(item.size)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white/50">
            <div className="grid grid-cols-[1fr_120px_90px] gap-3 border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-400 md:grid-cols-[1fr_180px_140px_100px]">
              {sortBtn('name', 'Nom')}
              <span className="hidden md:block">Emplacement</span>
              {sortBtn('date', 'Modifié')}
              {sortBtn('size', 'Taille')}
            </div>
            {visible.map(item => {
              const sel = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  {...itemProps(item)}
                  className={cx(
                    'grid cursor-default select-none grid-cols-[1fr_120px_90px] items-center gap-3 border-b border-slate-50 px-4 py-2 text-sm transition last:border-0 md:grid-cols-[1fr_180px_140px_100px]',
                    sel ? 'bg-indigo-100/80' : 'hover:bg-white/80',
                    dropTarget === item.id && 'bg-indigo-100 ring-2 ring-inset ring-indigo-400',
                    cutIds.has(item.id) && 'opacity-45',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <FileIcon category={categoryOf(item)} size={30} />
                    <span className="truncate font-medium text-slate-800">{item.name}</span>
                    {item.starred && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />}
                  </span>
                  <span className="hidden truncate text-xs text-slate-400 md:block">{['Drive', ...pathOf(items, item.parentId).map(p => p.name)].join(' › ')}</span>
                  <span className="text-xs text-slate-500">{relativeTime(item.updatedAt)}</span>
                  <span className="text-xs text-slate-500">{item.kind === 'folder' ? formatBytes(folderSize(items, item.id)) : formatBytes(item.size)}</span>
                </div>
              );
            })}
          </div>
        )}

        {dropTarget === 'here' && (
          <div className="pointer-events-none sticky bottom-4 mx-auto mt-4 w-fit rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
            Dépose pour importer dans « {current?.name ?? 'Mon Drive'} »
          </div>
        )}
      </div>

      <p className="hidden pt-2 text-center text-[11px] text-slate-400 lg:block">
        Double-clic pour ouvrir · Clic droit pour plus d'options · {MOD}C / {MOD}X / {MOD}V · {MOD}D dupliquer · F2 renommer · Suppr · Alt + glisser pour copier
      </p>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
      {previewItem && <PreviewModal item={previewItem} onClose={closePreview} />}
      {moveIds && (
        <MoveDialog
          ids={moveIds}
          onClose={() => setMoveIds(null)}
          onMove={target => {
            moveTo(moveIds, target);
            setMoveIds(null);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

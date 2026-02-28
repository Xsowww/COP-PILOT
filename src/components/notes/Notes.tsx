import { useState } from 'react';
import { Plus, Trash2, FileText, Link, Calendar, FolderOpen, Bold, Italic, List, ListOrdered, Heading1, Heading2, Undo, Redo, Code } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useNotesStore } from '../../store/notesStore';
import { useDriveStore } from '../../store/driveStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useCopStore } from '../../store/copStore';
import type { Note } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function NoteEditor({ note }: { note: Note }) {
  const { updateNote } = useNotesStore();
  const { files } = useDriveStore();
  const { events } = useCalendarStore();
  const { addSuggestion } = useCopStore();
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      LinkExt.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Commencez à écrire votre note…' }),
    ],
    content: note.content,
    onUpdate: ({ editor }) => {
      updateNote(note.id, { content: editor.getHTML() });
    },
  }, [note.id]);

  const recentFiles = [...files].filter(f => f.type !== 'folder').slice(0, 4);
  const upcomingEvents = [...events].filter(e => e.date >= format(new Date(), 'yyyy-MM-dd')).slice(0, 4);

  const insertFileLink = (file: typeof files[0]) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`<a href="#file-${file.id}">${file.name}</a>`).run();
    addSuggestion(
      `Lien vers "${file.name}" inséré. Voulez-vous aussi noter les informations clés de ce fichier ?`,
      [
        { label: 'Ajouter une section', handler: () => editor.chain().focus().insertContent(`<h3>Notes – ${file.name}</h3><p></p>`).run() },
        { label: 'Non merci', handler: () => {} },
      ]
    );
    setShowLinkPanel(false);
  };

  const insertEventLink = (ev: typeof events[0]) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`<a href="#event-${ev.id}">${ev.title} (${ev.date})</a>`).run();
    setShowLinkPanel(false);
  };

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Editor toolbar */}
      <div
        className="flex items-center gap-1 px-4 py-2 shrink-0 flex-wrap"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {[
          { icon: <Undo size={14} />, action: () => editor.chain().focus().undo().run(), title: 'Annuler' },
          { icon: <Redo size={14} />, action: () => editor.chain().focus().redo().run(), title: 'Rétablir' },
        ].map((btn, i) => <ToolbarBtn key={i} icon={btn.icon} onClick={btn.action} title={btn.title} />)}
        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
        {[
          { icon: <Heading1 size={14} />, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), title: 'Titre 1' },
          { icon: <Heading2 size={14} />, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: 'Titre 2' },
          { icon: <Bold size={14} />, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Gras' },
          { icon: <Italic size={14} />, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Italique' },
          { icon: <Code size={14} />, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), title: 'Code' },
          { icon: <List size={14} />, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Liste' },
          { icon: <ListOrdered size={14} />, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Liste numérotée' },
        ].map((btn, i) => <ToolbarBtn key={i} icon={btn.icon} onClick={btn.action} active={btn.active} title={btn.title} />)}
        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <ToolbarBtn
          icon={<Link size={14} />}
          onClick={() => setShowLinkPanel(p => !p)}
          active={showLinkPanel}
          title="Insérer un lien"
        />
      </div>

      {/* COP Link Panel */}
      {showLinkPanel && (
        <div
          className="shrink-0 px-4 py-3 animate-fadeIn"
          style={{ background: 'rgba(99,102,241,0.07)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: '#818cf8' }}>🔗 Liens intelligents (COP)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs mb-1.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <FolderOpen size={11} /> Fichiers récents
              </p>
              {recentFiles.map(f => (
                <button key={f.id} onClick={() => insertFileLink(f)}
                  className="block w-full text-left px-2 py-1 rounded-lg text-xs mb-1 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div>
              <p className="text-xs mb-1.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <Calendar size={11} /> Événements à venir
              </p>
              {upcomingEvents.map(ev => (
                <button key={ev.id} onClick={() => insertEventLink(ev)}
                  className="block w-full text-left px-2 py-1 rounded-lg text-xs mb-1 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  );
}

function ToolbarBtn({ icon, onClick, active = false, title }: { icon: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
      style={{
        background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
        color: active ? '#818cf8' : 'rgba(255,255,255,0.55)',
        border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
      }}
    >
      {icon}
    </button>
  );
}

function NoteItem({ note, active, onClick, onDelete }: { note: Note; active: boolean; onClick: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  const stripped = note.content.replace(/<[^>]*>/g, '').slice(0, 60);

  return (
    <div
      className="px-3 py-2.5 rounded-xl cursor-pointer transition-all relative"
      style={{
        background: active ? 'rgba(99,102,241,0.15)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p className="text-sm font-medium truncate" style={{ color: active ? '#818cf8' : 'white' }}>{note.title}</p>
      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{stripped || 'Note vide…'}</p>
      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>
        {format(new Date(note.updatedAt), 'd MMM', { locale: fr })}
      </p>
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute right-2 top-2 w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.15)' }}
        >
          <Trash2 size={11} color="#ef4444" />
        </button>
      )}
    </div>
  );
}

export default function Notes() {
  const { notes, activeNoteId, setActiveNote, createNote, deleteNote, updateNote } = useNotesStore();
  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div
        className="w-64 flex flex-col shrink-0 overflow-hidden"
        style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <FileText size={15} color="#22c55e" />
            <span className="text-sm font-semibold text-white">Notes</span>
          </div>
          <button
            onClick={() => createNote()}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <Plus size={14} color="#22c55e" />
          </button>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {notes.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune note</p>
          )}
          {[...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map(note => (
            <NoteItem
              key={note.id}
              note={note}
              active={note.id === activeNoteId}
              onClick={() => setActiveNote(note.id)}
              onDelete={() => deleteNote(note.id)}
            />
          ))}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeNote ? (
          <>
            {/* Title */}
            <div
              className="px-8 py-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <input
                value={activeNote.title}
                onChange={e => updateNote(activeNote.id, { title: e.target.value })}
                className="text-xl font-bold bg-transparent outline-none w-full"
                style={{ color: 'white', caretColor: '#818cf8' }}
                placeholder="Titre de la note…"
              />
            </div>
            <NoteEditor note={activeNote} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <FileText size={48} color="rgba(255,255,255,0.1)" />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Sélectionnez une note ou créez-en une</p>
            <button
              onClick={() => createNote()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <Plus size={14} /> Nouvelle note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  Plus, Trash2, FileText, Link, Calendar, FolderOpen,
  Bold, Italic, List, ListOrdered, Heading1, Heading2,
  Undo, Redo, Code, PenLine,
} from 'lucide-react';
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

// ── Toolbar button ────────────────────────────────────────────────────────────
function ToolbarBtn({
  icon, onClick, active = false, title,
}: {
  icon: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: active ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
        background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
        color: active ? '#818cf8' : 'rgba(255,255,255,0.5)',
        cursor: 'pointer', transition: 'all 0.12s',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
        }
      }}
    >
      {icon}
    </button>
  );
}

// ── Rich text editor ──────────────────────────────────────────────────────────
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

  const recentFiles = files.filter(f => f.type !== 'folder').slice(0, 4);
  const upcomingEvents = events.filter(e => e.date >= format(new Date(), 'yyyy-MM-dd')).slice(0, 4);

  const insertFileLink = (file: typeof files[0]) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`<a href="#file-${file.id}">${file.name}</a>`).run();
    addSuggestion(
      `Lien vers "${file.name}" inséré. Voulez-vous ajouter une section de notes ?`,
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

  const toolbarGroups = [
    [
      { icon: <Undo size={13} />, action: () => editor.chain().focus().undo().run(), title: 'Annuler' },
      { icon: <Redo size={13} />, action: () => editor.chain().focus().redo().run(), title: 'Rétablir' },
    ],
    [
      { icon: <Heading1 size={13} />, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), title: 'Titre 1' },
      { icon: <Heading2 size={13} />, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: 'Titre 2' },
      { icon: <Bold size={13} />, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Gras' },
      { icon: <Italic size={13} />, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Italique' },
      { icon: <Code size={13} />, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), title: 'Code' },
      { icon: <List size={13} />, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Liste' },
      { icon: <ListOrdered size={13} />, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Liste numérotée' },
    ],
    [
      { icon: <Link size={13} />, action: () => setShowLinkPanel(p => !p), active: showLinkPanel, title: 'Liens intelligents' },
    ],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '8px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {toolbarGroups.map((group, gi) => (
          <span key={gi} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {gi > 0 && (
              <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 5px' }} />
            )}
            {group.map((btn, bi) => (
              <ToolbarBtn key={bi} icon={btn.icon} onClick={btn.action} active={btn.active} title={btn.title} />
            ))}
          </span>
        ))}
      </div>

      {/* Smart link panel */}
      {showLinkPanel && (
        <div
          className="animate-fadeIn"
          style={{
            padding: '12px 20px', flexShrink: 0,
            background: 'rgba(99,102,241,0.06)',
            borderBottom: '1px solid rgba(99,102,241,0.15)',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: '#818cf8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link size={11} /> Liens intelligents COP
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <FolderOpen size={10} /> Fichiers récents
              </p>
              {recentFiles.map(f => (
                <button key={f.id} onClick={() => insertFileLink(f)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '5px 8px', borderRadius: 6, fontSize: 12,
                    color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none',
                    cursor: 'pointer', transition: 'background 0.12s', marginBottom: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={10} /> Événements à venir
              </p>
              {upcomingEvents.map(ev => (
                <button key={ev.id} onClick={() => insertEventLink(ev)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '5px 8px', borderRadius: 6, fontSize: 12,
                    color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none',
                    cursor: 'pointer', transition: 'background 0.12s', marginBottom: 2,
                  }}
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

      {/* Editor */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  );
}

// ── Note item in sidebar ──────────────────────────────────────────────────────
function NoteItem({ note, active, onClick, onDelete }: {
  note: Note; active: boolean; onClick: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const preview = note.content.replace(/<[^>]*>/g, '').slice(0, 55);

  return (
    <div
      style={{
        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
        position: 'relative',
        background: active
          ? 'rgba(99,102,241,0.13)'
          : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
        transition: 'background 0.12s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p style={{
        fontSize: 13, fontWeight: 500,
        color: active ? '#818cf8' : '#f1f5f9',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        paddingRight: 20,
      }}>
        {note.title || 'Sans titre'}
      </p>
      <p style={{
        fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}>
        {preview || 'Note vide…'}
      </p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>
        {format(new Date(note.updatedAt), "d MMM · HH:mm", { locale: fr })}
      </p>

      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Supprimer la note"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 22, height: 22, borderRadius: 5,
            background: 'rgba(239,68,68,0.15)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Trash2 size={11} color="#ef4444" />
        </button>
      )}
    </div>
  );
}

// ── Notes page ────────────────────────────────────────────────────────────────
export default function Notes() {
  const { notes, activeNoteId, setActiveNote, createNote, deleteNote, updateNote } = useNotesStore();
  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;
  const sorted = [...notes].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Notes sidebar ──────────────────────────────── */}
      <div style={{
        width: 260, minWidth: 260, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: '#0e0e1a',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 14px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <FileText size={15} color="#22c55e" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Notes</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 6px',
              borderRadius: 10, background: 'rgba(34,197,94,0.12)', color: '#22c55e',
            }}>
              {notes.length}
            </span>
          </div>
          <button
            onClick={() => createNote()}
            title="Nouvelle note"
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.12)')}
          >
            <Plus size={14} color="#22c55e" />
          </button>
        </div>

        {/* Note list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Aucune note</p>
            </div>
          ) : (
            sorted.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                active={note.id === activeNoteId}
                onClick={() => setActiveNote(note.id)}
                onDelete={() => deleteNote(note.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Editor area ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeNote ? (
          <>
            {/* Note title bar */}
            <div style={{
              padding: '16px 32px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
            }}>
              <input
                value={activeNote.title}
                onChange={e => updateNote(activeNote.id, { title: e.target.value })}
                placeholder="Titre de la note…"
                style={{
                  fontSize: 20, fontWeight: 700, color: '#f1f5f9',
                  background: 'none', border: 'none', outline: 'none',
                  width: '100%', letterSpacing: '-0.01em', caretColor: '#818cf8',
                }}
              />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                Modifié le {format(new Date(activeNote.updatedAt), "d MMMM 'à' HH:mm", { locale: fr })}
              </p>
            </div>

            <NoteEditor note={activeNote} />
          </>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 14,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PenLine size={26} color="rgba(34,197,94,0.6)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                Aucune note sélectionnée
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                Choisissez une note ou créez-en une nouvelle
              </p>
            </div>
            <button
              onClick={() => createNote()}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.22)', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.12)')}
            >
              <Plus size={14} /> Nouvelle note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

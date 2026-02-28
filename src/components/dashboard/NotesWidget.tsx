import { FileText, Plus, ArrowRight } from 'lucide-react';
import { useNotesStore } from '../../store/notesStore';
import { useAppStore } from '../../store/appStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function NotesWidget() {
  const { notes, createNote, setActiveNote } = useNotesStore();
  const { setView } = useAppStore();

  const sorted = [...notes].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleNew = () => {
    createNote();
    setView('notes');
  };

  const openNote = (id: string) => {
    setActiveNote(id);
    setView('notes');
  };

  return (
    <div className="card" style={{ padding: '18px 0', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={14} color="#22c55e" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Notes récentes</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {sorted.length} note{sorted.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setView('notes')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#22c55e', background: 'none',
            border: 'none', cursor: 'pointer', opacity: 0.7,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
        >
          Voir tout <ArrowRight size={11} />
        </button>
      </div>

      {/* Note list */}
      <div style={{ flex: 1, padding: '8px 8px 4px' }}>
        {sorted.slice(0, 3).map(note => {
          const preview = note.content.replace(/<[^>]*>/g, '').slice(0, 60);
          return (
            <button
              key={note.id}
              onClick={() => openNote(note.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#22c55e', flexShrink: 0, marginTop: 5,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: 500, color: '#f1f5f9',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {note.title || 'Sans titre'}
                </p>
                <p style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {preview || 'Note vide…'}
                </p>
              </div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginTop: 2 }}>
                {format(new Date(note.updatedAt), 'd MMM', { locale: fr })}
              </span>
            </button>
          );
        })}

        {sorted.length === 0 && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>
            Aucune note
          </p>
        )}
      </div>

      {/* New note button */}
      <div style={{ padding: '8px 12px 6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleNew}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '8px',
            borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            color: '#22c55e', cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
        >
          <Plus size={13} /> Nouvelle note
        </button>
      </div>
    </div>
  );
}

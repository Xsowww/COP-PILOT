import { FileText, Plus, ArrowRight } from 'lucide-react';
import { useNotesStore } from '../../store/notesStore';
import { useAppStore } from '../../store/appStore';

export default function NotesWidget() {
  const { notes, createNote, setActiveNote } = useNotesStore();
  const { setView } = useAppStore();

  const lastNote = [...notes].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  const stripped = lastNote?.content.replace(/<[^>]*>/g, '').slice(0, 120) ?? '';

  const handleNew = () => {
    createNote();
    setView('notes');
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} color="#22c55e" />
          <span className="text-sm font-semibold text-white">Notes</span>
        </div>
        <button
          onClick={() => setView('notes')}
          className="flex items-center gap-1 text-xs transition-opacity opacity-60 hover:opacity-100"
          style={{ color: '#22c55e' }}
        >
          Voir tout <ArrowRight size={12} />
        </button>
      </div>

      {lastNote && (
        <button
          onClick={() => { setActiveNote(lastNote.id); setView('notes'); }}
          className="rounded-xl p-3 text-left transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
        >
          <p className="text-xs font-semibold text-white mb-1 truncate">{lastNote.title}</p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {stripped || 'Note vide…'}
          </p>
        </button>
      )}

      <button
        onClick={handleNew}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all"
        style={{
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.25)',
          color: '#22c55e',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.12)')}
      >
        <Plus size={14} /> Nouvelle Note
      </button>
    </div>
  );
}

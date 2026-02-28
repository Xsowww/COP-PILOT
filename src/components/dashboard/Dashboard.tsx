import { useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FolderOpen, Calendar, FileText } from 'lucide-react';
import DriveWidget from './DriveWidget';
import CalendarWidget from './CalendarWidget';
import NotesWidget from './NotesWidget';
import { useCopStore } from '../../store/copStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useDriveStore } from '../../store/driveStore';
import { useNotesStore } from '../../store/notesStore';
import { useAppStore } from '../../store/appStore';

export default function Dashboard() {
  const { addSuggestion } = useCopStore();
  const { events } = useCalendarStore();
  const { files, addFolder } = useDriveStore();
  const { notes, createNote } = useNotesStore();
  const { setView } = useAppStore();

  // COP Bot : détecte les examens du lendemain
  useEffect(() => {
    const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
    const examTomorrow = events.find(e => e.date === tomorrow && e.priority === 'exam');
    if (examTomorrow) {
      const timer = setTimeout(() => {
        addSuggestion(
          `Examen "${examTomorrow.title}" demain — je peux créer un dossier de révision et une note associée.`,
          [
            {
              label: 'Créer dossier + note',
              handler: () => {
                const folder = addFolder(`Révisions – ${examTomorrow.title}`, null);
                createNote(`Révisions – ${examTomorrow.title}`);
                console.log('Created folder', folder.id);
                setView('drive');
              },
            },
            { label: 'Non merci', handler: () => {} },
          ],
          { relatedEntityId: examTomorrow.id, relatedEntityType: 'event' }
        );
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const dateStr = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  const stats = [
    {
      label: 'Fichiers',
      value: files.length,
      icon: FolderOpen,
      color: '#818cf8',
      bg: 'rgba(99,102,241,0.12)',
      onClick: () => setView('drive'),
    },
    {
      label: 'Événements',
      value: events.length,
      icon: Calendar,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.12)',
      onClick: () => setView('calendar'),
    },
    {
      label: 'Notes',
      value: notes.length,
      icon: FileText,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.12)',
      onClick: () => setView('notes'),
    },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Hero ─────────────────────────────────── */}
        <div className="animate-fadeIn">
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', textTransform: 'capitalize', marginBottom: 6 }}>
            {dateStr}
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {greeting()},{' '}
            <span style={{ color: '#818cf8' }}>Étudiant</span>
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 6 }}>
            Voici un résumé de votre espace de travail
          </p>
        </div>

        {/* ── Stats ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                onClick={stat.onClick}
                className="card"
                style={{
                  padding: '18px 20px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, transform 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                }}
              >
                <div>
                  <p style={{ fontSize: 32, fontWeight: 700, color: stat.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5, fontWeight: 500 }}>
                    {stat.label}
                  </p>
                </div>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: stat.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={20} color={stat.color} />
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Widgets ───────────────────────────────── */}
        <div>
          <p className="label-xs" style={{ marginBottom: 14 }}>Aperçu rapide</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <CalendarWidget />
            <NotesWidget />
            <DriveWidget />
          </div>
        </div>

      </div>
    </div>
  );
}

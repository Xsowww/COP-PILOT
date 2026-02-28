import { useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
  const { addFolder } = useDriveStore();
  const { createNote } = useNotesStore();
  const { setView } = useAppStore();

  // COP Bot: watch for exams and suggest actions
  useEffect(() => {
    const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
    const examTomorrow = events.find(e => e.date === tomorrow && e.priority === 'exam');

    if (examTomorrow) {
      const timer = setTimeout(() => {
        addSuggestion(
          `Je vois que vous avez "${examTomorrow.title}" demain. Voulez-vous que je crée un dossier de révisions et une note associée ?`,
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

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="animate-fadeIn">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{dateStr}</p>
        <h2 className="text-2xl font-bold text-white mt-1">
          {greeting()}, <span style={{ color: '#818cf8' }}>Étudiant</span> 👋
        </h2>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 animate-fadeIn">
        {[
          { label: 'Fichiers', value: '7', color: '#818cf8' },
          { label: 'Événements', value: '5', color: '#f59e0b' },
          { label: 'Notes', value: '3', color: '#22c55e' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Widgets grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <DriveWidget />
        <CalendarWidget />
        <NotesWidget />
      </div>
    </div>
  );
}

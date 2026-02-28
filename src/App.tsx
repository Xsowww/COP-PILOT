import { useEffect, useRef } from 'react';
import { useAppStore } from './store/appStore';
import { useNotesStore } from './store/notesStore';
import { useDriveStore } from './store/driveStore';
import { useCalendarStore } from './store/calendarStore';
import { useCopStore } from './store/copStore';
import { useChatStore } from './store/chatStore';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Dashboard from './components/dashboard/Dashboard';
import Drive from './components/drive/Drive';
import CalendarSpace from './components/calendar/Calendar';
import Notes from './components/notes/Notes';
import CopToastContainer from './components/cop/CopToast';
import CopChat from './components/cop/CopChat';

// ── Proactive COP engine ─────────────────────────────────────────────────────
function useCopProactive() {
  const { notes } = useNotesStore();
  const { files } = useDriveStore();
  const { events } = useCalendarStore();
  const { addSuggestion } = useCopStore();
  const { addCopMessage } = useChatStore();

  const prevNotes   = useRef(notes.length);
  const prevFiles   = useRef(files.length);
  const prevEvents  = useRef(events.length);
  const initializing = useRef(true);

  // Wait 1 second before tracking changes (avoid firing on demo data mount)
  useEffect(() => {
    const t = setTimeout(() => { initializing.current = false; }, 1000);
    return () => clearTimeout(t);
  }, []);

  // ── Notes ──
  useEffect(() => {
    if (initializing.current) { prevNotes.current = notes.length; return; }

    const delta = notes.length - prevNotes.current;
    if (delta > 0) {
      const latest = notes[notes.length - 1];
      addSuggestion(
        `Super ! La note "${latest.title}" est créée 📝 Tu veux la lier à un événement du calendrier ?`,
        [
          { label: 'Bonne idée !', handler: () => {} },
          { label: 'Pas maintenant', handler: () => {} },
        ]
      );
      addCopMessage(`Nouvelle note créée : "${latest.title}" ! 🎉 Tu veux la structurer ou la lier à quelque chose dans ton calendrier ?`);
    } else if (delta < 0) {
      addSuggestion(
        "Note supprimée ! J'espère que c'était voulu... 🗑️ Sinon, rafraîchis vite !",
        [{ label: "C'était voulu !", handler: () => {} }]
      );
    }

    prevNotes.current = notes.length;
  }, [notes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drive ──
  useEffect(() => {
    if (initializing.current) { prevFiles.current = files.length; return; }

    const delta = files.length - prevFiles.current;
    if (delta > 0) {
      const latest = files[files.length - 1];
      if (latest?.type === 'folder') {
        addSuggestion(
          `Nouveau dossier "${latest.name}" créé ! 📁 Je crée une note d'index dedans ?`,
          [
            { label: 'Créer une note', handler: () => {} },
            { label: 'Pas besoin', handler: () => {} },
          ]
        );
        addCopMessage(`Dossier "${latest.name}" créé avec succès 📁 Si tu veux, je peux y ajouter une note d'index pour mieux t'y retrouver !`);
      } else if (latest) {
        addSuggestion(
          `Fichier "${latest.name}" ajouté ! Tu veux le lier à une note existante ?`,
          [
            { label: 'Lier à une note', handler: () => {} },
            { label: 'Non merci', handler: () => {} },
          ]
        );
      }
    } else if (delta < 0) {
      addSuggestion(
        "Fichier ou dossier supprimé ! Si c'était une erreur... rafraîchis vite 😅",
        [{ label: 'Ok, j\'assume !', handler: () => {} }]
      );
    }

    prevFiles.current = files.length;
  }, [files.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calendar ──
  useEffect(() => {
    if (initializing.current) { prevEvents.current = events.length; return; }

    const delta = events.length - prevEvents.current;
    if (delta > 0) {
      const latest = events[events.length - 1];
      const isImportant = latest?.priority === 'exam' || latest?.priority === 'high';

      if (isImportant) {
        addSuggestion(
          `Événement ${latest.priority === 'exam' ? '🎓 Examen' : '🔴 Urgent'} détecté : "${latest.title}" ! Je prépare des notes de révision ?`,
          [
            { label: 'Créer les notes', handler: () => {} },
            { label: 'Je gère', handler: () => {} },
          ]
        );
        addCopMessage(`Whoah, ${latest.priority === 'exam' ? 'un examen' : 'un événement urgent'} a été ajouté : "${latest.title}" ! 💪 Je te prépare des notes de révision ou tu t'en occupes ?`);
      } else {
        addSuggestion(
          `Événement "${latest?.title}" ajouté au calendrier 📅 Tu veux y lier une note ?`,
          [
            { label: 'Lier une note', handler: () => {} },
            { label: 'Non', handler: () => {} },
          ]
        );
      }
    } else if (delta < 0) {
      addSuggestion(
        "Événement supprimé ! Bonne décision ou regret ? 😏",
        [{ label: "C'était voulu !", handler: () => {} }]
      );
    }

    prevEvents.current = events.length;
  }, [events.length]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { view } = useAppStore();

  useCopProactive();

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#111120' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'hidden' }}>
          {view === 'dashboard' && <Dashboard />}
          {view === 'drive'     && <Drive />}
          {view === 'calendar'  && <CalendarSpace />}
          {view === 'notes'     && <Notes />}
        </main>
      </div>

      {/* Persistent COP widget + toast notifications */}
      <CopToastContainer />
      <CopChat />
    </div>
  );
}

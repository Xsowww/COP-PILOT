import { useAppStore } from './store/appStore';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Dashboard from './components/dashboard/Dashboard';
import Drive from './components/drive/Drive';
import CalendarSpace from './components/calendar/Calendar';
import Notes from './components/notes/Notes';
import CopToastContainer from './components/cop/CopToast';

export default function App() {
  const { view } = useAppStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#0f0f1a' }}>
      {/* Background orbs */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(168,85,247,0.06) 0%, transparent 60%)',
        }}
      />

      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden relative z-10">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          {view === 'dashboard' && <Dashboard />}
          {view === 'drive' && <Drive />}
          {view === 'calendar' && <CalendarSpace />}
          {view === 'notes' && <Notes />}
        </main>
      </div>

      <CopToastContainer />
    </div>
  );
}

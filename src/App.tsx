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

      <CopToastContainer />
    </div>
  );
}

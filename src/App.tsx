import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { loadUserData } from './store/session';
import AuthPage from './pages/AuthPage';
import AppShell from './layout/AppShell';
import Dashboard from './pages/Dashboard';
import DrivePage from './pages/drive/DrivePage';
import CalendarPage from './pages/calendar/CalendarPage';
import { DialogHost, Toasts } from './components/Overlays';

const NotesPage = lazy(() => import('./pages/notes/NotesPage'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth(s => s.user);
  return user ? children : <Navigate to="/connexion" replace />;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const user = useAuth(s => s.user);
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadUserData().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
        <Route path="/inscription" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="drive" element={<DrivePage />} />
          <Route path="calendrier" element={<CalendarPage />} />
          <Route path="notes" element={<Suspense fallback={null}><NotesPage /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
      <DialogHost />
    </BrowserRouter>
  );
}

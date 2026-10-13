import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { loadUserData } from './store/session';
import { toast } from './store/ui';
import AuthPage from './pages/AuthPage';
import MfaPage from './pages/MfaPage';
import AppShell from './layout/AppShell';
import Dashboard from './pages/Dashboard';
import DrivePage from './pages/drive/DrivePage';
import CalendarPage from './pages/calendar/CalendarPage';
import { DialogHost, Toasts } from './components/Overlays';

const NotesPage = lazy(() => import('./pages/notes/NotesPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'));
const GroupsPage = lazy(() => import('./pages/groups/GroupsPage'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth(s => s.user);
  const mfaStep = useAuth(s => s.mfaStep);
  if (!user) return <Navigate to="/connexion" replace />;
  return mfaStep ? <Navigate to="/securite" replace /> : children;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const user = useAuth(s => s.user);
  const mfaStep = useAuth(s => s.mfaStep);
  return user ? <Navigate to={mfaStep ? '/securite' : '/'} replace /> : children;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void useAuth
      .getState()
      .init()
      .then(loadUserData)
      .finally(() => {
        setReady(true);
        if (sessionStorage.getItem('cop-account-switched')) {
          sessionStorage.removeItem('cop-account-switched');
          const name = useAuth.getState().user?.name;
          toast(`Un autre compte s’est connecté dans un autre onglet${name ? ` : tu es maintenant sur le compte de ${name}` : ''}. Pour utiliser deux comptes en même temps, ouvre le second dans une fenêtre de navigation privée.`);
        }
      });
  }, []);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
        <Route path="/inscription" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
        <Route path="/mot-de-passe-oublie" element={<GuestOnly><AuthPage mode="forgot" /></GuestOnly>} />
        <Route path="/reinitialisation" element={<AuthPage mode="reset" />} />
        <Route path="/securite" element={<MfaPage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="drive" element={<DrivePage />} />
          <Route path="calendrier" element={<CalendarPage />} />
          <Route path="notes" element={<Suspense fallback={null}><NotesPage /></Suspense>} />
          <Route path="taches" element={<Suspense fallback={null}><TasksPage /></Suspense>} />
          <Route path="progression" element={<Navigate to="/taches" replace />} />
          <Route path="groupes" element={<Suspense fallback={null}><GroupsPage /></Suspense>} />
          <Route path="profil" element={<Suspense fallback={null}><ProfilePage /></Suspense>} />
          <Route path="admin" element={<Suspense fallback={null}><AdminPage /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
      <DialogHost />
    </BrowserRouter>
  );
}

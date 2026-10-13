import { addDays } from 'date-fns';
import { useDrive } from './drive';
import { useCalendar } from './calendar';
import { useNotes } from './notes';
import { useCopilot } from './copilot';
import { useSettings, applyAppearance, storedTheme } from './settings';
import { toKey } from '../lib/dates';
import { getStorageUser, setStorageUser } from '../lib/userStorage';
import { cloudEnabled } from '../lib/supabase';
import { pullAll, pushLeftovers, startSync, stopSync, updateCloudProfile } from '../lib/cloudSync';
import { useAuth } from './auth';
import { toast } from './ui';
import { useTodos } from './todos';
import { useFocusLog } from './focusLog';

/** Load the signed-in user's data (or reset everything when signed out). */
export async function loadUserData() {
  const userId = getStorageUser();
  if (cloudEnabled) stopSync();
  // Detach storage while clearing memory, otherwise the reset would overwrite the saved data.
  setStorageUser(null);
  useDrive.setState({ items: [], trash: [], clipboard: null });
  useCalendar.setState({ events: [] });
  useNotes.setState({ folders: [], notes: [], trashFolders: [], trashNotes: [] });
  useTodos.setState({ todos: [] });
  useFocusLog.setState({ sessions: [] });
  useCopilot.getState().reset();
  useSettings.getState().reset();
  setStorageUser(userId);
  if (!userId) {
    // Logged out: last theme used on this device, otherwise the system's.
    applyAppearance({ ...useSettings.getState(), theme: storedTheme() ?? 'auto' }, false);
    return;
  }
  await Promise.all([
    useDrive.persist.rehydrate(),
    useCalendar.persist.rehydrate(),
    useNotes.persist.rehydrate(),
    useCopilot.persist.rehydrate(),
    useSettings.persist.rehydrate(),
    useTodos.persist.rehydrate(),
    useFocusLog.persist.rehydrate(),
  ]);

  // Cloud mode: the local copy above is only a cache, the truth is in Supabase.
  if (cloudEnabled) {
    try {
      await pushLeftovers(userId); // never let the cloud copy overwrite unsent local changes
      const profile = await pullAll(userId);
      startSync(userId);
      if (!profile.onboarded) {
        seedNewAccount(profile.name || useAuth.getState().user?.name || '');
        await updateCloudProfile(userId, { onboarded: true });
      }
    } catch (e) {
      console.error('[sync] chargement', e);
      startSync(userId);
      toast('Impossible de charger tes données en ligne. Tu vois la dernière version enregistrée sur cet appareil.', 'error');
    }
  }
  // Trash: what has been there for more than 30 days goes for good.
  useDrive.getState().purgeExpired();
  useNotes.getState().purgeExpired();
  applyAppearance(useSettings.getState());
}

/** A few starter items so a brand-new account doesn't open on an empty screen. */
export function seedNewAccount(name: string) {
  const drive = useDrive.getState();
  const cours = drive.createFolder('Cours', null);
  drive.createFolder('Projets', null);
  drive.createFolder('Administratif', null);
  drive.createFolder('Semestre 1', cours.id);

  const notes = useNotes.getState();
  const nf = notes.createFolder('Cours', null);
  notes.createFolder('Perso', null);
  notes.createNote({
    title: 'Bienvenue sur COP-PILOT',
    content: `<h2>Salut ${name}</h2><p>Voici ton espace. Quelques repères pour démarrer :</p><ul><li><p><strong>Drive</strong> : glisse tes fichiers dans la page, clic droit pour copier, couper, renommer…</p></li><li><p><strong>Calendrier</strong> : écris simplement « Partiel de maths vendredi 14h », c'est ajouté.</p></li><li><p><strong>Notes</strong> : range tes notes dans des dossiers, comme celle-ci.</p></li></ul><p>Et si tu cherches quelque chose, demande à <strong>Copilot</strong>, le petit personnage qui t'observe depuis le bord droit de l'écran.</p>`,
  });
  notes.createNote({ title: 'Méthode de révision', folderId: nf.id, content: '<p>1. Relire le cours<br>2. Faire une fiche<br>3. S\'entraîner sur les annales</p>' });

  const cal = useCalendar.getState();
  const today = new Date();
  cal.add({ title: 'Découvrir COP-PILOT', date: toKey(today), category: 'perso' });
  cal.add({ title: 'Cours de maths', date: toKey(addDays(today, 1)), start: '09:00', end: '11:00', category: 'cours' });
  cal.add({ title: 'Rendre le TP de physique', date: toKey(addDays(today, 3)), start: '18:00', category: 'devoir' });
  cal.add({ title: 'Partiel d\'anglais', date: toKey(addDays(today, 8)), start: '14:00', end: '16:00', category: 'examen' });
}

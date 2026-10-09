import { addDays } from 'date-fns';
import { useDrive } from './drive';
import { useCalendar } from './calendar';
import { useNotes } from './notes';
import { useCopilot } from './copilot';
import { toKey } from '../lib/dates';
import { getStorageUser, setStorageUser } from '../lib/userStorage';

/** Load the signed-in user's data (or reset everything when signed out). */
export async function loadUserData() {
  const userId = getStorageUser();
  // Detach storage while clearing memory, otherwise the reset would overwrite the saved data.
  setStorageUser(null);
  useDrive.setState({ items: [], clipboard: null });
  useCalendar.setState({ events: [] });
  useNotes.setState({ folders: [], notes: [] });
  useCopilot.getState().reset();
  setStorageUser(userId);
  if (!userId) return;
  await Promise.all([
    useDrive.persist.rehydrate(),
    useCalendar.persist.rehydrate(),
    useNotes.persist.rehydrate(),
    useCopilot.persist.rehydrate(),
  ]);
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

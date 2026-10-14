import { useDrive } from './drive';
import { useCalendar } from './calendar';
import { useNotes } from './notes';
import { useCopilot } from './copilot';
import { useSettings, applyAppearance, storedTheme, type Settings } from './settings';
import { toKey } from '../lib/dates';
import { getStorageUser, setStorageUser } from '../lib/userStorage';
import { cloudEnabled } from '../lib/supabase';
import { pullAll, pushLeftovers, startSync, stopSync, updateCloudProfile } from '../lib/cloudSync';
import { useAuth } from './auth';
import { toast } from './ui';
import { useTodos } from './todos';
import { TOUR_TODO } from './tour';
import { useFocusLog } from './focusLog';
import { renameToKompa } from '../lib/renameToKompa';
import { applyUsage } from '../lib/usage';
import { create } from 'zustand';

/** True while a brand-new account still has to answer the welcome questionnaire. */
export const useWelcome = create<{ pending: boolean }>(() => ({ pending: false }));

let loading: Promise<void> = Promise.resolve();

/**
 * Load the signed-in user's data (or reset everything when signed out). Calls run one after the
 * other: two loads interleaved would reset the stores and the sync queue under each other.
 */
export function loadUserData() {
  const run = loading.then(load);
  loading = run.catch(() => undefined);
  return run;
}

async function load() {
  const userId = getStorageUser();
  useWelcome.setState({ pending: false });
  if (cloudEnabled) stopSync();
  // Detach storage while clearing memory, otherwise the reset would overwrite the saved data.
  setStorageUser(null);
  useDrive.setState({ items: [], trash: [], clipboard: null });
  useCalendar.setState({ events: [], trash: [] });
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
      // New account: the welcome questionnaire comes first, it seeds the account when done.
      useWelcome.setState({ pending: !profile.onboarded });
    } catch (e) {
      console.error('[sync] chargement', e);
      startSync(userId);
      toast('Impossible de charger tes données en ligne. Tu vois la dernière version enregistrée sur cet appareil.', 'error');
    }
  }
  // Trash: what has been there for more than 30 days goes for good.
  useDrive.getState().purgeExpired();
  useNotes.getState().purgeExpired();
  useCalendar.getState().purgeExpired();
  renameToKompa();
  applyUsage(useSettings.getState().usage);
  applyAppearance(useSettings.getState());
}

export type WelcomeAnswers = Pick<Settings, 'usage' | 'year' | 'school' | 'program' | 'needs' | 'persona' | 'revisionTime'>;

/** End of the welcome questionnaire: fill the profile, adapt Kompa, seed the account, never ask again. */
export async function finishWelcome(answers: WelcomeAnswers) {
  const settings = useSettings.getState();
  settings.set({
    ...answers,
    // Someone who didn't ask for help from the AI gets a quieter Kompa (still one click away).
    chattiness: answers.needs.length && !answers.needs.includes('ia') ? 'calme' : settings.chattiness,
  });
  applyUsage(answers.usage);
  const user = useAuth.getState().user;
  seedNewAccount();
  // Saved before leaving the page: switching to the home page first let a closed tab lose it (questionnaire again).
  if (cloudEnabled && user) await updateCloudProfile(user.id, { onboarded: true }).catch(() => undefined);
  useWelcome.setState({ pending: false });
}

/** A brand-new account starts empty: only the task that launches the guided tour. */
export function seedNewAccount() {
  useTodos.getState().add(TOUR_TODO, toKey(new Date()));
}

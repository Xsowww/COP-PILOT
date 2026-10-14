import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso } from '../lib/utils';
import { userStorage } from '../lib/userStorage';

/** One completed focus session, used for the time-per-subject statistics. */
export interface FocusSession {
  id: string;
  subject: string; // '' when the student didn't pick one
  minutes: number;
  startedAt: string; // ISO
}

interface FocusLogState {
  sessions: FocusSession[];
  log: (subject: string, minutes: number, startedAt?: string) => FocusSession;
}

export const useFocusLog = create<FocusLogState>()(
  persist(
    set => ({
      sessions: [],
      log(subject, minutes, startedAt = nowIso()) {
        const s: FocusSession = { id: uid(), subject: subject.trim(), minutes, startedAt };
        set(st => ({ sessions: [...st.sessions, s] }));
        return s;
      },
    }),
    { name: 'focus-log', storage: userStorage, skipHydration: true },
  ),
);

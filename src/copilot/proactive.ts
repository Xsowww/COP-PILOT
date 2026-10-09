// Copilot's initiative: he watches what happens in the app and, from time to time,
// leans out of the screen edge to react or to suggest something useful.

import { addDays } from 'date-fns';
import { useCalendar, sortEvents, type CalendarEvent } from '../store/calendar';
import { useDrive } from '../store/drive';
import { useNotes } from '../store/notes';
import { useCopilot, type Bubble, type CopilotOffer } from '../store/copilot';
import { useAuth } from '../store/auth';
import { toKey, todayKey, daysUntil, fmt, fromKey } from '../lib/dates';
import { hasRevisionPlan, linkToDay, linkToNote } from './actions';
import { aiNudge } from './claudeBrain';
import { getSettings } from '../store/settings';
import { notify } from '../lib/notify';

/** minimum delay between two spontaneous remarks, depending on the student's preference */
const MIN_GAP = { calme: 5 * 60_000, normal: 75_000, bavard: 30_000 };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

let lastNudge = 0;
let busy = false;

interface Nudge {
  key: string; // memory key: the same remark is not repeated within `every`
  every: number;
  situation: Record<string, unknown>; // given to Claude to phrase it
  fallback: string; // local wording
  offers?: CopilotOffer[];
  links?: Bubble['links'];
  mood?: Bubble['mood'];
  urgent?: boolean; // bypass the global gap
}

function canSpeak(n: Nudge) {
  const s = useCopilot.getState();
  const settings = getSettings();
  if (s.thinking || !settings.copilotVisible) return false;
  const isReminder = n.key.startsWith('starting:');
  if (isReminder ? !settings.eventReminders : !settings.proactive) return false;
  const last = s.memory[n.key];
  if (last && Date.now() - last < n.every) return false;
  if (!n.urgent && Date.now() - lastNudge < MIN_GAP[settings.chattiness]) return false;
  return true;
}

async function nudge(n: Nudge) {
  if (busy || !canSpeak(n)) return false;
  busy = true;
  lastNudge = Date.now();
  useCopilot.getState().remember(n.key);
  try {
    let text = n.fallback;
    if (useCopilot.getState().aiEnabled) {
      const ai = await aiNudge({ ...n.situation, actions_proposees: n.offers?.map(o => o.label) ?? [] }, useAuth.getState().user?.name ?? '');
      if (ai) text = ai;
    }
    useCopilot.getState().say({ text, offers: n.offers, links: n.links, mood: n.mood ?? (n.offers ? 'alert' : 'happy') });
    notify('Copilot', text);
  } finally {
    busy = false;
  }
  return true;
}

const when = (e: CalendarEvent) => `${fmt(fromKey(e.date), 'EEEE d MMMM')}${e.start ? ` à ${e.start.replace(':', 'h')}` : ''}`;

const examOffers = (e: CalendarEvent): CopilotOffer[] =>
  hasRevisionPlan(e.title)
    ? [{ label: 'Créer une fiche', kind: 'revision_note', payload: { eventId: e.id } }]
    : [
        { label: 'Planifier mes révisions', kind: 'plan_revisions', payload: { eventId: e.id } },
        { label: 'Juste une fiche', kind: 'revision_note', payload: { eventId: e.id } },
      ];

// ── Reactions to what the student does ──────────────────────────────────────

function onEventAdded(e: CalendarEvent) {
  if (e.title.startsWith('Révision · ')) return; // created by Copilot himself
  if (e.category === 'examen') {
    const d = daysUntil(e.date);
    void nudge({
      key: `exam-added:${e.id}`,
      every: 365 * DAY,
      urgent: true,
      situation: { evenement: "l'étudiant vient d'ajouter un examen", examen: e.title, quand: when(e), jours_restants: d },
      fallback:
        d <= 2
          ? `« ${e.title} » ${d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : 'après-demain'} ? On ne panique pas : je te prépare un mini-plan express ?`
          : pick([
              `Examen noté : « ${e.title} », dans ${d} jours. On cale des révisions maintenant, comme ça c'est fait ?`,
              `« ${e.title} » dans ${d} jours. Je te propose de répartir des séances de révision d'ici là, ça te va ?`,
            ]),
      offers: examOffers(e),
    });
  } else if (e.category === 'devoir' && daysUntil(e.date) <= 1 && daysUntil(e.date) >= 0) {
    void nudge({
      key: `hw-added:${e.id}`,
      every: 365 * DAY,
      situation: { evenement: "l'étudiant ajoute un devoir à rendre très bientôt", devoir: e.title, quand: when(e) },
      fallback: `« ${e.title} » pour ${daysUntil(e.date) === 0 ? "aujourd'hui" : 'demain'}… Courage, je te le rappelle si besoin.`,
    });
  }
}

function onEventDone(e: CalendarEvent) {
  const today = useCalendar.getState().events.filter(x => x.date === todayKey());
  if (e.category === 'examen' && daysUntil(e.date) <= 0) {
    void nudge({
      key: `exam-done:${e.id}`,
      every: 365 * DAY,
      situation: { evenement: "l'étudiant vient de cocher son examen comme passé", examen: e.title },
      fallback: `« ${e.title} », c'est derrière toi. Alors, ça s'est passé comment ?`,
      mood: 'happy',
    });
  } else if (today.length >= 2 && today.every(x => x.done)) {
    void nudge({
      key: `day-clear:${todayKey()}`,
      every: DAY,
      situation: { evenement: "l'étudiant a terminé tout ce qui était prévu aujourd'hui", nombre: today.length },
      fallback: pick(["Tout est coché pour aujourd'hui. Respect. Tu as gagné une vraie pause.", "Journée bouclée à 100 %. Franchement, chapeau."]),
      mood: 'happy',
    });
  }
}

function onFilesUploaded(count: number) {
  const files = useDrive.getState().items.filter(i => i.kind === 'file');
  if (files.length === count) {
    void nudge({
      key: 'first-upload',
      every: 365 * DAY,
      situation: { evenement: "premier import de fichiers dans le Drive de l'étudiant", nombre: count },
      fallback: 'Premiers fichiers dans ton Drive. Astuce : glisse-les sur un dossier pour les ranger, ou demande-moi de les retrouver plus tard.',
    });
  }
}

// ── Periodic look at the calendar ────────────────────────────────────────────

function periodicCheck() {
  const events = [...useCalendar.getState().events].sort(sortEvents);
  const today = todayKey();
  const now = new Date();
  const hm = fmt(now, 'HH:mm');

  // Something starts within 20 minutes
  const soon = events.find(e => e.date === today && !e.done && e.start && e.start > hm && minutesBetween(hm, e.start) <= 20);
  if (soon) {
    void nudge({
      key: `starting:${soon.id}`,
      every: DAY,
      urgent: true,
      situation: { evenement: 'un événement commence dans moins de 20 minutes', titre: soon.title, heure: soon.start, type: soon.category },
      fallback: `Petit rappel : « ${soon.title} » commence à ${soon.start!.replace(':', 'h')}.`,
      links: [{ label: 'Voir', to: linkToDay(today) }],
      mood: 'alert',
    });
    return;
  }

  // Exam within 6 days and no revision plan yet
  const exam = events.find(e => e.category === 'examen' && !e.done && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 6 && !hasRevisionPlan(e.title));
  if (exam) {
    const d = daysUntil(exam.date);
    void nudge({
      key: `exam-soon:${exam.id}`,
      every: DAY,
      situation: { evenement: 'examen proche sans révisions planifiées', examen: exam.title, quand: when(exam), jours_restants: d },
      fallback: d <= 1 ? `« ${exam.title} » ${d === 0 ? "c'est aujourd'hui" : "c'est demain"}. On fait une dernière révision ciblée ensemble ?` : `« ${exam.title} » arrive dans ${d} jours et rien n'est prévu pour réviser. Je te cale des créneaux ?`,
      offers: examOffers(exam),
    });
    return;
  }

  // Late homework
  const late = events.filter(e => e.category === 'devoir' && !e.done && e.date < today && !e.title.startsWith('Révision · '));
  if (late.length) {
    void nudge({
      key: `late:${today}`,
      every: DAY,
      situation: { evenement: 'devoirs non cochés dont la date est passée', devoirs: late.map(e => e.title) },
      fallback: late.length === 1 ? `« ${late[0].title} » n'est pas coché alors que la date est passée. Tu l'as rendu ?` : `${late.length} devoirs sont en retard dans ton calendrier. Tu veux faire le tri ?`,
      offers: late.length === 1 ? [{ label: "Oui, c'est rendu", kind: 'mark_done', payload: { eventId: late[0].id } }] : undefined,
      links: late.length > 1 ? [{ label: 'Voir le calendrier', to: '/calendrier' }] : undefined,
    });
    return;
  }

  // Homework due tomorrow
  const tomorrow = toKey(addDays(now, 1));
  const due = events.find(e => e.category === 'devoir' && !e.done && e.date === tomorrow && !e.title.startsWith('Révision · '));
  if (due && now.getHours() >= 14) {
    void nudge({
      key: `due-tomorrow:${due.id}`,
      every: DAY,
      situation: { evenement: 'devoir à rendre demain, pas encore coché', devoir: due.title, quand: when(due) },
      fallback: `N'oublie pas : « ${due.title} » est à rendre demain. Il te reste beaucoup ?`,
      offers: [{ label: "C'est déjà fait", kind: 'mark_done', payload: { eventId: due.id } }],
    });
    return;
  }

  // Evening before an exam
  const examTomorrow = events.find(e => e.category === 'examen' && e.date === tomorrow);
  if (examTomorrow && now.getHours() >= 21) {
    void nudge({
      key: `eve:${examTomorrow.id}`,
      every: DAY,
      situation: { evenement: "veille d'examen, il est tard", examen: examTomorrow.title, heure: examTomorrow.start },
      fallback: `Demain c'est « ${examTomorrow.title} ». Le meilleur conseil maintenant : dormir. Tu en sais plus que tu crois.`,
      mood: 'sleep',
    });
    return;
  }

  // A note created a while ago that is still empty
  const empty = useNotes.getState().notes.find(n => !n.content.replace(/<[^>]+>/g, '').trim() && Date.now() - new Date(n.createdAt).getTime() > 2 * DAY);
  if (empty) {
    void nudge({
      key: `empty-note:${empty.id}`,
      every: 30 * DAY,
      situation: { evenement: 'une note créée il y a plusieurs jours est toujours vide', note: empty.title },
      fallback: `Ta note « ${empty.title} » est vide depuis un moment. On la remplit ou je la laisse tranquille ?`,
      links: [{ label: 'Ouvrir la note', to: linkToNote(empty.id) }],
    });
  }
}

function minutesBetween(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

/** Greeting when the app opens (once per browser session). */
function greet() {
  if (sessionStorage.getItem('cop:greeted')) return;
  sessionStorage.setItem('cop:greeted', '1');
  const name = useAuth.getState().user?.name ?? '';
  const events = useCalendar.getState().events;
  const today = events.filter(e => e.date === todayKey()).sort(sortEvents);
  const nextExam = events.filter(e => e.category === 'examen' && !e.done && e.date >= todayKey()).sort(sortEvents)[0];
  const h = new Date().getHours();
  const hello = h < 5 ? `Encore debout, ${name} ?` : h < 12 ? `Salut ${name} !` : h < 18 ? `Hey ${name}.` : `Bonsoir ${name}.`;
  const fallback = today.length
    ? `${hello} Aujourd'hui : ${today.map(e => e.title).slice(0, 3).join(', ')}${today.length > 3 ? '…' : '.'}`
    : `${hello} Rien de prévu aujourd'hui${nextExam ? `, mais « ${nextExam.title} » arrive dans ${daysUntil(nextExam.date)} jours` : ''}.`;
  void nudge({
    key: 'greet',
    every: 0,
    urgent: true,
    situation: {
      evenement: "l'étudiant ouvre l'application, salue-le et résume sa journée en une phrase",
      aujourdhui: today.map(e => `${e.title}${e.start ? ` ${e.start}` : ''}${e.done ? ' (fait)' : ''}`),
      prochain_examen: nextExam ? `${nextExam.title} dans ${daysUntil(nextExam.date)} jours` : null,
      heure: fmt(new Date(), 'HH:mm'),
    },
    fallback,
    mood: 'happy',
  });
}

/** Starts watching the app. Returns a cleanup function. */
export function startProactive() {
  const unsubs = [
    useCalendar.subscribe((s, prev) => {
      if (s.events.length > prev.events.length) onEventAdded(s.events[s.events.length - 1]);
      for (const e of s.events) {
        const before = prev.events.find(p => p.id === e.id);
        if (before && !before.done && e.done) onEventDone(e);
      }
    }),
    useDrive.subscribe((s, prev) => {
      const added = s.items.filter(i => i.kind === 'file').length - prev.items.filter(i => i.kind === 'file').length;
      if (added > 0) onFilesUploaded(added);
    }),
  ];
  const greetTimer = setTimeout(greet, 1500);
  const first = setTimeout(periodicCheck, 25_000);
  const interval = setInterval(periodicCheck, 2 * 60_000);
  return () => {
    unsubs.forEach(u => u());
    clearTimeout(greetTimer);
    clearTimeout(first);
    clearInterval(interval);
  };
}

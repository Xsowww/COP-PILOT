// Executes the buttons Kompaly offers in its remarks ("Planifier mes révisions", …).

import { useCopilot, type CopilotOffer, type CopilotLink } from '../store/copilot';
import { useCalendar } from '../store/calendar';
import { useTodos } from '../store/todos';
import type { Note } from '../store/notes';
import { createRevisionNote, planRevisions, goTo, linkToNote, linkToDay, deleteEvent, trashItems } from './actions';
import { fmt, fromKey } from '../lib/dates';

type OfferResult = { text: string; links?: CopilotLink[] };

/** What the student did with buttons since the AI last spoke (it doesn't see the clicks otherwise). */
export const offerLog: string[] = [];

export function runOffer(offer: CopilotOffer): OfferResult {
  const r = run(offer);
  offerLog.push(`« ${offer.label} » → ${r.text}`);
  if (offerLog.length > 5) offerLog.shift();
  return r;
}

/** No slot left before the exam: only the revision sheet. */
function tooLate(note: Note | null): OfferResult {
  return {
    text: "Plus le temps de caler une séance avant l'examen. Je t'ai quand même préparé une fiche pour une dernière relecture.",
    links: note ? [{ label: 'Ouvrir la fiche', to: linkToNote(note.id) }] : [],
  };
}

function run(offer: CopilotOffer): OfferResult {
  const p = offer.payload ?? {};
  switch (offer.kind) {
    case 'plan_revisions': {
      const res = planRevisions(p.eventId, Number(p.sessions) || 3);
      if (!res) return { text: "Je ne retrouve plus cet examen, il a peut-être été supprimé." };
      if (!res.created.length) return tooLate(res.note);
      const days = res.created.map(e => fmt(fromKey(e.date), 'EEEE d')).join(', ');
      return {
        text: `C'est calé : ${res.created.length} séance${res.created.length > 1 ? 's' : ''} de révision (${days}) et une fiche « ${res.note?.title} » pour t'organiser. Tu me remercieras le jour J.`,
        links: [
          { label: 'Voir le planning', to: linkToDay(res.created[0].date) },
          ...(res.note ? [{ label: 'Ouvrir la fiche', to: linkToNote(res.note.id) }] : []),
        ],
      };
    }
    case 'revision_note': {
      const note = createRevisionNote(p.eventId);
      if (!note) return { text: "Je ne retrouve plus cet examen." };
      return { text: `Fiche « ${note.title} » prête, avec une structure pour aller à l'essentiel.`, links: [{ label: 'Ouvrir la fiche', to: linkToNote(note.id) }] };
    }
    case 'mark_done': {
      const ev = useCalendar.getState().events.find(e => e.id === p.eventId);
      if (!ev) return { text: 'Introuvable, il a dû être supprimé.' };
      if (!ev.done) useCalendar.getState().toggleDone(ev.id);
      return { text: `« ${ev.title} » coché. Un de moins !` };
    }
    case 'open':
      goTo(p.to ?? '/');
      return { text: "C'est ouvert." };
    case 'confirm_delete': {
      // Deletions asked to the AI only happen here, on the student's click (or « oui »).
      const ids = (p.ids ?? '').split(',').filter(Boolean);
      if (p.what === 'event') {
        const ev = deleteEvent(ids[0]);
        return ev ? { text: `« ${ev.title} » est dans la corbeille, récupérable 30 jours.`, links: [{ label: 'Corbeille', to: '/corbeille?type=calendrier' }] } : { text: 'Introuvable, il a déjà dû être supprimé.' };
      }
      if (p.what === 'todo') {
        const t = useTodos.getState().todos.find(x => x.id === ids[0]);
        if (!t) return { text: 'Introuvable, elle a déjà dû être supprimée.' };
        useTodos.getState().remove(t.id);
        return { text: `Tâche « ${t.title} » supprimée.` };
      }
      const res = trashItems(ids);
      return res.done.length ? { text: `Mis à la corbeille : ${res.done.join(', ')}. Récupérable 30 jours.`, links: [{ label: 'Corbeille', to: '/corbeille' }] } : { text: 'Introuvable, déjà supprimé.' };
    }
  }
}

/** Runs an offer from a button (or a "oui") and reports back in the conversation. */
export function acceptOffer(offer: CopilotOffer) {
  const cop = useCopilot.getState();
  cop.push('user', offer.label);
  const reply = runOffer(offer);
  if (useCopilot.getState().pose === 'open') cop.push('bot', reply.text, { links: reply.links });
  else cop.say({ text: reply.text, links: reply.links, mood: 'happy' });
  return reply;
}

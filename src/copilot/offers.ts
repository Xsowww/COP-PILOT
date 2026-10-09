// Executes the buttons Copilot offers in its remarks ("Planifier mes révisions", …).

import { useCopilot, type CopilotOffer, type CopilotLink } from '../store/copilot';
import { useCalendar } from '../store/calendar';
import { createRevisionNote, planRevisions, goTo, linkToNote, linkToDay } from './actions';
import { fmt, fromKey } from '../lib/dates';

export function runOffer(offer: CopilotOffer): { text: string; links?: CopilotLink[] } {
  const p = offer.payload ?? {};
  switch (offer.kind) {
    case 'plan_revisions': {
      const res = planRevisions(p.eventId, Number(p.sessions) || 3);
      if (!res) return { text: "Je ne retrouve plus cet examen, il a peut-être été supprimé." };
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

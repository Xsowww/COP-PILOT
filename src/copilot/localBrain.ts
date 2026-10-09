// Built-in French command engine: works offline, no API key needed.

import { addDays } from 'date-fns';
import { normalize } from '../lib/utils';
import { parseQuickAdd, toKey, todayKey, fmt, fromKey } from '../lib/dates';
import { CATEGORIES } from '../store/calendar';
import type { CopilotLink } from '../store/copilot';
import {
  search,
  calendarReport,
  createNote,
  createDriveFolder,
  addEvent,
  eventsBetween,
  describeEvent,
  linkToNote,
  linkToDriveFolder,
  linkToDay,
  listDriveFolder,
  overview,
} from './actions';
import { useNotes } from '../store/notes';

export interface BotReply {
  text: string;
  links?: CopilotLink[];
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const unquote = (s: string) => s.trim().replace(/^["'«“]\s*|\s*["'»”]$/g, '').trim();

export function localReply(raw: string): BotReply {
  const input = raw.trim();
  const q = normalize(input);

  // ── Create a note ─────────────────────────────────────────────────────────
  let m = input.match(/(?:cr[ée]e|cr[ée]er|fais|faire|[ée]cris|ajoute|nouvelle)\s+(?:moi\s+)?(?:une\s+)?note\s*(?:qui s'appelle|appel[ée]e|intitul[ée]e|nomm[ée]e|sur|:)?\s*(.*)$/i);
  if (m) {
    let rest = m[1];
    let content = '';
    let folder: string | undefined;
    const colon = rest.indexOf(':');
    if (colon >= 0) {
      content = rest.slice(colon + 1).trim();
      rest = rest.slice(0, colon);
    }
    const inFolder = rest.match(/\s+dans\s+(?:le\s+dossier\s+)?(.+)$/i);
    if (inFolder) {
      folder = unquote(inFolder[1]);
      rest = rest.slice(0, inFolder.index);
    }
    const title = unquote(rest) || 'Note de Copilot';
    const note = createNote(title, content, folder);
    return {
      text: `C'est fait ✍️ J'ai créé la note « ${note.title} »${folder ? ` dans le dossier « ${folder} »` : ''}.${content ? '' : ' Tu peux écrire dedans maintenant !'}`,
      links: [{ label: 'Ouvrir la note', to: linkToNote(note.id) }],
    };
  }

  // ── Create a folder ───────────────────────────────────────────────────────
  m = input.match(/(?:cr[ée]e|cr[ée]er|fais|ajoute|nouveau)\s+(?:moi\s+)?(?:un\s+)?dossier\s*(?:qui s'appelle|appel[ée]|nomm[ée]|:)?\s*(.*)$/i);
  if (m) {
    let rest = m[1];
    const forNotes = /\b(notes?)\b/i.test(rest) && /dans (les |mes )?notes/i.test(rest);
    rest = rest.replace(/\s+dans\s+(les\s+|mes\s+)?notes\s*$/i, '').replace(/\s+dans\s+(le\s+)?drive\s*$/i, '');
    let parent: string | undefined;
    const inFolder = rest.match(/\s+dans\s+(?:le\s+dossier\s+)?(.+)$/i);
    if (inFolder) {
      parent = unquote(inFolder[1]);
      rest = rest.slice(0, inFolder.index);
    }
    const name = unquote(rest) || 'Nouveau dossier';
    if (forNotes) {
      const f = useNotes.getState().createFolder(name, null);
      return { text: `Dossier de notes « ${f.name} » créé 📂`, links: [{ label: 'Voir mes notes', to: `/notes?dossier=${f.id}` }] };
    }
    const f = createDriveFolder(name, parent);
    return { text: `Dossier « ${f.name} » créé dans le Drive 📁`, links: [{ label: 'Ouvrir le dossier', to: linkToDriveFolder(f.id) }] };
  }

  // ── Add an event ──────────────────────────────────────────────────────────
  m = input.match(/^(?:ajoute|ajouter|planifie|programme|rappelle[- ]moi|note dans (?:le|mon) calendrier|mets?)\s+(?:un\s+|une\s+)?(?:[ée]v[ée]nement\s+|rdv\s+|rendez-vous\s+)?(.*)$/i);
  if (m && !/\bnote\b/i.test(m[1].split(' ')[0])) {
    const parsed = parseQuickAdd(m[1]);
    if (parsed.title) {
      const date = parsed.date ?? todayKey();
      const ev = addEvent({ title: parsed.title, date, start: parsed.start ?? undefined, end: parsed.end ?? undefined });
      return {
        text: `Ajouté au calendrier ! ${describeEvent(ev)}${parsed.date ? '' : "\n(Pas de date trouvée, je l'ai mis aujourd'hui — tu peux le déplacer.)"}`,
        links: [{ label: 'Voir le jour', to: linkToDay(ev.date) }],
      };
    }
  }

  // ── Analyse calendar ──────────────────────────────────────────────────────
  if (/(analys|resum|bilan|point sur|charge|organis).*(calendrier|semaine|planning|agenda|emploi du temps)|(calendrier|semaine|planning).*(analys|resum|bilan)/.test(q)) {
    return calendarReport();
  }

  // ── What's on today / tomorrow / this week ───────────────────────────────
  if (/(qu'?est-ce que|quoi|j'ai quoi|programme|prevu|au menu).*(aujourd'?hui|ce jour)|^aujourd'?hui\s*\??$/.test(q)) {
    const list = eventsBetween(todayKey(), todayKey());
    return {
      text: list.length ? `Aujourd'hui :\n${list.map(describeEvent).join('\n')}` : "Rien de prévu aujourd'hui 🎉",
      links: [{ label: "Voir aujourd'hui", to: linkToDay(todayKey()) }],
    };
  }
  if (/(qu'?est-ce que|quoi|j'ai quoi|programme|prevu).*demain|^demain\s*\??$/.test(q)) {
    const d = toKey(addDays(new Date(), 1));
    const list = eventsBetween(d, d);
    return { text: list.length ? `Demain :\n${list.map(describeEvent).join('\n')}` : 'Demain est libre pour le moment 👌', links: [{ label: 'Voir demain', to: linkToDay(d) }] };
  }
  if (/(examen|exam|partiel|controle)s?/.test(q) && /(quand|prochain|liste|quels|mes|a venir)/.test(q)) {
    const exams = eventsBetween(todayKey(), '9999-12-31').filter(e => e.category === 'examen');
    return {
      text: exams.length ? `Tes prochains examens ${CATEGORIES.examen.emoji} :\n${exams.slice(0, 6).map(describeEvent).join('\n')}` : "Aucun examen à l'horizon. Ajoute-les pour que je t'aide à t'organiser !",
      links: [{ label: 'Calendrier', to: '/calendrier' }],
    };
  }

  // ── List a Drive folder ───────────────────────────────────────────────────
  m = input.match(/(?:qu'?y a[- ]t[- ]il|qu'est-ce qu'il y a|contenu|montre(?:-moi)?|liste)\s+(?:dans\s+|du\s+|le\s+)?(?:le\s+|mon\s+)?(?:dossier\s+)?(.+)$/i);
  if (m && !/(calendrier|semaine|notes?$)/i.test(m[1])) {
    const target = unquote(m[1].replace(/\?$/, ''));
    const res = /^(drive|mon drive|mes fichiers)$/i.test(target) ? listDriveFolder() : listDriveFolder(target);
    if (res) {
      return {
        text: res.content.length
          ? `Dans « ${res.folder} » (${res.content.length} élément${res.content.length > 1 ? 's' : ''}) :\n${res.content.slice(0, 12).map(c => `${c.type === 'dossier' ? '📁' : '📄'} ${c.name}${c.size ? ` · ${c.size}` : ''}`).join('\n')}`
          : `Le dossier « ${res.folder} » est vide.`,
        links: [{ label: 'Ouvrir', to: res.link }],
      };
    }
  }

  // ── Find something ────────────────────────────────────────────────────────
  m = input.match(/(?:trouve|cherche|recherche|o[uù] est|o[uù] sont|retrouve|j'ai perdu|localise)\s*(?:-moi)?\s+(?:le |la |les |l'|mon |ma |mes |un |une )?(?:dossier |fichier |note |document |cours )?(.+)$/i);
  if (m) {
    const term = unquote(m[1].replace(/\?$/, ''));
    const hits = search(term);
    if (!hits.length) return { text: `Je n'ai rien trouvé pour « ${term} » 🤔 Essaie avec un autre mot ?` };
    return {
      text: `J'ai trouvé ${hits.length} résultat${hits.length > 1 ? 's' : ''} pour « ${term} » :\n${hits.map(h => `• ${h.title} (${h.type}) — ${h.where}`).join('\n')}`,
      links: hits.slice(0, 4).map(h => ({ label: h.title, to: h.to })),
    };
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  if (/(ouvre|va|aller|emmene|montre).*(drive|fichiers)/.test(q)) return { text: 'On y va 🚀', links: [{ label: 'Drive', to: '/drive' }] };
  if (/(ouvre|va|aller|emmene|montre).*(calendrier|agenda|planning)/.test(q)) return { text: 'Direction le calendrier 📅', links: [{ label: 'Calendrier', to: '/calendrier' }] };
  if (/(ouvre|va|aller|emmene|montre).*notes/.test(q)) return { text: 'Tes notes t\'attendent 📝', links: [{ label: 'Notes', to: '/notes' }] };
  if (/(ouvre|va|aller|emmene|montre).*(dashboard|accueil|tableau)/.test(q)) return { text: 'Retour au QG 🏠', links: [{ label: 'Dashboard', to: '/' }] };

  // ── Overview ──────────────────────────────────────────────────────────────
  if (/(resume|bilan|vue d'ensemble|etat|statistiques|stats)/.test(q)) {
    const o = overview();
    return {
      text: `Petit bilan 📊\n📁 Drive : ${o.drive.folders} dossiers, ${o.drive.files} fichiers (${o.drive.totalSize})\n📝 Notes : ${o.notes.count} notes\n📅 Cette semaine : ${o.calendar.weekCount} événements${o.calendar.exams.length ? `, ${o.calendar.exams.length} examen(s) à venir` : ''}`,
    };
  }

  // ── Small talk ────────────────────────────────────────────────────────────
  if (/^(salut|bonjour|hello|hey|yo|coucou|bonsoir|wesh|cc)\b/.test(q)) {
    return { text: pick(['Salut ! 👋 Je surveillais ton écran, tout roule ?', 'Hey ! Besoin d\'un coup de main ?', 'Coucou 😄 Qu\'est-ce que je peux faire pour toi ?']) };
  }
  if (/(merci|super|genial|top|parfait|nickel)/.test(q)) return { text: pick(['Avec plaisir 😎', 'Toujours là pour toi !', 'De rien, je retourne me cacher derrière l\'écran 👀']) };
  if (/(qui es[- ]tu|t'es qui|c'est quoi ton nom|presente)/.test(q)) {
    return { text: "Moi c'est Copilot 🤖 Je vis sur le bord de ton écran. Je peux chercher tes fichiers, analyser ton calendrier, créer des notes, des dossiers et des événements. Demande-moi !" };
  }
  if (/(fatigue|stress|motivation|demotive|j'en peux plus|flemme)/.test(q)) {
    return { text: pick(["Respire 🌬️ Une chose à la fois. Choisis LA tâche la plus petite et fais-la maintenant, le reste suivra.", 'Méthode Pomodoro : 25 min de focus, 5 min de pause. Tu veux que je te bloque un créneau de révision dans le calendrier ?']) };
  }

  return {
    text:
      "Je n'ai pas tout compris 😅 Voilà ce que je sais faire :\n• « Trouve le dossier Maths »\n• « Analyse mon calendrier »\n• « Crée une note Révisions histoire : chapitre 3 »\n• « Ajoute Exam de physique vendredi 10h »\n• « Crée un dossier Stage dans Projets »\n• « Qu'est-ce que j'ai demain ? »",
  };
}

export function welcomeLine(name: string): string {
  const h = new Date().getHours();
  const hello = h < 6 ? 'Encore debout' : h < 12 ? 'Bonjour' : h < 18 ? 'Hello' : 'Bonsoir';
  const today = eventsBetween(todayKey(), todayKey()).filter(e => !e.done);
  return `${hello} ${name} ! ${today.length ? `Tu as ${today.length} truc${today.length > 1 ? 's' : ''} aujourd'hui (${fmt(fromKey(todayKey()), 'EEEE')}).` : "Journée libre aujourd'hui 😎"} Clique-moi si tu as besoin.`;
}

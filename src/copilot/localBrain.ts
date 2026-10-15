// Built-in French command engine: works offline, no API key needed.

import { addDays } from 'date-fns';
import { normalize } from '../lib/utils';
import { parseQuickAdd, toKey, todayKey, daysUntil, fmt, fromKey } from '../lib/dates';
import { useCalendar } from '../store/calendar';
import { buildQuiz, checkAnswer, type Quiz } from './quiz';
import {
  addTodo, listTodos, completeTodo, deleteTodo, listTrash, findInTrash, restoreFromTrash, trashItems, deleteEvent, renameItem, moveItem,
  itemName, linkToItem, setStar, setFolderColor, searchNotes, findNote, startFocus, stopFocus, updateSettings,
} from './actions';
import type { CopilotLink, CopilotOffer } from '../store/copilot';
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
import { useCopilot } from '../store/copilot';
import { runOffer } from './offers';
import { findExam, planRevisions } from './actions';

export interface BotReply {
  text: string;
  links?: CopilotLink[];
  offers?: CopilotOffer[];
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const unquote = (s: string) => s.trim().replace(/^["'«“]\s*|\s*["'»”]$/g, '').trim();

// ── Things waiting for the student's next message ───────────────────────────

/** A destructive action announced and waiting for « oui ». */
let pendingConfirm: { run: () => BotReply } | null = null;
let quiz: Quiz | null = null;

const ask = (text: string, run: () => BotReply): BotReply => {
  pendingConfirm = { run };
  return { text: `${text} Tu confirmes ? (oui / non)` };
};

const YES = /^(oui|ouais|ouep|ok|okay|vas[- ]y|go|carrement|d'accord|dac|yes|confirme|je confirme|c'est bon)\b/;
const NO = /^(non|nan|annule|laisse|nope|non merci|pas maintenant|surtout pas)\b/;

function quizQuestion(z: Quiz) {
  return `**Question ${z.index + 1}/${z.questions.length}.** ${z.questions[z.index].q}`;
}

function quizStep(input: string, q: string): BotReply {
  const z = quiz!;
  const cur = z.questions[z.index];
  if (/^(stop|arrete|fin|termine|j'arrete|on arrete)\b/.test(q)) {
    quiz = null;
    return { text: `Quiz arrêté. Score : ${z.score}/${z.index}. On remet ça quand tu veux.`, links: [{ label: `Revoir « ${z.title} »`, to: linkToNote(z.noteId) }] };
  }
  let feedback: string;
  if (/^(passe|je sais pas|je ne sais pas|aucune idee|joker|\?+)$/.test(q)) feedback = `La réponse : ${cur.answer}`;
  else {
    const verdict = checkAnswer(cur, input);
    if (verdict === 'good') {
      z.score++;
      feedback = pick(['Bien vu !', 'Exact.', 'Parfait, c’est ça.', 'Yes, bonne réponse.']) + (cur.mode === 'keywords' ? ` Pour compléter : ${cur.answer}` : '');
    } else if (verdict === 'partial') {
      z.score += 0.5;
      feedback = `En partie. Ce qu'il fallait dire : ${cur.answer}`;
    } else feedback = `Pas tout à fait. La réponse : ${cur.answer}`;
  }
  z.index++;
  if (z.index < z.questions.length) return { text: `${feedback}\n\n${quizQuestion(z)}` };
  quiz = null;
  const total = z.questions.length;
  const verdict = z.score >= total * 0.8 ? 'Tu maîtrises.' : z.score >= total * 0.5 ? 'Pas mal, encore un petit tour sur la note et ce sera bon.' : 'Relis la note tranquillement, puis on recommence.';
  return { text: `${feedback}\n\n**Score : ${z.score}/${total}.** ${verdict}`, links: [{ label: `Ouvrir « ${z.title} »`, to: linkToNote(z.noteId) }] };
}

const COLOR_WORDS: Record<string, string> = { bleu: 'bleu', rouge: 'rouge', orange: 'orange', jaune: 'jaune', vert: 'vert', violet: 'violet', rose: 'rose', gris: 'gris' };
const ACCENT_WORDS: Record<string, string> = { orange: 'orange', bleu: 'bleu', bleue: 'bleu', vert: 'vert', verte: 'vert', violet: 'violet', violette: 'violet', rose: 'rose', framboise: 'rose', encre: 'encre', noir: 'encre', noire: 'encre' };

/** Commands added for the to-dos, the trash, the Drive organisation, focus, settings and quizzes. */
function moreCommands(input: string, q: string): BotReply | null {
  // `q` is normalize(input): same length, so indices found in `q` cut the original text.
  const grab = (re: RegExp) => {
    const m = re.exec(q);
    if (!m) return null;
    const ix = (m as RegExpExecArray & { indices?: [number, number][] }).indices;
    return (i: number) => (ix?.[i] ? unquote(input.slice(ix[i][0], ix[i][1])) : '');
  };

  // ── Quiz ──
  let g = grab(/^(?:interroge|questionne|teste|quizz?)[- ]?(?:moi)?\s+(?:sur|en)\s+(?:la note\s+|ma note\s+|le cours\s+(?:de\s+)?)?(.+?)\s*\??$/d);
  if (g) {
    const term = g(1);
    const note = findNote(term) ?? (() => {
      const hit = search(term).find(h => h.type === 'note');
      return hit ? findNote(hit.id) : undefined;
    })();
    if (!note) return { text: `Je ne trouve pas de note « ${term} ». Donne-moi le titre exact ?` };
    const z = buildQuiz(note);
    if (!z) return { text: `« ${note.title} » n'a pas assez de structure pour que je t'interroge (titres, listes « terme : définition » ou mots en gras). Ajoute-en un peu et on y va.`, links: [{ label: 'Ouvrir la note', to: linkToNote(note.id) }] };
    quiz = z;
    return { text: `C'est parti : ${z.questions.length} question${z.questions.length > 1 ? 's' : ''} sur « ${note.title} ». Réponds comme tu veux, « passe » pour voir la réponse, « stop » pour arrêter.\n\n${quizQuestion(z)}` };
  }

  // ── To-dos ──
  g = grab(/^(?:ajoute|rajoute|note|cree|mets)\s+(?:moi\s+)?(?:une?\s+|la\s+)?(?:tache|todo|to-do|chose a faire)\s*:?\s+(.+)$/d) ?? grab(/^(?:a faire|todo)\s*:\s*(.+)$/d);
  if (g) {
    const parsed = parseQuickAdd(g(1));
    const t = addTodo(parsed.title || g(1), parsed.date ?? undefined);
    return { text: `Ajouté à ta liste : « ${t.title} »${t.due ? ` (pour ${describeDue(t.due)})` : ''}.` };
  }
  if (/(mes taches|ma liste|ma to-?do|liste (de|des) taches|qu'est-ce que j'ai a faire|qu'est-ce qu'il me reste a faire|il me reste quoi)/.test(q)) {
    const list = listTodos();
    if (!list.length) return { text: 'Ta liste est vide. Rien à faire… ou rien de noté ?' };
    return { text: `À faire (${list.length}) :\n${list.slice(0, 12).map(t => `- ${t.title}${t.due ? ` · ${describeDue(t.due)}${t.late ? ' (en retard)' : ''}` : ''}`).join('\n')}` };
  }
  g = grab(/^(?:coche|termine|valide)\s+(?:la tache\s+)?(.+)$/d) ?? grab(/^j'ai (?:fini|termine|fait)\s+(?:la tache\s+)?(.+)$/d);
  if (g) {
    const t = completeTodo(g(1));
    if (t) return { text: `« ${t.title} » coché. Un de moins !` };
    if (/^coche/.test(q)) return { text: `Je ne trouve pas « ${g(1)} » dans ta liste de tâches.` };
  }
  g = grab(/^(?:supprime|enleve|retire|efface)\s+(?:la tache\s+)(.+)$/d) ?? grab(/^(?:enleve|retire)\s+(.+?)\s+de (?:ma|la) liste$/d);
  if (g) {
    const t = deleteTodo(g(1));
    return { text: t ? `« ${t.title} » retiré de ta liste.` : `Je ne trouve pas « ${g(1)} » dans ta liste.` };
  }

  // ── Trash ──
  if (/corbeille/.test(q) && /(qu'y a|qu'est-ce qu|montre|liste|contenu|dans la|ouvre|voir)/.test(q) && !/(mets|deplace|envoie|jette)/.test(q)) {
    const list = listTrash();
    const links = [{ label: 'Ouvrir la corbeille', to: '/corbeille' }];
    if (!list.length) return { text: 'La corbeille est vide.', links };
    return { text: `Dans la corbeille (${list.length}) :\n${list.slice(0, 12).map(t => `- ${t.name} (${t.type}, supprimé le ${t.deleted})`).join('\n')}\nDis-moi « restaure … » pour récupérer quelque chose.`, links };
  }
  g = grab(/^(?:restaure|recupere|remets|ramene)\s+(.+?)(?:\s+(?:de|depuis) la corbeille)?$/d);
  if (g && findInTrash(g(1))) {
    const res = restoreFromTrash([g(1)]);
    return { text: `« ${res.restored.join(', ')} » est de retour à sa place.`, links: res.links.map(l => ({ ...l, label: 'Ouvrir' })) };
  }
  g = grab(/^(?:supprime|efface|jette|mets|envoie|deplace)\s+(?:le fichier\s+|le dossier\s+|la note\s+|le document\s+)?(.+?)(?:\s+(?:a|dans) la corbeille)?$/d);
  if (g && /^(supprime|efface|jette)|corbeille/.test(q)) {
    const term = g(1);
    const wantsEvent = /(evenement|rdv|rendez-vous)/.test(q);
    const hit = search(term.replace(/^(l'|le |la )?(evenement|événement|rdv|rendez-vous)\s+/i, '')).find(h => (wantsEvent ? h.type === 'événement' : true));
    if (!hit) return { text: `Je ne trouve rien qui s'appelle « ${term} ».` };
    if (hit.type === 'événement') {
      const ev = useCalendar.getState().events.find(e => e.id === hit.id)!;
      return ask(`Je mets « ${describeEvent(ev)} » à la corbeille ? Tu pourras le récupérer pendant 30 jours.`, () => {
        deleteEvent(ev.id);
        return { text: `« ${ev.title} » est dans la corbeille. Dis « restaure ${ev.title} » si tu changes d'avis.` };
      });
    }
    return ask(`Je mets « ${hit.title} » (${hit.type}, ${hit.where}) à la corbeille ? Tu pourras le récupérer pendant 30 jours.`, () => {
      const res = trashItems([hit.id]);
      return { text: res.done.length ? `« ${hit.title} » est dans la corbeille. Dis « restaure ${hit.title} » si tu changes d'avis.` : 'Il a déjà disparu.' };
    });
  }

  // ── Drive & notes organisation ──
  g = grab(/^renomme\s+(?:le fichier\s+|le dossier\s+|la note\s+)?(.+?)\s+en\s+(.+)$/d);
  if (g) {
    const hit = search(g(1)).find(h => h.type !== 'événement');
    if (!hit) return { text: `Je ne trouve pas « ${g(1)} ».` };
    const s = renameItem(hit.id, g(2));
    return s ? { text: `Renommé en « ${itemName(s)} ».`, links: [{ label: 'Voir', to: linkToItem(s) }] } : { text: 'Le nouveau nom est vide.' };
  }
  g = grab(/^(?:deplace|range)\s+(?:le fichier\s+|le dossier\s+|la note\s+)?(.+?)\s+dans\s+(?:le dossier\s+)?(.+)$/d);
  if (g) {
    const hit = search(g(1)).find(h => h.type !== 'événement');
    if (!hit) return { text: `Je ne trouve pas « ${g(1)} ».` };
    const res = moveItem(hit.id, /^(la )?racine$/i.test(g(2)) ? undefined : g(2));
    if ('error' in res) return { text: `Impossible : ${res.error}.` };
    return { text: `« ${itemName(res.moved)} » rangé dans « ${res.to} ».`, links: [{ label: 'Voir', to: linkToItem(res.moved) }] };
  }
  g = grab(/^(?:ajoute|mets)\s+(.+?)\s+(?:en|aux|dans les)\s+favoris$/d);
  if (g) {
    const hit = search(g(1)).find(h => h.type === 'fichier' || h.type === 'dossier');
    const it = hit && setStar(hit.id, true);
    return it ? { text: `« ${it.name} » ajouté aux favoris.` } : { text: `Je ne trouve pas « ${g(1)} » dans le Drive.` };
  }
  g = grab(/dossier\s+(.+?)\s+en\s+(bleu|rouge|orange|jaune|vert|violet|rose|gris)$/d);
  if (g) {
    const f = setFolderColor(g(1), COLOR_WORDS[g(2).toLowerCase()]);
    return f ? { text: `Le dossier « ${f.name} » est maintenant ${g(2).toLowerCase()}.`, links: [{ label: 'Voir', to: linkToDriveFolder(f.id) }] } : { text: `Je ne trouve pas le dossier « ${g(1)} ».` };
  }

  // ── Search inside notes ──
  g = grab(/^(?:cherche|trouve|recherche)\s+(.+?)\s+dans\s+(?:mes|les)\s+notes$/d);
  if (g) {
    const hits = searchNotes(g(1));
    if (!hits.length) return { text: `Aucune note ne parle de « ${g(1)} ».` };
    return {
      text: `« ${g(1)} » apparaît dans ${hits.length} note${hits.length > 1 ? 's' : ''} :\n${hits.slice(0, 5).map(h => `- **${h.title}**${h.excerpts[0] ? ` : ${h.excerpts[0]}` : ''}`).join('\n')}`,
      links: hits.slice(0, 3).map(h => ({ label: h.title, to: linkToNote(h.id) })),
    };
  }

  // ── Focus ──
  if (/(arrete|stoppe|stop|termine|coupe)\s+(la |ma )?(session|pomodoro|focus|minuteur)/.test(q)) {
    const res = stopFocus();
    return { text: res ? 'Session arrêtée. Pense à faire une vraie pause.' : "Il n'y a pas de session en cours." };
  }
  g = grab(/(?:lance|demarre|commence|on fait)\s+(?:une\s+|la\s+)?(?:session(?:\s+(?:de\s+)?(?:focus|travail|revision))?|pomodoro|focus)(?:\s+(?:sur|en|de|pour)\s+(.+))?$/d);
  if (g) {
    const res = startFocus(g(1).replace(/^(?:la |le |les |l'|l’|mes |ma |mon )/i, ''));
    return { text: `C'est parti pour ${res.minutes} minutes${res.subject ? ` sur « ${res.subject} »` : ''}. Téléphone retourné, je veille.` };
  }

  // ── Settings ──
  let m = q.match(/(?:mode|theme)\s+(sombre|nuit|noir|clair|jour|auto|automatique)/);
  if (m) {
    const theme = /sombre|nuit|noir/.test(m[1]) ? 'sombre' : /clair|jour/.test(m[1]) ? 'clair' : 'auto';
    updateSettings({ theme });
    return { text: `Thème ${theme === 'auto' ? 'automatique (comme ton système)' : theme} enregistré.`, links: [{ label: 'Réglages', to: '/profil' }] };
  }
  m = q.match(/(?:couleur|accent).*?\b(orange|bleue?|verte?|violette?|rose|framboise|encre|noire?)\b/);
  if (m) {
    updateSettings({ accent: ACCENT_WORDS[m[1]] });
    return { text: 'Nouvelle couleur appliquée. Joli casque.' };
  }
  if (/(reduis|desactive|coupe|enleve|moins d')\s*(les )?animations/.test(q)) {
    updateSettings({ reduceMotion: true });
    return { text: 'Animations réduites. Je bougerai moins, promis.' };
  }
  if (/(active|remets|reactive)\s+(les )?animations/.test(q)) {
    updateSettings({ reduceMotion: false });
    return { text: 'Animations réactivées.' };
  }
  if (/(sois|parle|fais)\s.*(plus )?(discret|calme|moins bavard|tais-toi)|^tais[- ]toi/.test(q)) {
    updateSettings({ chattiness: 'calme' });
    return { text: 'Compris, je me fais discret. Je reste là si tu as besoin.' };
  }
  if (/(sois|parle).*(plus )?bavard|parle[- ]moi plus/.test(q)) {
    updateSettings({ chattiness: 'bavard' });
    return { text: 'Ah ça, ça me plaît. Je passerai plus souvent la tête.' };
  }
  return null;
}

const describeDue = (key: string) => {
  const d = daysUntil(key);
  return d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : d === -1 ? 'hier' : fmt(fromKey(key), 'EEEE d MMM');
};

export function localReply(raw: string): BotReply {
  const input = raw.trim();
  const q = normalize(input);

  // ── Waiting for a confirmation ────────────────────────────────────────────
  if (pendingConfirm) {
    const p = pendingConfirm;
    pendingConfirm = null;
    if (YES.test(q)) return p.run();
    if (NO.test(q)) return { text: "Ok, je n'y touche pas." };
  }

  // ── Quiz in progress: every message is an answer ─────────────────────────
  if (quiz) return quizStep(input, q);

  const more = moreCommands(input, q);
  if (more) return more;

  // ── Answer to Kompaly's last proposal ─────────────────────────────────────
  const offer = useCopilot.getState().pendingOffer;
  if (offer && /^(oui|ouais|ouep|ok|okay|vas[- ]y|go|carrement|d'accord|dac|yes|let'?s go|avec plaisir|je veux bien|volontiers|bonne idee)\b/.test(q)) {
    return runOffer(offer);
  }
  if (offer && /^(non|nan|pas maintenant|plus tard|laisse|nope|non merci)\b/.test(q)) {
    return { text: pick(["Ok, je n'insiste pas. Je reste dans le coin.", 'Pas de souci, on verra plus tard.']) };
  }

  // ── Plan revisions ────────────────────────────────────────────────────────
  if (/(planifi|organis|prepar|cale|programm).*(revision|revis)|(revision|reviser).*(planifi|organis)/.test(q)) {
    const subject = q.replace(/.*\b(pour|de|du|d')\s*(l'|le |la |mon |ma )?/, '').replace(/(examen|exam|partiel|controle|\?)/g, '').trim();
    const exam = findExam(subject.length > 2 ? subject : '') ?? findExam('');
    if (!exam) return { text: "Je ne vois aucun examen à venir dans ton calendrier. Ajoute-le et je m'occupe du reste." };
    const res = planRevisions(exam.id)!;
    if (!res.created.length) {
      return {
        text: `Plus le temps de caler une séance avant « ${exam.title} ». Je t'ai quand même préparé une fiche pour une dernière relecture.`,
        links: res.note ? [{ label: 'Ouvrir la fiche', to: linkToNote(res.note.id) }] : [],
      };
    }
    return {
      text: `Pour « ${exam.title} », je t'ai calé ${res.created.length} séance${res.created.length > 1 ? 's' : ''} de révision et une fiche pour t'organiser.`,
      links: [
        { label: 'Voir le planning', to: linkToDay(res.created[0].date) },
        ...(res.note ? [{ label: 'Ouvrir la fiche', to: linkToNote(res.note.id) }] : []),
      ],
    };
  }

  // ── Jokes ─────────────────────────────────────────────────────────────────
  if (/(blague|fais[- ]moi rire|raconte.*(truc|histoire) drole|une vanne)/.test(q)) {
    return {
      text: pick([
        "Pourquoi les étudiants aiment les ascenseurs ? Parce que c'est le seul endroit où ils prennent de l'avance.",
        "J'ai voulu réviser avec toi, mais j'ai paniqué en voyant le programme. Je suis qu'un petit casque, moi.",
        "Un partiel, c'est comme une série : tu ne regardes pas le dernier épisode sans avoir vu les précédents. Enfin… en théorie.",
        "Mon prof de maths m'a dit que j'étais moyen. C'était méchant, mais statistiquement juste.",
      ]),
    };
  }

  // ── Reminder: « rappelle-moi ce soir 17h d'étendre le linge » ───────────────
  if (/(rappel|rappelle[- ]moi|fais[- ]moi penser|pense a me dire)/.test(q)) {
    const parsed = parseQuickAdd(input);
    // Date/heure retirées par parseQuickAdd, puis tout ce qui précède le sujet du rappel.
    let what = (parsed.title || input).replace(/\b(?:stp|s'il te pla[iî]t|svp|merci)\b/gi, '').replace(/\s+[àa]\s*(?=\s|$)/g, ' ');
    const after = what.match(/\b(?:que je (?:dois|doit|devrais)|qu'il faut que je|de ne pas oublier d(?:e\s|'))\s*(.+)$/i) ?? what.match(/\b(?:rappel(?:le[- ]moi)?|fais[- ]moi penser|pense [àa] me dire)\b.*?\b(?:d'|de\s|pour\s)\s*(.+)$/i);
    what = (after ? after[1] : '').replace(/[\s,.!]+$/, '').trim();
    if (what) {
      const title = what.charAt(0).toUpperCase() + what.slice(1);
      const ev = addEvent({ title, date: parsed.date ?? todayKey(), start: parsed.start ?? undefined, category: 'perso' });
      return { text: `C'est noté : ${describeEvent(ev)}. Je te le rappellerai.`, links: [{ label: 'Voir le jour', to: linkToDay(ev.date) }] };
    }
  }

  // ── Revision sheet: « crée une fiche de révision de maths dans le dossier Cours » ──
  let m = input.match(/(?:cr[ée]e|cr[ée]er|fais|faire|pr[ée]pare|[ée]cris)\s+(?:moi\s+)?(?:une\s+)?(?:petite\s+)?fiche(?:\s+de\s+r[ée]vision)?(?:\s+(?:de|d'|en|sur|pour)\s*(.+?))?(?:\s+dans\s+(?:le\s+dossier\s+)?(.+?))?(?:\s+dans\s+(?:les\s+|mes\s+)?notes)?\s*[.!?]*$/i);
  if (m) {
    const subject = m[1] ? unquote(m[1]) : '';
    const folder = m[2] && !/^(?:les |mes )?notes$/i.test(m[2]) ? unquote(m[2]) : undefined;
    const title = `Fiche de révision${subject ? ` — ${subject.charAt(0).toUpperCase() + subject.slice(1)}` : ''}`;
    const note = createNote(title, '# Notions clés\n- \n# Définitions\n- \n# Formules / dates à retenir\n- \n# Exemples\n- \n# Je me teste\n- ', folder);
    return {
      text: `C'est fait : « ${note.title} »${folder ? ` dans le dossier « ${folder} »` : ''}, avec un plan prêt à remplir. (Avec l'IA, je peux aussi la remplir pour toi.)`,
      links: [{ label: 'Ouvrir la fiche', to: linkToNote(note.id) }],
    };
  }

  // ── Create a note ─────────────────────────────────────────────────────────
  m = input.match(/(?:cr[ée]e|cr[ée]er|fais|faire|[ée]cris|ajoute|nouvelle)\s+(?:moi\s+)?(?:une\s+)?note\s*(?:qui s'appelle|appel[ée]e|intitul[ée]e|nomm[ée]e|sur|:)?\s*(.*)$/i);
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
    const title = unquote(rest) || 'Note de Kompaly';
    const note = createNote(title, content, folder);
    return {
      text: `C'est fait. J'ai créé la note « ${note.title} »${folder ? ` dans le dossier « ${folder} »` : ''}.${content ? '' : ' Tu peux écrire dedans maintenant !'}`,
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
      return { text: `Dossier de notes « ${f.name} »`, links: [{ label: 'Voir mes notes', to: `/notes?dossier=${f.id}` }] };
    }
    const f = createDriveFolder(name, parent);
    return { text: `Dossier « ${f.name} » créé dans le Drive`, links: [{ label: 'Ouvrir le dossier', to: linkToDriveFolder(f.id) }] };
  }

  // ── Add an event ──────────────────────────────────────────────────────────
  m = input.match(/^(?:ajoute|ajouter|planifie|programme|rappelle[- ]moi|note dans (?:le|mon) calendrier|mets?)\s+(?:un\s+|une\s+)?(?:[ée]v[ée]nement\s+|rdv\s+|rendez-vous\s+)?(.*)$/i);
  if (m && !/\bnote\b/i.test(m[1].split(' ')[0])) {
    const parsed = parseQuickAdd(m[1]);
    if (parsed.title) {
      const date = parsed.date ?? todayKey();
      const ev = addEvent({ title: parsed.title, date, start: parsed.start ?? undefined, end: parsed.end ?? undefined });
      return {
        text: `Ajouté au calendrier : ${describeEvent(ev)}${parsed.date ? '' : "\n(Pas de date trouvée, je l'ai mis aujourd'hui — tu peux le déplacer.)"}`,
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
      text: list.length ? `Aujourd'hui :\n${list.map(describeEvent).join('\n')}` : "Rien de prévu aujourd'hui.",
      links: [{ label: "Voir aujourd'hui", to: linkToDay(todayKey()) }],
    };
  }
  if (/(qu'?est-ce que|quoi|j'ai quoi|programme|prevu).*demain|^demain\s*\??$/.test(q)) {
    const d = toKey(addDays(new Date(), 1));
    const list = eventsBetween(d, d);
    return { text: list.length ? `Demain :\n${list.map(describeEvent).join('\n')}` : 'Demain est libre pour le moment.', links: [{ label: 'Voir demain', to: linkToDay(d) }] };
  }
  if (/(examen|exam|partiel|controle)s?/.test(q) && /(quand|prochain|liste|quels|mes|a venir)/.test(q)) {
    const exams = eventsBetween(todayKey(), '9999-12-31').filter(e => e.category === 'examen');
    return {
      text: exams.length ? `Tes prochains examens :\n${exams.slice(0, 6).map(describeEvent).join('\n')}` : "Aucun examen à l'horizon. Ajoute-les pour que je t'aide à t'organiser !",
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
    if (!hits.length) return { text: `Je n'ai rien trouvé pour « ${term} ». Essaie avec un autre mot ?` };
    return {
      text: `J'ai trouvé ${hits.length} résultat${hits.length > 1 ? 's' : ''} pour « ${term} » :\n${hits.map(h => `• ${h.title} (${h.type}) — ${h.where}`).join('\n')}`,
      links: hits.slice(0, 4).map(h => ({ label: h.title, to: h.to })),
    };
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  if (/(ouvre|va|aller|emmene|montre).*(drive|fichiers)/.test(q)) return { text: 'On y va.', links: [{ label: 'Drive', to: '/drive' }] };
  if (/(ouvre|va|aller|emmene|montre).*(calendrier|agenda|planning)/.test(q)) return { text: 'Direction le calendrier.', links: [{ label: 'Calendrier', to: '/calendrier' }] };
  if (/(ouvre|va|aller|emmene|montre).*notes/.test(q)) return { text: 'Tes notes t\'attendent.', links: [{ label: 'Notes', to: '/notes' }] };
  if (/(ouvre|va|aller|emmene|montre).*(taches|todo|to-do|a faire|progression|temps de travail)/.test(q)) return { text: 'Voilà ta liste.', links: [{ label: 'Tâches', to: '/taches' }] };
  if (/(ouvre|va|aller|emmene|montre).*badges?/.test(q)) return { text: 'Tes badges sont dans ton profil.', links: [{ label: 'Mes badges', to: '/profil#badges' }] };
  if (/(ouvre|va|aller|emmene|montre).*groupes?/.test(q)) return { text: 'Tes groupes de travail.', links: [{ label: 'Groupes', to: '/groupes' }] };
  if (/(ouvre|va|aller|emmene|montre).*(dashboard|accueil|tableau)/.test(q)) return { text: 'Retour au QG.', links: [{ label: 'Dashboard', to: '/' }] };

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
    return { text: "Moi c'est Kompaly 🤖 Je vis sur le bord de ton écran. Je peux chercher tes fichiers, analyser ton calendrier, créer des notes, des dossiers et des événements. Demande-moi !" };
  }
  if (/(fatigue|stress|motivation|demotive|j'en peux plus|flemme)/.test(q)) {
    return { text: pick(["Respire 🌬️ Une chose à la fois. Choisis LA tâche la plus petite et fais-la maintenant, le reste suivra.", 'Méthode Pomodoro : 25 min de focus, 5 min de pause. Tu veux que je te bloque un créneau de révision dans le calendrier ?']) };
  }

  return {
    text:
      "Je n'ai pas tout compris. Voilà ce que je sais faire sans IA :\n- « Trouve le dossier Maths »\n- « Analyse mon calendrier »\n- « Crée une note Révisions histoire : chapitre 3 »\n- « Ajoute Exam de physique vendredi 10h »\n- « Ajoute la tâche acheter une calculatrice demain »\n- « Interroge-moi sur Histoire »\n- « Lance une session focus sur les maths »\n- « Renomme TD1 en TD1 corrigé », « Mets Brouillon à la corbeille »\n- « Mode sombre », « Qu'est-ce que j'ai demain ? »",
  };
}

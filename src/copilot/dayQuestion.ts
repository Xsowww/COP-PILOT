// « Qu'est-ce que j'ai jeudi prochain ? », « je fais quoi demain », « c'est quoi mon programme le 12 ? »:
// the day the question is about (pure, tested in tests/dayQuestion.test.ts).

import { normalize } from '../lib/utils';
import { parseQuickAdd } from '../lib/dates';

/** Asking what is planned (not asking to plan something). */
const ASKING = /(qu'?est[- ]ce que j'ai|j'ai quoi|je fais quoi|on fait quoi|j'ai (?:de )?prevu quoi|c'est quoi (?:mon|le) (?:programme|planning)|(?:mon|le) programme|(?:mon|le) planning|qu'?est[- ]ce qui est prevu|qu'?est[- ]ce qu'il y a|il y a quoi|quoi de prevu|au menu|prevu)/;
const BARE_DAY = /^(?:et\s+)?(?:aujourd'hui|demain|apres[- ]demain|(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?: prochain)?)\s*\??$/;

/** The day (YYYY-MM-DD) a « what do I have » question is about, or null when it is not one. */
export function askedDay(input: string, base = new Date()): string | null {
  const q = normalize(input).replace(/[’‘]/g, "'");
  if (!ASKING.test(q) && !BARE_DAY.test(q)) return null;
  return parseQuickAdd(input.replace(/[’‘]/g, "'"), base).date;
}

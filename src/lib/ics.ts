/**
 * Minimal iCalendar (.ics) reader for student timetables (ENT, ADE, Hyperplanning, Google Agenda…).
 * Handles line folding, escaped text, all-day and timed events, UTC / TZID / floating times,
 * DURATION, RRULE (DAILY / WEEKLY with BYDAY, INTERVAL, COUNT, UNTIL), EXDATE and RECURRENCE-ID overrides.
 * No dependency on purpose: it must run in the browser and in a bare node script.
 */

export interface IcsEvent {
  /** UID of the event, or `${UID}_${YYYYMMDD}` for one occurrence of a recurring (or multi-day) event. */
  externalId: string;
  title: string;
  date: string; // YYYY-MM-DD
  start?: string; // HH:mm
  end?: string; // HH:mm
  details?: string;
}

export interface ParseOptions {
  /** Reference "now" (tests). */
  now?: Date;
  /** Recurring events are expanded up to this date (default: 9 months after `now`). */
  horizon?: Date;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface Stamp {
  /** Local wall-clock time. */
  date: Date;
  allDay: boolean;
  /** Given in UTC: occurrences keep the same UTC time (and may move by an hour across DST). */
  utc?: boolean;
}

interface RawEvent {
  uid: string;
  summary: string;
  location: string;
  description: string;
  status: string;
  start?: Stamp;
  end?: Stamp;
  durationMs?: number;
  rrule?: Record<string, string>;
  exdates: Set<string>;
  recurrenceId?: string; // YYYYMMDD
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MAX_OCCURRENCES = 1000;

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const compactKey = (d: Date) => dateKey(d).replace(/-/g, '');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());

/** Accepts .ics files even when the browser gives no MIME type. */
export const isIcsFile = (f: { name: string; type: string }) => /\.(ics|ical|icalendar)$/i.test(f.name) || f.type === 'text/calendar';

/** "Line\, with\; escapes\n" → "Line, with; escapes⏎" */
export function unescapeText(v: string): string {
  return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Splits `NAME;P1=a;P2="b:c":value` without being fooled by quoted colons. */
function parseLine(line: string): Prop | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ':' && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/**
 * 20261012 → all-day; 20261012T080000Z → UTC converted to local time;
 * 20261012T080000 (floating or with TZID) → taken as local wall-clock time.
 */
export function parseStamp(value: string, params: Record<string, string> = {}): Stamp | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined || params.VALUE === 'DATE') return { date: new Date(+y, +mo - 1, +d), allDay: true };
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))) : new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  return { date, allDay: false, utc: !!z };
}

/** PT1H30M, P1D, -PT15M… → milliseconds. */
function parseDuration(v: string): number | undefined {
  const m = v.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return undefined;
  const [, sign, w, d, h, mi, s] = m;
  const ms = ((+(w ?? 0) * 7 + +(d ?? 0)) * 24 * 3600 + +(h ?? 0) * 3600 + +(mi ?? 0) * 60 + +(s ?? 0)) * 1000;
  return sign === '-' ? -ms : ms;
}

function parseRule(v: string): Record<string, string> {
  const rule: Record<string, string> = {};
  for (const part of v.split(';')) {
    const [k, val] = part.split('=');
    if (k && val) rule[k.toUpperCase()] = val.toUpperCase();
  }
  return rule;
}

/** Reads the VEVENT blocks of an .ics file (sub-components such as VALARM are ignored). */
function readEvents(text: string): RawEvent[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r?\n[ \t]/g, '') // unfold
    .split(/\r?\n/);
  const out: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let depth = 0; // nesting inside the current VEVENT (VALARM…)

  for (const line of lines) {
    if (!line.trim()) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      if (cur) depth++;
      else if (p.value.toUpperCase() === 'VEVENT') cur = { uid: '', summary: '', location: '', description: '', status: '', exdates: new Set() };
      continue;
    }
    if (p.name === 'END') {
      if (cur && depth > 0) depth--;
      else if (cur && p.value.toUpperCase() === 'VEVENT') {
        out.push(cur);
        cur = null;
      }
      continue;
    }
    if (!cur || depth > 0) continue;
    switch (p.name) {
      case 'UID':
        cur.uid = p.value.trim();
        break;
      case 'SUMMARY':
        cur.summary = unescapeText(p.value).trim();
        break;
      case 'LOCATION':
        cur.location = unescapeText(p.value).trim();
        break;
      case 'DESCRIPTION':
        cur.description = unescapeText(p.value).trim();
        break;
      case 'STATUS':
        cur.status = p.value.trim().toUpperCase();
        break;
      case 'DTSTART':
        cur.start = parseStamp(p.value, p.params) ?? undefined;
        break;
      case 'DTEND':
        cur.end = parseStamp(p.value, p.params) ?? undefined;
        break;
      case 'DURATION':
        cur.durationMs = parseDuration(p.value);
        break;
      case 'RRULE':
        cur.rrule = parseRule(p.value);
        break;
      case 'EXDATE':
        for (const v of p.value.split(',')) {
          const s = parseStamp(v, p.params);
          if (s) cur.exdates.add(compactKey(s.date));
        }
        break;
      case 'RECURRENCE-ID': {
        const s = parseStamp(p.value, p.params);
        if (s) cur.recurrenceId = compactKey(s.date);
        break;
      }
    }
  }
  return out;
}

/** Start dates of every occurrence (DTSTART included), honouring INTERVAL, BYDAY, COUNT, UNTIL and the horizon. */
function expand(start: Date, rule: Record<string, string>, horizon: Date, utc = false): Date[] {
  const step = (d: Date, n: number) => (utc ? new Date(d.getTime() + n * DAY_MS) : addDays(d, n));
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  let until = horizon;
  if (rule.UNTIL) {
    const u = parseStamp(rule.UNTIL);
    if (u) {
      // A DATE-only UNTIL includes that whole day.
      const limit = u.allDay ? new Date(u.date.getTime() + DAY_MS - 1) : u.date;
      if (limit < until) until = limit;
    }
  }
  const dates: Date[] = [];
  const push = (d: Date) => {
    if (d < start || d > until || dates.length >= Math.min(count, MAX_OCCURRENCES)) return false;
    dates.push(d);
    return true;
  };

  if (rule.FREQ === 'DAILY') {
    for (let d = start; d <= until && dates.length < Math.min(count, MAX_OCCURRENCES); d = step(d, interval)) push(d);
  } else if (rule.FREQ === 'WEEKLY') {
    const days = (rule.BYDAY ? rule.BYDAY.split(',') : [WEEKDAYS[start.getDay()]])
      .map(d => WEEKDAYS.indexOf(d.replace(/^[+-]?\d+/, '')))
      .filter(d => d >= 0)
      .map(d => (d + 6) % 7) // Monday = 0
      .sort((a, b) => a - b);
    const monday = step(start, -((start.getDay() + 6) % 7));
    for (let week = monday; week <= until && dates.length < Math.min(count, MAX_OCCURRENCES); week = step(week, 7 * interval)) {
      for (const offset of days) push(step(week, offset));
    }
  } else {
    // MONTHLY / YEARLY and friends are rare in timetables: keep the first occurrence only.
    push(start);
  }
  return dates;
}

/** Location on the first line, then the description without ENT export noise. */
function detailsOf(ev: RawEvent): string | undefined {
  const desc = ev.description
    .split('\n')
    .filter(l => !/^\s*\(?\s*(export|mis à jour|updated)/i.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const parts = [ev.location, desc].filter(Boolean);
  return parts.length ? parts.join('\n') : undefined;
}

/** Turns one occurrence into calendar events (several when it spans several days). */
function toEvents(ev: RawEvent, start: Date, durationMs: number, allDay: boolean, externalId: (d: Date) => string, base: Omit<IcsEvent, 'externalId' | 'date'>): IcsEvent[] {
  if (allDay) {
    const days = Math.min(31, Math.max(1, Math.round(durationMs / DAY_MS)));
    return Array.from({ length: days }, (_, i) => {
      const d = addDays(start, i);
      return { ...base, externalId: days > 1 ? `${ev.uid}_${compactKey(d)}` : externalId(d), date: dateKey(d) };
    });
  }
  const end = new Date(start.getTime() + durationMs);
  // Events running past midnight are cut at the end of their first day.
  const endTime = durationMs > 0 ? (dateKey(end) === dateKey(start) ? hhmm(end) : '23:59') : undefined;
  return [{ ...base, externalId: externalId(start), date: dateKey(start), start: hhmm(start), end: endTime }];
}

/**
 * Tells which already imported events the file now cancels: a cancelled occurrence or series,
 * or an occurrence excluded from its series (EXDATE). Used when importing an updated timetable.
 */
export function cancelledBy(text: string): (externalId: string) => boolean {
  const ids = new Set<string>();
  const series = new Set<string>();
  for (const e of readEvents(text)) {
    if (!e.uid) continue;
    for (const k of e.exdates) ids.add(`${e.uid}_${k}`);
    if (e.status !== 'CANCELLED') continue;
    if (e.recurrenceId) ids.add(`${e.uid}_${e.recurrenceId}`);
    else if (e.rrule) series.add(`${e.uid}_`);
    else ids.add(e.uid);
  }
  return id => ids.has(id) || [...series].some(p => id.startsWith(p));
}

/** Parses an .ics file into individual, single-day events sorted by date. */
export function parseIcs(text: string, opts: ParseOptions = {}): IcsEvent[] {
  const now = opts.now ?? new Date();
  const horizon = opts.horizon ?? new Date(now.getFullYear(), now.getMonth() + 9, now.getDate(), 23, 59);
  const all = readEvents(text).filter(e => e.start);
  const raw = all.filter(e => e.status !== 'CANCELLED');

  // RECURRENCE-ID blocks replace one occurrence of their master event — a cancelled one too
  // (Outlook, ADE: « STATUS:CANCELLED » on the override), which then just removes it.
  const overridden = new Map<string, Set<string>>();
  for (const e of all) if (e.recurrenceId) overridden.set(e.uid, (overridden.get(e.uid) ?? new Set()).add(e.recurrenceId));

  const out: IcsEvent[] = [];
  raw.forEach((e, i) => {
    if (!e.uid) e.uid = `sans-uid-${i}-${compactKey(e.start!.date)}`;
    const start = e.start!;
    const allDay = start.allDay;
    const durationMs = e.end ? e.end.date.getTime() - start.date.getTime() : (e.durationMs ?? (allDay ? DAY_MS : 0));
    const base = { title: e.summary || 'Sans titre', details: detailsOf(e) };

    if (e.recurrenceId) {
      out.push(...toEvents(e, start.date, durationMs, allDay, () => `${e.uid}_${e.recurrenceId}`, base));
      return;
    }
    if (!e.rrule) {
      out.push(...toEvents(e, start.date, durationMs, allDay, () => e.uid, base));
      return;
    }
    const skip = overridden.get(e.uid);
    for (const d of expand(start.date, e.rrule, horizon, start.utc)) {
      const k = compactKey(d);
      if (e.exdates.has(k) || skip?.has(k)) continue;
      out.push(...toEvents(e, d, durationMs, allDay, day => `${e.uid}_${compactKey(day)}`, base));
    }
  });

  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
}

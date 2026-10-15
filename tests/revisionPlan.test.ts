import { describe, expect, it } from 'vitest';

// The stores reach for the browser when they load: give them the two globals they read.
const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { sessionsFor, noteFor, noteTitle, pickExam, planTag, subjectStart } = await import('../src/copilot/revisionPlan');
const { normalize } = await import('../src/lib/utils');
type CalendarEvent = import('../src/store/calendar').CalendarEvent;
type Note = import('../src/store/notes').Note;

const ev = (id: string, title: string, date: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, title, date, category: 'examen', done: false, createdAt: '2026-10-01T00:00:00Z', ...extra,
});
const session = (id: string, examTitle: string, date: string, examId?: string) =>
  ev(id, `Révision · ${examTitle}`, date, { category: 'devoir', externalId: examId ? planTag(examId) : undefined });
const note = (id: string, title: string, examId?: string): Note => ({
  id, title, content: '', folderId: null, createdAt: '', updatedAt: '', links: examId ? [{ kind: 'event', id: examId }] : undefined,
});

const subject = (request: string) => {
  const q = normalize(request);
  return request.trim().slice(subjectStart(q)).replace(/[\s?!.]+$/, '');
};

describe('subject of a planning request', () => {
  it('takes the words after the request', () => {
    expect(subject('bloque du temps pour préparer lancement')).toBe('lancement');
    expect(subject('Planifie mes révisions pour le contrôle de maths du 10 novembre')).toBe('contrôle de maths du 10 novembre');
    expect(subject('prépare mes révisions de maths ?')).toBe('maths');
    expect(subject('planifie la préparation du lancement')).toBe('lancement');
    expect(subject("organise mes révisions pour l'examen de chimie")).toBe('examen de chimie');
  });
  it('is empty when no subject is given', () => {
    expect(subject('Planifie mes révisions')).toBe('');
    expect(subject('Bloque du temps pour préparer')).toBe('');
  });
});

describe('which exam', () => {
  const today = '2026-10-15';
  const events = [
    ev('a', 'Livraison site client', '2026-10-20'),
    ev('b', 'Lancement produit', '2026-10-23'),
    ev('m1', 'Contrôle de maths', '2026-10-20'),
    ev('m2', 'Contrôle de maths', '2026-11-10'),
    ev('p', 'Partiel d’anglais', '2026-10-27'),
    ev('old', 'Oral de chimie', '2026-10-01'),
  ];
  it('finds the event named by a word of its title', () => {
    expect(pickExam('lancement', events, today)?.id).toBe('b');
    expect(pickExam('la livraison', events, today)?.id).toBe('a');
  });
  it('tells two same-titled exams apart by their day', () => {
    expect(pickExam('contrôle de maths du 10 novembre', events, today)?.id).toBe('m2');
    expect(pickExam('contrôle de maths', events, today)?.id).toBe('m1');
  });
  it('prefers the kind of event named (« le partiel »)', () => {
    expect(pickExam('partiel', events, today)?.id).toBe('p');
  });
  it('takes the next one when no subject is given', () => {
    expect(pickExam('', events, today)?.id).toBe('a');
  });
  it('finds nothing when the subject matches nothing (no fallback on the next one)', () => {
    expect(pickExam('soutenance', events, today)).toBeUndefined();
    expect(pickExam('chimie', events, today)).toBeUndefined(); // past
  });
  it('accepts an id', () => {
    expect(pickExam('old', events, today)?.id).toBe('old');
  });
});

describe('plan of each exam', () => {
  const m1 = ev('m1', 'Contrôle de maths', '2026-10-20');
  const m2 = ev('m2', 'Contrôle de maths', '2026-11-10');

  it('links the new sessions to their exam', () => {
    const events = [m1, m2, session('s1', m1.title, '2026-10-19', 'm1'), session('s2', m1.title, '2026-10-17', 'm1')];
    expect(sessionsFor(m1, events).map(e => e.id)).toEqual(['s2', 's1']);
    expect(sessionsFor(m2, events)).toEqual([]);
  });

  it('gives the sessions of an older plan (title only) to the exam they come before', () => {
    const events = [m1, m2, session('o1', m1.title, '2026-10-19'), session('o2', m1.title, '2026-11-09')];
    expect(sessionsFor(m1, events).map(e => e.id)).toEqual(['o1']);
    expect(sessionsFor(m2, events).map(e => e.id)).toEqual(['o2']);
  });

  it('keeps recognising an older plan of a single exam', () => {
    const events = [m1, session('o1', m1.title, '2026-10-19')];
    expect(sessionsFor(m1, events).map(e => e.id)).toEqual(['o1']);
  });

  it('gives each exam its own sheet', () => {
    const events = [m1, m2, session('o1', m1.title, '2026-10-19')];
    const notes = [note('n1', 'Fiche · Contrôle de maths'), note('n2', 'Fiche · Contrôle de maths (10 novembre)', 'm2')];
    expect(noteFor(m1, notes, events)?.id).toBe('n1'); // older sheet, with the older sessions' exam
    expect(noteFor(m2, notes, events)?.id).toBe('n2');
    expect(noteFor(m2, notes.slice(0, 1), events)).toBeUndefined();
  });

  it('dates the title of a new sheet only when another exam has the same title', () => {
    expect(noteTitle('Fiche · ', m2, [m1, m2])).toBe('Fiche · Contrôle de maths (10 novembre)');
    expect(noteTitle('Fiche · ', m1, [m1])).toBe('Fiche · Contrôle de maths');
  });
});

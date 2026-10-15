import { describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { pickExam, hasTwin } = await import('../src/copilot/revisionPlan');
type CalendarEvent = import('../src/store/calendar').CalendarEvent;

const ev = (id: string, title: string, date: string): CalendarEvent => ({ id, title, date, category: 'examen', done: false, createdAt: '2026-10-01T00:00:00Z' });

describe('two exams with the same title', () => {
  const today = '2026-10-15';
  const events = [ev('m1', 'Contrôle de maths', '2026-10-20'), ev('m2', 'Contrôle de maths', '2026-11-10'), ev('a', 'Partiel d’anglais', '2026-10-27')];
  it('a day that matches none of them finds nothing', () => {
    expect(pickExam('contrôle de maths du 12 novembre', events, today)).toBeUndefined();
    expect(pickExam('contrôle de maths du 10 novembre', events, today)?.id).toBe('m2');
  });
  it('are told apart by their day', () => {
    expect(hasTwin(events[0], events)).toBe(true);
    expect(hasTwin(events[2], events)).toBe(false);
  });
});

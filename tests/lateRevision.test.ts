import { afterEach, describe, expect, it, vi } from 'vitest';

// The stores reach for the browser when they load: give them the globals they read.
const memory = new Map<string, string>();
const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
Object.assign(globalThis, { location: new URL('http://localhost/'), localStorage: storage, sessionStorage: storage });
const { planRevisions } = await import('../src/copilot/actions');
const { isOver } = await import('../src/copilot/proactive');
const { useCalendar } = await import('../src/store/calendar');
const { useSettings } = await import('../src/store/settings');

const exam = (date: string, start?: string) => ({ id: 'exam', title: 'Partiel droit', date, start, category: 'examen' as const, done: false, createdAt: '2026-10-01T00:00:00Z' });

afterEach(() => vi.useRealTimers());

describe('revision sessions planned late in the evening', () => {
  it('at 23:50 for an exam tomorrow at 8:00: no session today (too late), only the sheet', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 23, 50)); // Thursday 15 October
    useSettings.setState({ usage: 'etudes', revisionTime: '18:00' });
    useCalendar.setState({ events: [exam('2026-10-16', '08:00')] });
    const res = planRevisions('exam', 3)!;
    expect(res.created).toEqual([]);
    expect(useCalendar.getState().events.filter(e => e.title.startsWith('Révision'))).toEqual([]);
  });

  it('at 20:00: still a session today, in the day’s list (no hours)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 20, 0));
    useSettings.setState({ usage: 'etudes', revisionTime: '18:00' });
    useCalendar.setState({ events: [exam('2026-10-16', '08:00')] });
    const res = planRevisions('exam', 3)!;
    expect(res.created.map(e => [e.date, e.start])).toEqual([['2026-10-15', undefined]]);
  });
});

describe('isOver: an exam or a deadline already behind us', () => {
  const now = new Date(2026, 9, 15, 19, 55);
  it('earlier today (end, else start), yesterday: over', () => {
    expect(isOver({ date: '2026-10-15', start: '08:00' }, now)).toBe(true);
    expect(isOver({ date: '2026-10-15', start: '18:00', end: '19:30' }, now)).toBe(true);
    expect(isOver({ date: '2026-10-14' }, now)).toBe(true);
  });
  it('later today, without a time, or another day: not over', () => {
    expect(isOver({ date: '2026-10-15', start: '18:00', end: '21:00' }, now)).toBe(false);
    expect(isOver({ date: '2026-10-15', start: '20:30' }, now)).toBe(false);
    expect(isOver({ date: '2026-10-15' }, now)).toBe(false);
    expect(isOver({ date: '2026-10-16', start: '08:00' }, now)).toBe(false);
  });
});

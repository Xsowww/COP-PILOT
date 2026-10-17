import { describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { weekItems, cheer } = await import('../src/lib/weekProgress');

const task = (id: string, due?: string, done = false, doneAt?: string) => ({ id, title: id, done, due, doneAt, createdAt: '2026-10-01T00:00:00Z' });
const ev = (id: string, date: string, category: 'devoir' | 'cours', done = false) => ({ id, title: id, date, category, done, createdAt: '2026-10-01T00:00:00Z' });

describe('ma semaine', () => {
  const from = '2026-10-12', to = '2026-10-18';
  it('counts the tasks due this week, those ticked this week, and the homework', () => {
    const r = weekItems(
      [task('a', '2026-10-13'), task('b', '2026-10-14', true, '2026-10-14T09:00:00Z'), task('c', '2026-10-25'), task('d', undefined, true, '2026-10-15T18:00:00Z'), task('e', undefined)],
      [ev('TP', '2026-10-16', 'devoir', true), ev('Cours', '2026-10-16', 'cours')],
      from,
      to,
    );
    expect(r).toEqual({ total: 4, done: 3 });
  });
  it('says what is left, and celebrates', () => {
    expect(cheer(0, 0)).toMatch(/Rien à faire/);
    expect(cheer(0, 6)).toBe('C’est parti : 6 choses à faire cette semaine.');
    expect(cheer(1, 6)).toBe('Plus que 2 pour passer la moitié.');
    expect(cheer(4, 6)).toBe('Plus que 2, tu y es presque.');
    expect(cheer(5, 6)).toBe('Plus qu’une, tu y es presque !');
    expect(cheer(6, 6)).toBe('Semaine bouclée, bravo !');
  });
});

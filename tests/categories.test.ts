import { beforeEach, describe, expect, it } from 'vitest';

// The stores reach for the browser when they load: give them the two globals they read.
const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { useCalendar, catOf, allCategories, guessCategory, createCategory, updateCategory, deleteCategory } = await import('../src/store/calendar');
const { useSettings } = await import('../src/store/settings');

beforeEach(() => {
  useSettings.setState({ customCategories: [] });
  useCalendar.setState({ events: [], trash: [] });
});

describe('own categories', () => {
  it('are created once per name and listed after the built-in ones', () => {
    const stage = createCategory('  Stage ', '#1f8a8a');
    expect(stage.id).toMatch(/^c-[a-z0-9-]{1,40}$/); // what the database accepts
    expect(createCategory('stage', '#d9483b').id).toBe(stage.id);
    expect(allCategories().slice(-1)).toEqual([stage.id]);
    expect(catOf(stage.id)).toMatchObject({ label: 'Stage', color: '#1f8a8a' });
  });

  it('are picked from the title, before the built-in guesses', () => {
    const asso = createCategory('Asso', '#d6457f');
    expect(guessCategory('Réunion asso jeudi')).toBe(asso.id);
    expect(guessCategory('Associé du cabinet')).not.toBe(asso.id); // whole words only
    expect(guessCategory('Partiel de maths')).toBe('examen');
  });

  it('can be renamed, and deleting one moves its events to Perso', () => {
    const job = createCategory('Job', '#6b7280');
    updateCategory(job.id, { label: 'Job étudiant' });
    expect(catOf(job.id).label).toBe('Job étudiant');
    const ev = useCalendar.getState().add({ title: 'Service', date: '2026-10-20', category: job.id });
    deleteCategory(job.id);
    expect(useCalendar.getState().events.find(e => e.id === ev.id)?.category).toBe('perso');
    expect(catOf(job.id).label).toBe(catOf('perso').label); // a stale id never breaks the display
  });
});

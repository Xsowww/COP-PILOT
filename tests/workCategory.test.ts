import { afterEach, expect, it } from 'vitest';

const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { guessCategory } = await import('../src/store/calendar');
const { useSettings } = await import('../src/store/settings');

afterEach(() => useSettings.setState({ usage: 'etudes' }));

it('puts a team meeting in « Réunion » at work, whatever the apostrophe', () => {
  useSettings.setState({ usage: 'travail' });
  expect(guessCategory("Point d'équipe", true)).toBe('cours');
  expect(guessCategory('Point d’équipe', true)).toBe('cours');
});

import { describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { isBigEvent } = await import('../src/store/calendar');

describe('isBigEvent', () => {
  it('un examen, ou un événement marqué important', () => {
    expect(isBigEvent({ category: 'examen' })).toBe(true);
    expect(isBigEvent({ category: 'perso', important: true })).toBe(true);
    expect(isBigEvent({ category: 'cours' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { askedDay } = await import('../src/copilot/dayQuestion');

// Thursday 15 October 2026, 10:00
const base = new Date(2026, 9, 15, 10);

describe('day of a « what do I have » question', () => {
  it('understands today, tomorrow and the day after', () => {
    expect(askedDay("Qu'est-ce que j'ai aujourd'hui ?", base)).toBe('2026-10-15');
    expect(askedDay('je fais quoi demain', base)).toBe('2026-10-16');
    expect(askedDay("c'est quoi mon programme après-demain", base)).toBe('2026-10-17');
    expect(askedDay('demain ?', base)).toBe('2026-10-16');
  });
  it('understands a weekday and « prochain » (typographic apostrophes too)', () => {
    expect(askedDay('Qu’est-ce que j’ai jeudi prochain ?', base)).toBe('2026-10-22');
    expect(askedDay("j'ai quoi lundi", base)).toBe('2026-10-19');
  });
  it('understands a date', () => {
    expect(askedDay('quoi de prévu le 12 novembre ?', base)).toBe('2026-11-12');
    expect(askedDay('Qu’est-ce que j’ai le 3/11', base)).toBe('2026-11-03');
  });
  it('leaves other messages alone', () => {
    expect(askedDay('Ajoute Réunion client jeudi 10h', base)).toBeNull();
    expect(askedDay("qu'est-ce que j'ai", base)).toBeNull();
    expect(askedDay('Trouve le dossier Maths', base)).toBeNull();
  });
});

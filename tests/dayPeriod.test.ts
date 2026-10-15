import { describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { askedDay, askedPeriod } = await import('../src/copilot/dayQuestion');
const { parseQuickAdd } = await import('../src/lib/dates');
const { frenchSpacing } = await import('../src/copilot/markdown');

// Wednesday 14 October 2026, 16:00
const wednesday = new Date(2026, 9, 14, 16);

describe('« jeudi prochain »', () => {
  it('is the Thursday of next week, in a question and in the quick add', () => {
    expect(askedDay('Qu’est-ce que j’ai jeudi prochain ?', wednesday)).toBe('2026-10-22');
    expect(parseQuickAdd('Réunion jeudi prochain 10h', wednesday).date).toBe('2026-10-22');
    // « jeudi » alone is the coming one.
    expect(askedDay("qu'est-ce que j'ai jeudi ?", wednesday)).toBe('2026-10-15');
  });
  it('said at the end of the week, is in a few days', () => {
    const saturday = new Date(2026, 9, 17, 10);
    expect(parseQuickAdd('Dentiste mardi prochain', saturday).date).toBe('2026-10-20');
    const sunday = new Date(2026, 9, 18, 10);
    expect(parseQuickAdd('Rdv lundi prochain', sunday).date).toBe('2026-10-19');
    expect(parseQuickAdd('Match dimanche prochain', sunday).date).toBe('2026-10-25');
  });
  it('« d’aujourd’hui » is today', () => {
    expect(parseQuickAdd("contrôle de maths d'aujourd'hui", wednesday)).toMatchObject({ title: 'Contrôle de maths', date: '2026-10-14' });
  });
});

describe('a period', () => {
  it('this weekend, next weekend', () => {
    expect(askedPeriod("qu'est-ce qui est prévu ce week-end ?", wednesday)).toEqual({ kind: 'weekend', from: '2026-10-17', to: '2026-10-18' });
    expect(askedPeriod('je fais quoi le week-end prochain', wednesday)).toEqual({ kind: 'weekend', from: '2026-10-24', to: '2026-10-25' });
    // On Sunday, what is left of it.
    expect(askedPeriod('ce week-end ?', new Date(2026, 9, 18, 10))).toEqual({ kind: 'weekend', from: '2026-10-18', to: '2026-10-18' });
  });
  it('this week, next week', () => {
    expect(askedPeriod('mon planning de la semaine', wednesday)).toMatchObject({ kind: 'week', from: '2026-10-12', to: '2026-10-18' });
    expect(askedPeriod("qu'est-ce que j'ai la semaine prochaine ?", wednesday)).toMatchObject({ kind: 'next-week', from: '2026-10-19', to: '2026-10-25' });
  });
  it('leaves days and other messages alone', () => {
    expect(askedPeriod("qu'est-ce que j'ai jeudi ?", wednesday)).toBeNull();
    expect(askedPeriod('Ajoute Réunion client jeudi 10h', wednesday)).toBeNull();
    expect(askedPeriod('Trouve le dossier Maths', wednesday)).toBeNull();
  });
});

describe('French spacing of Kompaly’s words', () => {
  it('puts no-break spaces inside « » and before : ; ? !', () => {
    expect(frenchSpacing('Conseil : commence à préparer « Lancement produit » dès maintenant ! Ok ?')).toBe(
      'Conseil : commence à préparer « Lancement produit » dès maintenant ! Ok ?',
    );
  });
  it('leaves times, links and text without spaces alone', () => {
    expect(frenchSpacing('à 14:30, voir https://kompaly.fr')).toBe('à 14:30, voir https://kompaly.fr');
  });
});

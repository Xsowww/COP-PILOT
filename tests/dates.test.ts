import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '../src/lib/dates';

// Mardi 13 octobre 2026, 10 h.
const base = new Date(2026, 9, 13, 10);

describe('parseQuickAdd', () => {
  it.each([
    ['Exam de maths vendredi 14h', { title: 'Exam de maths', date: '2026-10-16', start: '14:00', end: null }],
    ['Rendre TP le 12/11 à 9h30', { title: 'Rendre TP', date: '2026-11-12', start: '09:30', end: null }],
    ['Sport demain 18h-19h', { title: 'Sport', date: '2026-10-14', start: '18:00', end: '19:00' }],
    ['Révisions dans 2 semaines', { title: 'Révisions', date: '2026-10-27', start: null, end: null }],
    ['Partiel 3 novembre', { title: 'Partiel', date: '2026-11-03', start: null, end: null }],
    ['Dentiste mardi', { title: 'Dentiste', date: '2026-10-20', start: null, end: null }], // même jour → semaine suivante
    ['Juste une idée', { title: 'Juste une idée', date: null, start: null, end: null }],
  ])('%s', (input, expected) => {
    expect(parseQuickAdd(input, base)).toEqual(expected);
  });

  it('une date passée de plus d’un mois tombe l’année suivante', () => {
    expect(parseQuickAdd('Rentrée le 2/9', base).date).toBe('2027-09-02');
  });

  it('ignore une heure impossible', () => {
    expect(parseQuickAdd('Truc 25h', base).start).toBeNull();
  });
});

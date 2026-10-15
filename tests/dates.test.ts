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
    ['Exam mardi 3 novembre', { title: 'Exam', date: '2026-11-03', start: null, end: null }],
    ['Fête le 1er novembre', { title: 'Fête', date: '2026-11-01', start: null, end: null }],
    ['Exam 3 nov 14h', { title: 'Exam', date: '2026-11-03', start: '14:00', end: null }],
    ['Repas à midi', { title: 'Repas', date: null, start: '12:00', end: null }],
    ['Rendre DM vendredi soir', { title: 'Rendre DM', date: '2026-10-16', start: null, end: null }],
    ['Exam la semaine prochaine', { title: 'Exam', date: '2026-10-19', start: null, end: null }],
    ['Sport tous les jeudis à 18h', { title: 'Sport', date: '2026-10-15', start: '18:00', end: null, weekly: true }],
    ['Révisions 14-16', { title: 'Révisions 14-16', date: null, start: null, end: null }], // pas un 16e mois
    ['Anniversaire le 31/02', { title: 'Anniversaire le 31/02', date: null, start: null, end: null }],
    ['Rdv lundi 14h75', { title: 'Rdv 14h75', date: '2026-10-19', start: null, end: null }],
    ['Sport lundi de 18h à 9h', { title: 'Sport', date: '2026-10-19', start: '18:00', end: null }],
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

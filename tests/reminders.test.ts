import { describe, expect, it } from 'vitest';
import { adaptReminders, anchorOf, cleanReminders, offsetLabel, reminderBody, reminderLabel, upcomingReminders } from '../src/lib/reminders';

const now = new Date(2026, 9, 16, 10, 0); // jeudi 16 octobre 2026, 10:00

describe('rappels', () => {
  it('ancre : l’heure de l’événement, ou 9 h sans heure', () => {
    expect(anchorOf('2026-10-17', '14:30').getHours()).toBe(14);
    expect(anchorOf('2026-10-17').getHours()).toBe(9);
  });

  it('nettoie : entiers distincts, triés, bornés', () => {
    expect(cleanReminders([15, '60', 15, -5, 1.5, 999999])).toEqual([60, 15]);
    expect(cleanReminders([])).toEqual([]); // « aucun rappel » choisi
    expect(cleanReminders(null)).toBeUndefined(); // jamais choisi
    expect(cleanReminders('x')).toBeUndefined();
  });

  it('plusieurs rappels sur un même événement, dans l’ordre', () => {
    const r = upcomingReminders([{ kind: 'event', id: 'e1', title: 'Réunion client', date: '2026-10-16', time: '14:00', reminders: [60, 15, 0] }], now);
    expect(r.map(x => `${x.fireAt.getHours()}:${x.fireAt.getMinutes()}`)).toEqual(['13:0', '13:45', '14:0']);
    expect(r[0].body).toBe('Aujourd’hui · 14h\nAgenda · Kompaly');
    expect(r[1].body).toBe('Dans 15 min · 14h\nAgenda · Kompaly');
    expect(r[2].body).toBe('Maintenant · 14h\nAgenda · Kompaly');
    expect(r[0].url).toBe('/calendrier?jour=2026-10-16');
  });

  it('les rappels passés, les éléments faits et sans date ne sont pas gardés', () => {
    const r = upcomingReminders(
      [
        { kind: 'event', id: 'a', title: 'Passé', date: '2026-10-16', time: '09:00', reminders: [15] },
        { kind: 'event', id: 'b', title: 'Fait', date: '2026-10-17', time: '09:00', done: true, reminders: [15] },
        { kind: 'task', id: 'c', title: 'Sans date', reminders: [0] },
      ],
      now,
    );
    expect(r).toEqual([]);
  });

  it('tâche sans heure : la veille à 18 h, le jour même à 9 h', () => {
    const r = upcomingReminders([{ kind: 'task', id: 't', title: 'Envoyer le dossier', date: '2026-10-18', reminders: [900, 0] }], now);
    expect(r.map(x => [x.fireAt.getDate(), x.fireAt.getHours()])).toEqual([
      [17, 18],
      [18, 9],
    ]);
    expect(r[0].body).toBe('À faire demain\nTâches · Kompaly');
    expect(r[1].body).toBe('À faire aujourd’hui\nTâches · Kompaly');
    expect(r[0].url).toBe('/taches');
  });

  it('clé stable : la même pour le même rappel, différente si l’heure change', () => {
    const a = upcomingReminders([{ kind: 'event', id: 'e', title: 'X', date: '2026-10-20', time: '10:00', reminders: [30] }], now)[0].key;
    const b = upcomingReminders([{ kind: 'event', id: 'e', title: 'Y', date: '2026-10-20', time: '10:00', reminders: [30] }], now)[0].key;
    const c = upcomingReminders([{ kind: 'event', id: 'e', title: 'X', date: '2026-10-20', time: '11:00', reminders: [30] }], now)[0].key;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('textes', () => {
    expect(reminderLabel(15, true)).toBe('15 min avant');
    expect(reminderLabel(900, false)).toBe('La veille, 18 h');
    expect(reminderLabel(180, true)).toBe('3 h avant');
    expect(reminderBody({ kind: 'event', id: 'e', title: 'X', date: '2026-10-23' }, new Date(2026, 9, 16, 9, 0))).toBe('Vendredi 23 oct.\nAgenda · Kompaly');
    expect(reminderBody({ kind: 'event', id: 'e', title: 'X', date: '2026-10-16', time: '14:00', end: '15:30' }, new Date(2026, 9, 16, 13, 45))).toBe('Dans 15 min · 14h – 15h30\nAgenda · Kompaly');
    expect(reminderBody({ kind: 'task', id: 't', title: 'X', date: '2026-10-17', time: '09:30' }, new Date(2026, 9, 16, 18, 0))).toBe('À faire demain · 9h30\nTâches · Kompaly');
  });

  it('rappel personnalisé : le moment choisi, ou la durée', () => {
    // Événement le vendredi 17 à 14h ; rappel la veille à 20h30 = 17 h 30 avant.
    expect(reminderLabel(17 * 60 + 30, true, '2026-10-17', '14:00')).toBe('La veille à 20h30');
    expect(reminderLabel(6 * 60 + 15, true, '2026-10-17', '14:00')).toBe('Le jour même à 7h45');
    expect(reminderLabel(3 * 1440 + 120, true, '2026-10-17', '14:00')).toBe('Mer. 14 oct. à 12h');
    expect(reminderLabel(15, true, '2026-10-17', '14:00')).toBe('15 min avant'); // les choix habituels gardent leur nom
    expect(offsetLabel(45)).toBe('45 min avant');
    expect(offsetLabel(210)).toBe('3 h 30 avant');
    expect(offsetLabel(2 * 1440 + 240)).toBe('2 j 4 h avant');
  });

  it('un rappel personnalisé reste quand on retire l’heure', () => {
    expect(adaptReminders([15, 1050], false, [0])).toEqual([1050]);
    expect(adaptReminders([15], false, [0])).toEqual([0]);
  });
});

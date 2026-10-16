import { describe, expect, it } from 'vitest';
import { parseQuickAdd, toKey } from '../src/lib/dates';
import { offsetLabel, reminderMoment, upcomingReminders } from '../src/lib/reminders';
import { parseIcs } from '../src/lib/ics';

// Regressions found by the « grand test » (logic part).

const base = new Date(2026, 9, 16, 10, 0); // Friday 16 October 2026
const q = (s: string, at = base) => {
  const r = parseQuickAdd(s, at);
  return { title: r.title, date: r.date, start: r.start, end: r.end };
};

describe('ajout rapide', () => {
  it.each([
    ['Faire exercices 5-6 pour lundi', 'Faire exercices 5-6', '2026-10-19'],
    ['Révisions chap 4-5 jeudi 14h', 'Révisions chap 4-5', '2026-10-22'],
    ['Exercice 12.3 jeudi', 'Exercice 12.3', '2026-10-22'],
    ['Lire pages 10-12', 'Lire pages 10-12', null],
  ])('les numéros ne sont pas des dates : %s', (s, title, date) => {
    expect([q(s).title, q(s).date]).toEqual([title, date]);
  });
  it('« le 12-11 » et « 12/11 » restent des dates', () => {
    expect(q('Rendre TP le 12-11').date).toBe('2026-11-12');
    expect(q('Rendre TP 12/11').date).toBe('2026-11-12');
  });
  it('29 février : la prochaine année bissextile', () => {
    expect(q('Anniv 29/02', new Date(2028, 3, 15)).date).toBe('2032-02-29');
    expect(q('Anniv 29 février').date).toBe('2028-02-29');
  });
  it('le soir et midi et demi', () => {
    expect(q('Rdv 8h du soir')).toMatchObject({ title: 'Rdv', start: '20:00' });
    expect(q('Rdv vendredi soir 8h').start).toBe('20:00');
    expect(q('Rdv midi et demi')).toMatchObject({ title: 'Rdv', start: '12:30' });
    expect(q('Déjeuner 12h-13h ce midi')).toEqual({ title: 'Déjeuner', date: '2026-10-16', start: '12:00', end: '13:00' });
  });
});

describe('rappels au changement d’heure', () => {
  it('« La veille à 18h » reste à 18h', () => {
    for (const day of ['2026-10-25', '2027-03-28']) {
      const at = reminderMoment(day, undefined, 900); // 9:00 the day itself − 15 h
      expect([toKey(at), at.getHours()]).toEqual([toKey(new Date(new Date(`${day}T12:00`).getTime() - 86_400_000)), 18]);
    }
    const [r] = upcomingReminders([{ kind: 'event', id: 'a', title: 'A', date: '2026-10-30', reminders: [7 * 1440] }], new Date(2026, 9, 16));
    expect([r.fireAt.getDate(), r.fireAt.getHours()]).toEqual([23, 9]);
  });
  it('libellé de durée', () => expect(offsetLabel(1470)).toBe('1 j 30 min avant'));
});

describe('import .ics', () => {
  const now = new Date(2026, 9, 16);
  const ev = (...l: string[]) => ['BEGIN:VEVENT', ...l, 'END:VEVENT'].join('\n');
  it('garde les lignes « Exporter… » et retire le bruit d’export', () => {
    const [e] = parseIcs(ev('UID:x', 'DTSTART:20261020T100000', 'DESCRIPTION:Exporter le rapport\\nMis à jour du planning\\n(Exporté le:16/10/2026 08:12)'), { now });
    expect(e.details).toBe('Exporter le rapport\nMis à jour du planning');
  });
  it('répétitions mensuelles, annuelles et jours ouvrés', () => {
    const anniv = parseIcs(ev('UID:a', 'DTSTART;VALUE=DATE:20000315', 'RRULE:FREQ=YEARLY'), { now }).map(e => e.date);
    expect(anniv).toContain('2027-03-15');
    const loyer = parseIcs(ev('UID:l', 'DTSTART;VALUE=DATE:20261105', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=5;COUNT=3'), { now }).map(e => e.date);
    expect(loyer).toEqual(['2026-11-05', '2026-12-05', '2027-01-05']);
    const second = parseIcs(ev('UID:m', 'DTSTART;VALUE=DATE:20261013', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=3'), { now }).map(e => e.date);
    expect(second).toEqual(['2026-10-13', '2026-11-10', '2026-12-08']);
    const days = parseIcs(ev('UID:o', 'DTSTART:20261019T080000', 'RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=10'), { now }).map(e => new Date(`${e.date}T12:00`).getDay());
    expect(days).toHaveLength(10);
    expect(days.some(d => d === 0 || d === 6)).toBe(false);
  });
  it('une réunion à 9h à New York garde 9h là-bas', () => {
    const list = parseIcs(ev('UID:ny', 'DTSTART;TZID=America/New_York:20261026T090000', 'DTEND;TZID=America/New_York:20261026T100000', 'RRULE:FREQ=WEEKLY;COUNT=2'), { now });
    const ny = (e: { date: string; start?: string }) => new Date(`${e.date}T${e.start}`).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' });
    expect(list.map(ny)).toEqual(['09', '09']);
  });
});


describe('ajout rapide (espaces perso)', () => {
  it('« à 14 heures », une date impossible, un « A » en fin de titre', () => {
    expect(q('Rdv dentiste à 14 heures')).toMatchObject({ title: 'Rdv dentiste', start: '14:00' });
    expect(q('Jour J le 30 février').date).toBeNull();
    expect(q('Réunion équipe A demain').title).toBe('Réunion équipe A');
  });
});

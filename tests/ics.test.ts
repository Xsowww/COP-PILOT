import { describe, expect, it } from 'vitest';
import { cancelledBy, parseIcs, parseStamp } from '../src/lib/ics';

const now = new Date(2026, 9, 12);
const cal = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
const ev = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

describe('parseIcs', () => {
  it('lit un événement simple, avec la salle dans les détails', () => {
    const [e] = parseIcs(cal(ev('UID:a', 'DTSTART:20261014T080000', 'DTEND:20261014T100000', 'SUMMARY:CM Chimie', 'LOCATION:Amphi A')), { now });
    expect(e).toMatchObject({ title: 'CM Chimie', date: '2026-10-14', start: '08:00', end: '10:00', externalId: 'a' });
    expect(e.details).toContain('Amphi A');
  });

  it('déroule une série hebdomadaire en sautant EXDATE et les séances annulées', () => {
    const text = cal(
      ev('UID:td', 'DTSTART:20261013T100000', 'DTEND:20261013T120000', 'RRULE:FREQ=WEEKLY;COUNT=4', 'EXDATE:20261027T100000', 'SUMMARY:TD'),
      ev('UID:td', 'RECURRENCE-ID:20261020T100000', 'DTSTART:20261020T100000', 'DTEND:20261020T120000', 'STATUS:CANCELLED', 'SUMMARY:TD'),
    );
    expect(parseIcs(text, { now }).map(e => e.date)).toEqual(['2026-10-13', '2026-11-03']);
  });

  it('une séance déplacée remplace celle de la série', () => {
    const text = cal(
      ev('UID:td', 'DTSTART:20261013T100000', 'DTEND:20261013T120000', 'RRULE:FREQ=WEEKLY;COUNT=2', 'SUMMARY:TD'),
      ev('UID:td', 'RECURRENCE-ID:20261020T100000', 'DTSTART:20261021T140000', 'DTEND:20261021T160000', 'SUMMARY:TD déplacé'),
    );
    expect(parseIcs(text, { now }).map(e => `${e.date} ${e.start} ${e.title}`)).toEqual(['2026-10-13 10:00 TD', '2026-10-21 14:00 TD déplacé']);
  });

  it('un événement sur une journée entière n’a pas d’heure', () => {
    const [e] = parseIcs(cal(ev('UID:f', 'DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261102', 'SUMMARY:Toussaint')), { now });
    expect(e.date).toBe('2026-11-01');
    expect(e.start).toBeUndefined();
  });
});

describe('cancelledBy', () => {
  it('reconnaît une séance annulée, une séance exclue et une série annulée', () => {
    const cancelled = cancelledBy(
      cal(
        ev('UID:td', 'DTSTART:20261013T100000', 'RRULE:FREQ=WEEKLY', 'EXDATE:20261027T100000', 'SUMMARY:TD'),
        ev('UID:td', 'RECURRENCE-ID:20261020T100000', 'DTSTART:20261020T100000', 'STATUS:CANCELLED'),
        ev('UID:cm', 'DTSTART:20261013T080000', 'RRULE:FREQ=WEEKLY', 'STATUS:CANCELLED'),
        ev('UID:solo', 'DTSTART:20261015T080000', 'STATUS:CANCELLED'),
      ),
    );
    expect(['td_20261020', 'td_20261027', 'cm_20261110', 'solo'].every(cancelled)).toBe(true);
    expect(cancelled('td_20261013')).toBe(false);
  });
});

describe('parseStamp', () => {
  it('convertit une heure avec TZID connu, quel que soit le fuseau de l’appareil', () => {
    expect(parseStamp('20261012T080000', { TZID: 'Europe/Paris' })!.date.getTime()).toBe(Date.UTC(2026, 9, 12, 6)); // heure d'été
    expect(parseStamp('20261212T080000', { TZID: 'Europe/Paris' })!.date.getTime()).toBe(Date.UTC(2026, 11, 12, 7));
    expect(parseStamp('20261012T080000', { TZID: 'America/Martinique' })!.date.getTime()).toBe(Date.UTC(2026, 9, 12, 12));
  });

  it('garde l’heure telle quelle pour un TZID inconnu', () => {
    expect(parseStamp('20261012T080000', { TZID: 'Romance Standard Time' })!.date.getHours()).toBe(8);
  });
});

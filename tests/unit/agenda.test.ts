import { describe, expect, it } from 'vitest';
import { versIcs } from '../../src/lib/agenda';
import { analyser } from '../../src/lib/parser';

const ics = (t: string) => versIcs(analyser(t).paliers, '2026-10-05', '08:00', new Date('2026-10-04T10:00:00Z'));
const deplier = (s: string) => s.replace(/\r\n /g, '');

describe('agenda (.ics)', () => {
  it('un rappel au début, à chaque changement de dose et à l’arrêt, pas de rappel quotidien', () => {
    const s = ics('20 mg 14 j puis 7,5 mg 7 j puis arrêt');
    const d = deplier(s);
    expect(d).toContain('DTSTART:20261005T080000\r\nDURATION:PT15M\r\nSUMMARY:Prednisone : début\\, 20 mg par jour');
    expect(d).toContain('DTSTART:20261019T080000\r\nDURATION:PT15M\r\nSUMMARY:Prednisone : nouvelle dose\\, 7\\,5 mg par jour');
    expect(d).toContain("jusqu'au 25/10/2026 inclus");
    expect(d).toContain('DTSTART:20261026T080000\r\nDURATION:PT15M\r\nSUMMARY:Prednisone : arrêt du traitement');
    expect(s).not.toContain('RRULE');
    expect(s.match(/BEGIN:VALARM/g)).toHaveLength(3);
    expect(s.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(s.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
  it('dernière dose à poursuivre', () => {
    expect(deplier(ics('10 mg 7 j puis 5 mg'))).toContain("jusqu'à nouvel avis médical");
  });
  it('un jour sur deux', () => {
    expect(deplier(ics('20 mg 1 j/2 pendant 14 j puis arrêt'))).toContain('20 mg un jour sur deux');
  });
});

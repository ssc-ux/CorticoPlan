/** Garde-fous issus de l'audit : durées, doses hors norme, molécule, liens patient, agenda. */
import { describe, expect, it } from 'vitest';
import { versIcs } from '../../src/lib/agenda';
import { analyser } from '../../src/lib/parser';
import { calendrier } from '../../src/lib/schedule';
import { decoderPaliers } from '../../src/lib/share';

const codes = (t: string) => analyser(t, { debut: '2026-11-12' }).problemes.filter((p) => p.niveau !== 'info').map((p) => p.code);

describe('durées', () => {
  it.each(['60 mg pendant 0 jours puis 30', '40 mg 1 mois puis -5 mg tous les 0 jours jusqu a 10', '20 mg 1,5 jours puis 10', '20 mg 99999999 semaines puis arret', '20 mg puis arret a 99999999 mois'])(
    'refuse « %s »',
    (t) => {
      const r = analyser(t, { debut: '2026-11-12' });
      expect(r.ok).toBe(false);
      expect(r.problemes.map((p) => p.code)).toContain('duree-invalide');
    },
  );
  it('accepte un mois et demi et 10 ans', () => {
    expect(codes('20 mg 1,5 mois puis arret')).toEqual([]);
    expect(codes('5 mg 520 semaines puis arret')).toEqual([]);
  });
  it('ne plante pas sur le calendrier d’un schéma accepté très long', () => {
    const r = analyser('5 mg 520 semaines puis arret');
    expect(() => calendrier(r.paliers, '2026-11-12')).not.toThrow();
  });
});

describe('durée du dernier palier', () => {
  it('est respectée : arrêt à son terme', () => {
    expect(analyser('40 mg 5 jours').paliers).toEqual([{ dose: 40, jours: 5 }, { dose: 0, jours: null }]);
    expect(analyser('40 mg 5 jours').problemes.map((p) => p.code)).toEqual(['arret-fin-duree']);
  });
  it('sans durée, la dernière dose est maintenue', () => {
    expect(analyser('40 mg 5 jours puis 20 mg').paliers).toEqual([{ dose: 40, jours: 5 }, { dose: 20, jours: null }]);
  });
});

describe('doses hors norme', () => {
  it('avertit au-dessus de 150 mg', () => expect(codes('500 mg 3 jours puis 60 mg 1 mois puis arret')).toEqual(['dose-elevee']));
  it('refuse au-dessus de 1000 mg', () => expect(analyser('99999 mg 3 semaines puis arret').ok).toBe(false));
  it('laisse passer 120 mg', () => expect(codes('120 mg 1 sem puis arret')).toEqual([]));
});

describe('autre molécule', () => {
  it('signale prednisolone et Solupred', () => {
    expect(codes('prednisolone 20 mg 5 jours puis arret')).toEqual(['autre-molecule']);
    expect(codes('Solupred 20 mg 5 jours puis arrêt')).toEqual(['autre-molecule']);
  });
  it('ne signale pas prednisone', () => expect(codes('prednisone 20 mg 5 jours puis arret')).toEqual([]));
});

describe('lien patient', () => {
  it('refuse une date invalide, des jours non entiers, trois doses', () => {
    expect(decoderPaliers('#p=20269999~40*28_5*')).toBeNull();
    expect(decoderPaliers('#p=20261112~40*1.5_5*')).toBeNull();
    expect(decoderPaliers('#p=20261112~40/20/10*7_5*')).toBeNull();
  });
  it('lit un lien correct', () => {
    expect(decoderPaliers('#p=20261112~40*28_20/0*14_0*')).toEqual({
      debut: '2026-11-12',
      paliers: [{ dose: 40, jours: 28 }, { dose: [20, 0], jours: 14 }, { dose: 0, jours: null }],
    });
  });
});

describe('agenda', () => {
  it('remplace une heure invalide par 8 h', () => {
    expect(versIcs([{ dose: 5, jours: null }], '2026-11-12', '25:99')).toContain('DTSTART:20261112T080000');
    expect(versIcs([{ dose: 5, jours: null }], '2026-11-12', '')).toContain('DTSTART:20261112T080000');
    expect(versIcs([{ dose: 5, jours: null }], '2026-11-12', '19:30')).toContain('DTSTART:20261112T193000');
  });
});

import { describe, expect, it } from 'vitest';
import { alertes } from '../../src/lib/alerts';
import { ajouterJours, dateFr, ecartJours, estDateValide, jourSemaine } from '../../src/lib/dates';
import { versTexte } from '../../src/lib/format';
import { analyser } from '../../src/lib/parser';
import { ordonnance } from '../../src/lib/prescription';
import { calendrier, doseCumulee } from '../../src/lib/schedule';
import { SCHEMAS } from '../../src/lib/schemas';
import { decoderPartage, encoderPartage } from '../../src/lib/share';
import type { Palier } from '../../src/lib/types';

const P: Palier[] = [
  { dose: 20, jours: 21 },
  { dose: 10, jours: 14 },
  { dose: [5, 0], jours: 7 },
  { dose: 5, jours: null },
];

describe('dates', () => {
  it('calcule sans décalage au changement d’heure', () => {
    expect(ajouterJours('2026-10-20', 14)).toBe('2026-11-03');
    expect(ecartJours('2026-03-28', '2026-03-30')).toBe(2);
    expect(dateFr('2026-10-02')).toBe('02/10/2026');
    expect(jourSemaine('2026-10-05')).toBe(0); // lundi
    expect(estDateValide('2026-02-30')).toBe(false);
  });
});

describe('calendrier et ordonnance', () => {
  it('date chaque palier et rédige l’ordonnance', () => {
    const lignes = calendrier(P, '2026-10-01');
    expect(lignes.map((l) => [l.debut, l.fin])).toEqual([
      ['2026-10-01', '2026-10-21'],
      ['2026-10-22', '2026-11-04'],
      ['2026-11-05', '2026-11-11'],
      ['2026-11-12', null],
    ]);
    expect(ordonnance(lignes)).toBe(
      'Prednisone 20 mg/j le matin du 01/10/2026 au 21/10/2026,\n' +
        'puis 10 mg/j le matin du 22/10/2026 au 04/11/2026,\n' +
        'puis 5 mg le matin un jour sur deux du 05/11/2026 au 11/11/2026,\n' +
        'puis 5 mg/j le matin à partir du 12/11/2026, à poursuivre.',
    );
  });

  it('écrit l’arrêt avec sa date', () => {
    const lignes = calendrier([{ dose: 60, jours: 21 }, { dose: 0, jours: null }], '2026-10-01');
    expect(ordonnance(lignes)).toBe('Prednisone 60 mg/j le matin du 01/10/2026 au 21/10/2026,\npuis arrêt le 22/10/2026.');
  });

  it('calcule la dose cumulée exacte, « un jour sur deux » compris', () => {
    expect(doseCumulee(P)).toBe(20 * 21 + 10 * 14 + 5 * 4);
  });
});

describe('texte canonique', () => {
  it('redonne exactement les mêmes paliers', () => {
    expect(analyser(versTexte(P)).paliers).toEqual(P);
  });
});

describe('partage', () => {
  it('encode et décode le schéma, accents compris', () => {
    const p = { texte: 'Prednisone 20 mg 3 sem puis arrêt — é', debut: '2026-10-01' };
    expect(decoderPartage('#' + encoderPartage(p))).toEqual(p);
    expect(decoderPartage('#s=!!!')).toBeNull();
    expect(decoderPartage('')).toBeNull();
  });
});

describe('schémas pré-remplis', () => {
  it('sont tous compris par le moteur, sans erreur', () => {
    for (const s of SCHEMAS) expect(analyser(s.texte).ok, s.nom).toBe(true);
  });
});

describe('alertes', () => {
  it('sont désactivées tant que les seuils valent TODO', () => {
    expect(alertes(calendrier(P, '2026-10-01'))).toEqual([]);
  });

  it('se déclenchent quand les seuils sont renseignés', () => {
    const cfg = {
      _lisezmoi: '',
      surrenalien: { description: 'Risque surrénalien', doseMg: 7.5, source: 'S1' },
      pneumocystose: { description: 'Prophylaxie', doseMinMg: 20, dureeMinJours: 21, source: 'S2' },
      osteoporose: { description: 'Ostéoporose', dureeMinJours: 90, source: 'S3' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = alertes(calendrier(P, '2026-10-01'), cfg as any);
    expect(a.map((x) => x.source)).toEqual(['S1', 'S2', 'S3']);
    expect(a[0]!.message).toContain('05/11/2026'); // 10 mg puis 5 mg un jour sur deux
  });
});

import { EXEMPLES } from '../../src/lib/exemples';
describe('exemples du champ de saisie', () => {
  it('sont tous compris sans erreur ni avertissement', () => {
    for (const e of EXEMPLES) {
      const r = analyser(e);
      expect(r.problemes.filter((p) => p.niveau !== 'info'), e).toEqual([]);
    }
  });
});

describe('QR code patient (format compact)', () => {
  it('aller-retour', async () => {
    const { encoderPaliers, decoderPaliers } = await import('../../src/lib/share');
    const paliers = analyser('40 mg 3 sem puis 17,5 mg 2 sem puis 20 mg 1 j/2 pendant 14 j puis 5 mg').paliers;
    const h = encoderPaliers(paliers, '2026-10-04');
    expect(h).toBe('p=20261004~40*21_17.5*14_20/0*14_5*');
    expect(decoderPaliers('#' + h)).toEqual({ paliers, debut: '2026-10-04' });
    expect(decoderPaliers('#p=20261004~abc')).toBeNull();
  });
});

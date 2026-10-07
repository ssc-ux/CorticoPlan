import { describe, expect, it } from 'vitest';
import { reformuler } from '../../src/lib/format';
import { analyser } from '../../src/lib/parser';
import { normaliser } from '../../src/lib/parser/normalize';

describe('normaliser', () => {
  it('conserve la longueur pour que les positions restent valables', () => {
    const t = 'Diminuer de 5 mg jusqu’à l’arrêt — ½ cp, Évaluer\r\n';
    expect(normaliser(t)).toHaveLength(t.length);
    expect(normaliser('Décroissance À')).toBe('decroissance a');
  });
});

describe('surlignage', () => {
  it('donne la position exacte du mot non compris dans le texte d’origine', () => {
    const texte = 'Prédnisone 20 mg Réévalué 3 sem';
    const p = analyser(texte).problemes.find((x) => x.code === 'mot-inconnu');
    expect(p?.span && texte.slice(...p.span)).toBe('Réévalué');
  });
});

describe('reformulation', () => {
  it('écrit une ligne lisible par palier', () => {
    expect(
      reformuler([
        { dose: 20, jours: 21 },
        { dose: [20, 0], jours: 7 },
        { dose: 7.5, jours: null },
        { dose: 0, jours: null },
      ]),
    ).toEqual([
      '20 mg/j pendant 3 semaines',
      '20 mg un jour sur deux pendant 1 semaine',
      '7,5 mg/j, à poursuivre',
      'Arrêt',
    ]);
  });
});

describe('robustesse', () => {
  it('ne plante jamais, quelle que soit la saisie', () => {
    const saisies = ['', '   ', '\n\n', 'puis puis', '-', '->', '/', '1/2', 'mg', '0', 'jusqu’à', '20 mg -0/sem jusqu’à 10',
      '9999999 mg', '20 mg 0 j', 'à', '½', '1,', ',5', 'un', 'deux et demi', 'mois mois', 'arrêt arrêt', '20 mg 1 j/2 1 j/2'];
    for (const s of saisies) expect(() => analyser(s)).not.toThrow();
  });

  it('un pas nul est refusé au lieu de boucler', () => {
    expect(analyser('20 mg 1 sem puis -0 mg/sem jusqu’à 10').ok).toBe(false);
  });

  it('la convention « mois » est réglable', () => {
    expect(analyser('20 mg 1 mois puis 10 mg', { joursParMois: 30 }).paliers[0]).toEqual({ dose: 20, jours: 30 });
  });
});

describe('objectifs datés : date anniversaire', () => {
  it('« à 6 mois » tombe le même jour 6 mois plus tard ; paliers en semaines entières, jamais en retard', () => {
    const r = analyser('20 mg 1 mois puis 5 mg à 6 mois', { debut: '2026-10-07' });
    expect(r.objectifs).toEqual([{ jour: 182, dose: 5 }]); // 07/04/2027
    const avant5 = r.paliers.slice(0, -1).reduce((s, p) => s + p.jours!, 0);
    expect(avant5).toBeLessThanOrEqual(182);
    expect(r.paliers.slice(1, -1).every((p) => p.jours! % 7 === 0)).toBe(true);
    expect(r.problemes.find((p) => p.code === 'objectif-calcule')?.message).toContain('07/04/2027');
  });
  it('31 janvier + 1 mois = fin février', () => {
    expect(analyser('20 mg puis 10 mg à M1', { debut: '2027-01-31' }).objectifs).toEqual([{ jour: 28, dose: 10 }]);
  });
});

import { describe, expect, it } from 'vitest';
import { analyser } from '../../src/lib/parser';
import { proposer } from '../../src/lib/parser/propose';

const propositions = (t: string) => proposer(t, analyser(t, { joursParMois: 28 }), { joursParMois: 28 }).map((p) => p.texte);

describe('propositions de correction (au lieu du rouge)', () => {
  it('mot ambigu ou trop éloigné : remplacement proposé', () => {
    expect(propositions('40 mg 1 mois puis baser de 5 mg tous les 15j')).toEqual(['40 mg 1 mois puis baisser de 5 mg tous les 15j']);
    expect(propositions('40 mg 1 mois puis dimi 5 mg chaq semaine jusqu 10')[0]).toBe('40 mg 1 mois puis diminue 5 mg chaque semaine jusqu’à 10');
  });
  it('fourchette : les deux valeurs proposées', () => {
    expect(propositions('20 mg 2 sem puis 10 mg 3-4 semaines puis arrêt')).toEqual([
      '20 mg 2 sem puis 10 mg 3 semaines puis arrêt',
      '20 mg 2 sem puis 10 mg 4 semaines puis arrêt',
    ]);
  });
  it('mot parasite : suppression proposée', () => {
    expect(propositions('40 mg 1 mois puis 30 mg 2 sem xyz')).toEqual(['40 mg 1 mois puis 30 mg 2 sem']);
  });
  it('texte compris : rien à proposer', () => {
    expect(propositions('40 mg 1 mois puis arrêt')).toEqual([]);
  });
  it('chaque proposition est comprise par le moteur', () => {
    for (const t of propositions('40 mg 1 mois puis bsser de 5 mg ttes les 15j')) expect(analyser(t).ok).toBe(true);
  });
});

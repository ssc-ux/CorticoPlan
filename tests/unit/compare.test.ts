import { describe, expect, it } from 'vitest';
import { doseLe, dosesParJour, reperes, semaine } from '../../src/lib/compare';
import { analyser } from '../../src/lib/parser';

const p = (t: string) => analyser(t).paliers;

describe('comparateur', () => {
  it('repères d’un schéma qui s’arrête', () => {
    const r = reperes(p('20 mg 2 sem puis 10 mg 2 sem puis 5 mg 1 sem puis arrêt'));
    expect(r).toEqual({ initiale: 20, sous75: 28, sous5: 28, arret: 35, duree: 35, cumul: 20 * 14 + 10 * 14 + 5 * 7 });
  });
  it('dernière dose à poursuivre : pas d’arrêt, seuil atteint au dernier palier', () => {
    const r = reperes(p('15 mg 1 sem puis 5 mg'));
    expect(r.arret).toBeNull();
    expect(r.sous5).toBe(7);
    expect(r.sous75).toBe(7);
  });
  it('seuil jamais atteint', () => {
    expect(reperes(p('20 mg 1 sem puis 10 mg')).sous5).toBeNull();
  });
  it('dose d’un jour, après la fin', () => {
    const paliers = p('20 mg 7 j puis 10 mg');
    expect(dosesParJour(paliers)).toHaveLength(7);
    expect(doseLe(paliers, 6)).toBe(20);
    expect(doseLe(paliers, 100)).toBe(10);
    expect(doseLe(p('20 mg 7 j puis arrêt'), 30)).toBe(0);
  });
  it('semaine', () => {
    expect(semaine(0)).toBe('S1');
    expect(semaine(7)).toBe('S2');
  });
});

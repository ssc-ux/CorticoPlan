import { describe, expect, it } from 'vitest';
import { analyser } from '../../src/lib/parser';
import { chercher, contient, PROTOCOLES, schemaPour } from '../../src/lib/protocoles';
import { SCHEMAS } from '../../src/lib/schemas';

const noms = (q: string) => chercher(q).map((s) => s.protocole.nom);

describe('protocoles', () => {
  it('chaque schéma appartient à un protocole et chaque combinaison de choix mène à un seul schéma', () => {
    expect(PROTOCOLES.reduce((n, p) => n + p.schemas.length, 0)).toBe(SCHEMAS.length);
    for (const p of PROTOCOLES)
      for (const s of p.schemas) expect(schemaPour(p, s.choix ?? {}), `${p.nom} ${s.nom}`).toBe(s);
  });
  it('« pexivas » propose PEXIVAS avec ses choix triés', () => {
    const [s] = chercher('pexivas');
    expect(s!.protocole.nom).toBe('PEXIVAS');
    expect(s!.protocole.criteres).toEqual([
      { nom: 'Dose', valeurs: ['Réduite · PNDS', 'Standard · essai'] },
      { nom: 'Poids', valeurs: ['< 50 kg', '50 à 75 kg', '> 75 kg'] },
    ]);
  });
  it('un nombre tapé présélectionne le choix correspondant', () => {
    expect(chercher('pexivas 62 kg')[0]!.preselection).toEqual({ Poids: '50 à 75 kg' });
    expect(chercher('select-gca 50')[0]!.preselection).toEqual({ Départ: '50 mg' });
    expect(chercher('aurora 45')[0]!.preselection).toEqual({ Poids: '≥ 45 kg' });
  });
  it('recherche par maladie, synonyme ou début de mot ; le PNDS en tête', () => {
    expect(noms('lupus')[0]).toBe('PNDS Lupus');
    expect(noms('lupus')).toContain('KDIGO 2024');
    expect(noms('wegener')).toEqual(['PEXIVAS', 'ADVOCATE']);
    expect(noms('hort')[0]).toBe('PNDS Horton');
    expect(noms('eular/acr')).toEqual(['EULAR/ACR 2015']);
    expect(noms('churg')).toEqual(['MANDARA']);
  });
  it('rien pour un schéma écrit ou un nombre seul', () => {
    for (const t of ['40', '40 mg 1 mois puis arrêt', '20 mg 2 sem puis -5 mg/sem jusqu’à 10 mg', 'arrêt'])
      expect(chercher(t), t).toEqual([]);
  });
  it('le nom d’un protocole n’est pas un schéma valide (le déroulant s’ouvre)', () => {
    for (const p of PROTOCOLES) expect(analyser(p.nom).ok, p.nom).toBe(false);
  });
  it('bornes des valeurs', () => {
    expect(contient('< 50 kg', 49)).toBe(true);
    expect(contient('< 50 kg', 50)).toBe(false);
    expect(contient('80 kg et plus', 95)).toBe(true);
    expect(contient('17,5 à 19,5 mg', 18)).toBe(true);
  });
});

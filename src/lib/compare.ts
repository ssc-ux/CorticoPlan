/**
 * Comparateur de décroissance : dose de chaque jour et repères chiffrés d'un
 * schéma (calcul pur, sans affichage).
 */
import { doseCumulee, doseMoyenne, dureeTotale } from './schedule';
import type { Palier } from './types';

export interface Reperes {
  /** Dose du premier jour (mg). */
  initiale: number;
  /** Premier jour (0 = début) où la dose est ≤ 7,5 mg, sinon null. */
  sous75: number | null;
  /** Premier jour où la dose est ≤ 5 mg, sinon null. */
  sous5: number | null;
  /** Jour de l'arrêt, ou null si la dernière dose est « à poursuivre ». */
  arret: number | null;
  /** Durée des paliers de durée connue (jours). */
  duree: number;
  /** Dose cumulée sur cette durée (mg). */
  cumul: number;
}

/** Dose moyenne de chaque jour, sur les paliers de durée connue. */
export function dosesParJour(paliers: Palier[]): number[] {
  const jours: number[] = [];
  for (const p of paliers) {
    if (p.jours === null) break;
    for (let k = 0; k < p.jours; k++) jours.push(doseMoyenne(p.dose));
  }
  return jours;
}

/** Dose d'un jour donné, y compris après la fin (dernière dose maintenue, ou 0 après l'arrêt). */
export function doseLe(paliers: Palier[], jour: number): number {
  let debut = 0;
  for (const p of paliers) {
    if (p.jours === null || jour < debut + p.jours) return doseMoyenne(p.dose);
    debut += p.jours;
  }
  return 0;
}

export function reperes(paliers: Palier[]): Reperes {
  const jours = dosesParJour(paliers);
  const dernier = paliers[paliers.length - 1];
  const finale = dernier ? doseMoyenne(dernier.dose) : 0;
  const premier = (seuil: number) => {
    const j = jours.findIndex((d) => d <= seuil);
    if (j >= 0) return j;
    return finale <= seuil && dernier?.jours === null ? jours.length : null;
  };
  return {
    initiale: paliers.length ? doseMoyenne(paliers[0]!.dose) : 0,
    sous75: premier(7.5),
    sous5: premier(5),
    arret: dernier && dernier.dose === 0 ? dureeTotale(paliers) : null,
    duree: dureeTotale(paliers),
    cumul: doseCumulee(paliers),
  };
}

/** « S5 » : semaine (commençant à 1) d'un jour compté depuis 0. */
export function semaine(jour: number): string {
  return `S${Math.floor(jour / 7) + 1}`;
}

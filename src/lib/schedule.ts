/**
 * Paliers + date de début → lignes datées du tableau.
 */
import { ajouterJours } from './dates';
import type { Dose, Palier } from './types';

export interface Ligne {
  index: number;
  dose: Dose;
  debut: string;
  /** Dernier jour inclus ; `null` = à poursuivre (ou arrêt). */
  fin: string | null;
  jours: number | null;
}

export function calendrier(paliers: Palier[], debut: string): Ligne[] {
  let jour = debut;
  return paliers.map((p, index) => {
    const ligne: Ligne = {
      index,
      dose: p.dose,
      debut: jour,
      fin: p.jours === null ? null : ajouterJours(jour, p.jours - 1),
      jours: p.jours,
    };
    if (p.jours !== null) jour = ajouterJours(jour, p.jours);
    return ligne;
  });
}

/** Dose moyenne d'un jour (une alternance compte pour la moyenne des deux). */
export function doseMoyenne(dose: Dose): number {
  return typeof dose === 'number' ? dose : (dose[0] + dose[1]) / 2;
}

/** Dose du jour n (0 = premier jour du palier) : gère les alternances. */
export function doseDuJour(dose: Dose, n: number): number {
  return typeof dose === 'number' ? dose : dose[n % 2]!;
}

/** Dose cumulée exacte (mg) sur les paliers de durée connue. */
export function doseCumulee(paliers: Palier[]): number {
  let total = 0;
  for (const p of paliers) {
    if (p.jours === null) break;
    for (let n = 0; n < p.jours; n++) total += doseDuJour(p.dose, n);
  }
  return total;
}

/** Durée totale (jours) jusqu'au début du dernier palier « à poursuivre ». */
export function dureeTotale(paliers: Palier[]): number {
  return paliers.reduce((s, p) => s + (p.jours ?? 0), 0);
}

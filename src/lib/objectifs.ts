/**
 * Repères datés des PNDS (« ≤ 15 mg/j à M3 ») et vérification d'un schéma.
 * Sert à l'alerte discrète de l'onglet « Comparer » : le schéma écrit
 * dépasse-t-il un repère du PNDS de la maladie affichée ?
 */
import donnees from '../data/objectifs-pnds.json';
import { doseLe } from './compare';
import { moisEnJours } from './dates';
import type { Palier } from './types';

export interface ObjectifsPnds {
  pathologie: string;
  /** Dose maximale (mg/j) à `mois` mois du début ; 0 = sevrage. */
  reperes: { mois: number; dose: number }[];
  citation: string;
  verification: string;
  valide: boolean;
  source: { document: string; annee: number; url: string; page: string };
}

export const OBJECTIFS_PNDS: ObjectifsPnds[] = donnees.objectifs;

export interface Ecart {
  pathologie: string;
  mois: number;
  /** Repère du PNDS (mg/j). */
  repere: number;
  /** Dose du schéma à cette date (mg/j). */
  dose: number;
  source: ObjectifsPnds['source'];
}

/** Les PNDS donnent des repères, pas des dates exactes : une semaine de marge. */
const MARGE_JOURS = 7;
/** Mois calendaire moyen, si la date de début est inconnue. */
const JOURS_PAR_MOIS_CALENDAIRE = 30.4375;

/**
 * Repères du PNDS non respectés par le schéma (J1 = début du traitement).
 * Les mois sont calendaires (date anniversaire si `debut` est connue), quel
 * que soit le réglage « 1 mois = 28 jours » des durées.
 */
export function ecartsPnds(paliers: Palier[], pathologies: string[], debut?: string): Ecart[] {
  return OBJECTIFS_PNDS.filter((o) => pathologies.includes(o.pathologie)).flatMap((o) =>
    o.reperes
      .map((r) => ({ r, dose: doseLe(paliers, moisEnJours(r.mois, JOURS_PAR_MOIS_CALENDAIRE, debut) + MARGE_JOURS) }))
      .filter(({ r, dose }) => dose > r.dose + 1e-9)
      .map(({ r, dose }) => ({ pathologie: o.pathologie, mois: r.mois, repere: r.dose, dose, source: o.source })),
  );
}

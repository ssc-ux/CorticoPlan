/**
 * Mise en forme lisible des paliers (reformulation affichée sous le champ).
 */
import type { Dose, Palier } from './types';
import { nombreFr } from './parser/normalize';

/** « 7,5 mg/j », « 10 mg et 7,5 mg en alternance », « 20 mg un jour sur deux ». */
export function formatDose(dose: Dose): string {
  if (typeof dose === 'number') return `${nombreFr(dose)} mg/j`;
  const [a, b] = dose;
  if (b === 0) return `${nombreFr(a)} mg un jour sur deux`;
  return `${nombreFr(a)} mg et ${nombreFr(b)} mg en alternance un jour sur deux`;
}

/** 21 → « 3 semaines », 10 → « 10 jours », 7 → « 1 semaine ». */
export function formatDuree(jours: number): string {
  if (jours % 7 === 0) {
    const n = jours / 7;
    return `${n} semaine${n > 1 ? 's' : ''}`;
  }
  return `${jours} jour${jours > 1 ? 's' : ''}`;
}

/** Une ligne de reformulation par palier. */
export function reformuler(paliers: Palier[]): string[] {
  return paliers.map((p) => {
    if (p.dose === 0) return 'Arrêt';
    if (p.jours === null) return `${formatDose(p.dose)}, à poursuivre`;
    return `${formatDose(p.dose)} pendant ${formatDuree(p.jours)}`;
  });
}

/**
 * Texte d'ordonnance, prêt à copier-coller dans la vraie ordonnance.
 * Ex. : « Prednisone 20 mg/j le matin du 01/10/2026 au 21/10/2026, »
 */
import { nombreFr } from './parser/normalize';
import { dateFr } from './dates';
import type { Ligne } from './schedule';
import type { Dose } from './types';

function posologie(dose: Dose): string {
  if (typeof dose === 'number') return `${nombreFr(dose)} mg/j le matin`;
  const [a, b] = dose;
  if (b === 0) return `${nombreFr(a)} mg le matin un jour sur deux`;
  return `${nombreFr(a)} mg et ${nombreFr(b)} mg le matin en alternance un jour sur deux`;
}

export function ordonnance(lignes: Ligne[]): string {
  const morceaux = lignes.map((l, i) => {
    const debutPhrase = i === 0 ? 'Prednisone ' : 'puis ';
    if (l.dose === 0) return `${i === 0 ? 'Prednisone : ' : 'puis '}arrêt le ${dateFr(l.debut)}`;
    if (l.fin === null) return `${debutPhrase}${posologie(l.dose)} à partir du ${dateFr(l.debut)}, à poursuivre`;
    if (l.fin === l.debut) return `${debutPhrase}${posologie(l.dose)} le ${dateFr(l.debut)}`;
    return `${debutPhrase}${posologie(l.dose)} du ${dateFr(l.debut)} au ${dateFr(l.fin)}`;
  });
  return morceaux.length ? morceaux.join(',\n') + '.' : '';
}

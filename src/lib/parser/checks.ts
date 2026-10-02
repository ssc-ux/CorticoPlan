/**
 * Finitions et contrôles de cohérence sur la liste de paliers.
 * Les contrôles n'empêchent rien : ils produisent des avertissements visibles.
 */
import type { Dose, Palier, Probleme } from '../types';
import { nombreFr } from './normalize';

const doseMax = (d: Dose) => (typeof d === 'number' ? d : Math.max(d[0], d[1]));
const memeDose = (a: Dose, b: Dose) =>
  typeof a === 'number' ? typeof b === 'number' && a === b : typeof b !== 'number' && a[0] === b[0] && a[1] === b[1];

/** Fusionne deux paliers consécutifs de même dose (« 10 mg 1 sem puis 10 mg 2 sem »). */
export function fusionner(paliers: Palier[]): Palier[] {
  const sortie: Palier[] = [];
  for (const p of paliers) {
    const prec = sortie[sortie.length - 1];
    if (prec && prec.jours !== null && memeDose(prec.dose, p.dose)) {
      prec.jours = p.jours === null ? null : prec.jours + p.jours;
    } else {
      sortie.push({ ...p });
    }
  }
  return sortie;
}

/** Applique la règle « dernière dose maintenue » et vérifie la cohérence. */
export function verifier(paliers: Palier[], problemes: Probleme[]): Palier[] {
  const liste = fusionner(paliers);
  const dernier = liste[liste.length - 1];

  // Le schéma se termine sur la dernière dose écrite, maintenue.
  if (dernier && dernier.jours !== null && dernier.dose !== 0) {
    problemes.push({
      code: 'duree-dernier-palier-ignoree',
      niveau: 'info',
      message: `Dernier palier : la durée écrite est remplacée par « à poursuivre » (la dose de ${formatDose(dernier.dose)} est maintenue).`,
    });
    dernier.jours = null;
  }

  liste.forEach((p, i) => {
    const prec = liste[i - 1];
    if (prec && doseMax(p.dose) > doseMax(prec.dose)) {
      problemes.push({
        code: 'dose-remonte',
        niveau: 'avertissement',
        message: `La dose remonte de ${formatDose(prec.dose)} à ${formatDose(p.dose)} (palier ${i + 1}).`,
      });
    }
    const valeurs = typeof p.dose === 'number' ? [p.dose] : p.dose;
    if (valeurs.some((v) => !Number.isInteger(v * 2))) {
      problemes.push({
        code: 'dose-non-realisable',
        niveau: 'avertissement',
        message: `${formatDose(p.dose)} n’est pas réalisable avec des comprimés de 1 mg sécables (pas de 0,5 mg).`,
      });
    }
    if (p.dose === 0 && i < liste.length - 1) {
      problemes.push({ code: 'paliers-apres-arret', niveau: 'erreur', message: 'Des paliers suivent l’arrêt.' });
    }
  });
  return liste;
}

function formatDose(d: Dose): string {
  return typeof d === 'number' ? `${nombreFr(d)} mg` : `${nombreFr(d[0])}/${nombreFr(d[1])} mg`;
}

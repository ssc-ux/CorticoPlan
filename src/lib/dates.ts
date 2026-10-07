/**
 * Dates « calendaires » au format AAAA-MM-JJ, calculées en UTC pour éviter
 * les décalages dus aux changements d'heure.
 */

const JOUR_MS = 86_400_000;

export function aujourdhui(): string {
  const d = new Date();
  return versIso(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function versIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function versMs(iso: string): number {
  const [a, m, j] = iso.split('-').map(Number);
  return Date.UTC(a!, m! - 1, j!);
}

export function ajouterJours(iso: string, jours: number): string {
  return versIso(versMs(iso) + jours * JOUR_MS);
}

/** Même jour, `n` mois plus tard (31 janvier + 1 mois → 28 ou 29 février). */
export function ajouterMois(iso: string, n: number): string {
  const [a, m, j] = iso.split('-').map(Number);
  const dernier = new Date(Date.UTC(a!, m! - 1 + n + 1, 0)).getUTCDate();
  return versIso(Date.UTC(a!, m! - 1 + n, Math.min(j!, dernier)));
}

export function ecartJours(debut: string, fin: string): number {
  return Math.round((versMs(fin) - versMs(debut)) / JOUR_MS);
}

/** « 2026-10-01 » → « 01/10/2026 ». */
export function dateFr(iso: string): string {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

/** « 2026-10-01 » → « 01/10 » (format court pour le calendrier). */
export function dateCourte(iso: string): string {
  const [, m, j] = iso.split('-');
  return `${j}/${m}`;
}

/** Jour de la semaine, 0 = lundi … 6 = dimanche. */
export function jourSemaine(iso: string): number {
  return (new Date(versMs(iso)).getUTCDay() + 6) % 7;
}

export function estDateValide(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(versMs(iso)) && versIso(versMs(iso)) === iso;
}

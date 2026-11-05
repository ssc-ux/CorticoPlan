/**
 * Recherche de protocole depuis le champ principal (« pexivas », « horton 60 »…).
 * Les schémas d'un même protocole sont regroupés ; leurs « choix » (poids, bras,
 * dose de départ…) deviennent des puces à cocher pour retrouver le bon schéma.
 */
import { court, rang, SCHEMAS, type Schema } from './schemas';

export interface Critere {
  nom: string;
  valeurs: string[];
}

export interface Protocole {
  cle: string;
  nom: string;
  pathologie: string;
  schemas: Schema[];
  criteres: Critere[];
  /** Mots (sans accents, minuscules) sur lesquels porte la recherche. */
  mots: string[];
}

export type Selection = Record<string, string>;

export interface Suggestion {
  protocole: Protocole;
  /** Choix déduits des nombres tapés (« pexivas 62 » → Poids : 50 à 75 kg). */
  preselection: Selection;
}

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Autres noms tapés par les médecins, par maladie. */
const SYNONYMES: [RegExp, string][] = [
  [/ANCA/, 'gpa pam wegener vaa'],
  [/Horton/, 'acg arterite temporale gca'],
  [/Lupus/, 'lupus nephrite lupique lin les'],
  [/GEPA/, 'churg strauss egpa'],
  [/Pseudopolyarthrite/, 'ppr pmr'],
  [/PTI/, 'itp thrombopenie'],
  [/AHAI|hémolytique/, 'ahai anemie'],
  [/Behçet/, 'behcet'],
  [/Dermatomyosite/, 'myosite dm'],
  [/PAN/, 'pan polyarterite periarterite'],
  [/Sarcoïdose/, 'sarcoidose bbs'],
];

/** Valeur numérique pour trier « < 50 kg », « 50 à 75 kg », « > 75 kg ». */
function valeurTri(v: string): number {
  const m = v.match(/\d+(?:,\d+)?/);
  if (!m) return NaN;
  const n = parseFloat(m[0].replace(',', '.'));
  return /^[<≤]/.test(v) ? n - 0.5 : /^[>≥]/.test(v) || /et plus/.test(v) ? n + 0.5 : n;
}

/** Le nombre tapé tombe-t-il dans cette valeur (« 62 » dans « 50 à 75 kg ») ? */
export function contient(valeur: string, n: number): boolean {
  const nb = [...valeur.matchAll(/\d+(?:,\d+)?/g)].map((m) => parseFloat(m[0].replace(',', '.')));
  if (!nb.length) return false;
  const a = nb[0]!;
  if (/^</.test(valeur)) return n < a;
  if (/^≤/.test(valeur)) return n <= a;
  if (/^>/.test(valeur)) return n > a;
  if (/^≥|et plus/.test(valeur)) return n >= a;
  if (nb.length === 2 && / à /.test(valeur)) return n >= a && n <= nb[1]!;
  return n === a;
}

function construire(): Protocole[] {
  const groupes = new Map<string, Schema[]>();
  for (const s of SCHEMAS) {
    const cle = `${s.pathologie}|${s.protocole}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), s]);
  }
  return [...groupes].map(([cle, schemas]) => {
    const s0 = schemas[0]!;
    const noms = [...new Set(schemas.flatMap((s) => Object.keys(s.choix ?? {})))];
    const criteres = noms.map((nom) => {
      const valeurs = [...new Set(schemas.map((s) => s.choix?.[nom]).filter((v): v is string => !!v))];
      if (valeurs.every((v) => !isNaN(valeurTri(v)))) valeurs.sort((a, b) => valeurTri(a) - valeurTri(b));
      return { nom, valeurs };
    });
    const extra = SYNONYMES.filter(([re]) => re.test(s0.pathologie) || re.test(court(s0.pathologie))).map(([, m]) => m);
    const types = schemas.map((s) => (s.statut.startsWith("issu d'un essai") ? 'essai' : 'recommandation'));
    const texte = [s0.protocole, s0.pathologie, court(s0.pathologie), ...extra, ...types].join(' ');
    return { cle, nom: s0.protocole, pathologie: s0.pathologie, schemas, criteres, mots: [...new Set(norm(texte).split(/[^a-z0-9]+/).filter(Boolean))] };
  });
}

export const PROTOCOLES: Protocole[] = construire();

/** Schéma correspondant aux choix, s'ils sont tous faits. */
export function schemaPour(p: Protocole, sel: Selection): Schema | undefined {
  if (p.criteres.some((c) => !sel[c.nom])) return undefined;
  return p.schemas.find((s) => p.criteres.every((c) => s.choix?.[c.nom] === sel[c.nom]));
}

/** Ce choix mène-t-il à au moins un schéma, compte tenu des autres choix ? */
export function possible(p: Protocole, sel: Selection, critere: string, valeur: string): boolean {
  const essai = { ...sel, [critere]: valeur };
  return p.schemas.some((s) => Object.entries(essai).every(([k, v]) => s.choix?.[k] === v));
}

const UNITES = new Set(['kg', 'mg', 'j']);

/**
 * Protocoles qui correspondent au texte tapé. Chaque mot doit commencer un mot du
 * protocole (nom, maladie, synonymes) ; les nombres servent à présélectionner.
 * Rien n'est proposé pour un texte sans mot (« 40 ») ou trop long pour être une recherche.
 */
export function chercher(texte: string, max = 6): Suggestion[] {
  const t = norm(texte.trim());
  if (!t || t.length > 40 || /\n/.test(t)) return [];
  const jetons = t.split(/[^a-z0-9,.]+/).map((j) => j.replace(/^[.,]+|[.,]+$/g, '')).filter((j) => j && !UNITES.has(j));
  const nombres = jetons.filter((j) => /^\d+(?:[.,]\d+)?$/.test(j)).map((j) => parseFloat(j.replace(',', '.')));
  const mots = jetons.filter((j) => !/^\d/.test(j)).flatMap((j) => j.split(/[.,]/)).filter(Boolean);
  if (!mots.length) return [];
  const trouves = PROTOCOLES.filter((p) => mots.every((m) => p.mots.some((w) => w.startsWith(m))));
  const surNom = (p: Protocole) => (mots.some((m) => norm(p.nom).split(/[^a-z0-9]+/).some((w) => w.startsWith(m))) ? 0 : 1);
  trouves.sort((a, b) => surNom(a) - surNom(b) || rang(a.schemas[0]!) - rang(b.schemas[0]!));
  return trouves.slice(0, max).map((protocole) => {
    const preselection: Selection = {};
    for (const c of protocole.criteres) {
      if (c.valeurs.length === 1) preselection[c.nom] = c.valeurs[0]!;
      for (const n of nombres) {
        const v = c.valeurs.filter((x) => contient(x, n));
        if (v.length === 1 && !preselection[c.nom]) preselection[c.nom] = v[0]!;
      }
    }
    return { protocole, preselection };
  });
}

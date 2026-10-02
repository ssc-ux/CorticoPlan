/**
 * Découpage du texte normalisé en jetons typés (« lexer »).
 *
 * Chaque jeton garde sa position dans le texte d'origine (`span`), ce qui
 * permet de surligner ce qui n'a pas été compris. Le découpeur ne décide rien
 * du sens : il reconnaît des briques (nombre, durée, pas, rythme…) que
 * l'assembleur combinera ensuite.
 */
import type { Span } from '../types';
import { lireChiffres, lireLettres, lireNombre, type NombreLu } from './numbers';

export type TypeJeton =
  | 'nombre' // 20, vingt, 12,5
  | 'duree' // 3 sem, 15 j, 1 mois (valeur en jours)
  | 'mg' // mg, mg/j
  | 'mgkg' // mg/kg : non pris en charge
  | 'cp' // 1 cp : dose en comprimés, non prise en charge
  | 'fourchette' // 3-4 semaines : à préciser
  | 'pas' // baisser de, diminuer de, par paliers de
  | 'moins' // -5
  | 'rythme' // /sem, tous les 15 j (valeur en jours)
  | 'jusqua' // jusqu'à, ->, →
  | 'a' // « à » isolé (de 20 à 10)
  | 'et'
  | 'slash' // / entre deux doses (10/7,5)
  | 'alternance' // en alternance
  | 'unJourSurDeux' // 1 j/2, un jour sur deux
  | 'arret' // arrêt, stop
  | 'sep' // puis, virgule, point-virgule, point, retour à la ligne
  | 'inconnu';

export interface Jeton {
  type: TypeJeton;
  span: Span;
  valeur?: number;
  /** Vrai si la durée ou le rythme est exprimé en mois. */
  mois?: boolean;
}

/** Fabrique une expression régulière « collante » (ancrée à la position). */
const re = (source: string) => new RegExp(source, 'y');

const FIN_MOT = '(?![a-z])';
const JUSQUA_SUITE =
  "jusqu[ ]*'?[ ]*(?:a|au)[ ]+(?:nouvel[ ]+(?:ordre|avis)|(?:la[ ]+|l'|le[ ]+)?(?:prochaine?[ ]+)?" +
  "(?:reevaluation|consultation|rdv|rendez[- ]vous|controle|avis[ ]+medical|bilan))";
const UNITE = `[ ]*(?:(jours?|jrs?|j)|(semaines?|sem|s)|(mois)|(cps?|cpr|comprimes?))${FIN_MOT}`;
const RE_UNITE = re(UNITE);

/** Mots sans importance pour le sens, ignorés sans signalement. */
const MOTS_NEUTRES = new Set([
  'prednisone', 'cortancyl', 'le', 'la', 'les', "l'", 'l', 'de', "d'", 'd', 'du',
  'des', 'pendant', 'pdt', 'durant', 'sur', 'matin', 'matins', 'au', 'en',
  'prise', 'prises', 'dose', 'doses', 'soit', 'par', 'jour', 'jours',
  'quotidien', 'quotidienne', 'partir', 'x', 'po', 'os', 'per', 'unique',
  'une', 'un', 'fois', 'maintien', 'entretien',
]);

interface Regle {
  re: RegExp;
  /** Construit le jeton ; `null` = texte reconnu mais ignoré. */
  jeton: (m: RegExpExecArray) => Omit<Jeton, 'span'> | null;
}

/** Règles essayées dans l'ordre à chaque position. */
const REGLES: Regle[] = [
  { re: re('\\n'), jeton: () => ({ type: 'sep' }) },
  { re: re('->|=>|→|>'), jeton: () => ({ type: 'jusqua' }) },
  {
    re: re(`(?:un|1)[ ]*(?:jours?|j)[ ]*(?:\\/|sur)[ ]*(?:deux|2)(?![a-z0-9])`),
    jeton: () => ({ type: 'unJourSurDeux' }),
  },
  {
    // « 3-4 semaines », « 3 à 4 sem », « 10-15 mg » : valeur à préciser.
    // (« de 20 à 10 mg » n'est PAS une fourchette : borne d'une décroissance.)
    re: re(
      `\\d+(?:[.,]\\d+)?[ ]*(?:(?:-|a|ou)[ ]*\\d+(?:[.,]\\d+)?${UNITE}|(?:-|ou)[ ]*\\d+(?:[.,]\\d+)?(?=[ ]*mg${FIN_MOT}))`,
    ),
    jeton: () => ({ type: 'fourchette' }),
  },
  // « à poursuivre », « à maintenir jusqu'à réévaluation », « jusqu'à nouvel ordre » :
  // confirment que la dernière dose est maintenue (c'est déjà la règle) → ignorés.
  {
    re: re(
      `(?:(?:a[ ]+)?(?:poursuivre|continuer|maintenir)(?:[ ]+${JUSQUA_SUITE})?|${JUSQUA_SUITE})${FIN_MOT}`,
    ),
    jeton: () => null,
  },
  { re: re(`mg[ ]*\\/[ ]*kg(?:[ ]*\\/[ ]*(?:jours?|j))?${FIN_MOT}`), jeton: () => ({ type: 'mgkg' }) },
  {
    re: re(`(?:mg|milligrammes?)(?:[ ]*\\/[ ]*(?:jours?|j|24[ ]*h))?${FIN_MOT}`),
    jeton: () => ({ type: 'mg' }),
  },
  // « /j », « par jour », « chaque jour », « tous les jours » : simple précision.
  { re: re(`(?:\\/|par|chaque|tous[ ]+les)[ ]*(?:jours?|j)${FIN_MOT}`), jeton: () => null },
  { re: re(`(?:\\/|par|chaque|toutes[ ]+les)[ ]*(?:semaines?|sem|s)${FIN_MOT}`), jeton: () => ({ type: 'rythme', valeur: 7 }) },
  { re: re(`hebdomadaire${FIN_MOT}`), jeton: () => ({ type: 'rythme', valeur: 7 }) },
  { re: re(`(?:\\/|par|chaque|tous[ ]+les)[ ]*mois${FIN_MOT}|mensuel(?:le)?${FIN_MOT}`), jeton: () => ({ type: 'rythme', valeur: 1, mois: true }) },
  { re: re(`jusqu[ ]*'?[ ]*(?:a|au)${FIN_MOT}|jusqu'`), jeton: () => ({ type: 'jusqua' }) },
  {
    re: re(
      `(?:baisser|diminuer|reduire|decroitre|descendre|baisse|diminution|reduction|decroissance|degression|moins|enlever|retirer|oter)` +
        `(?:[ ]+(?:de|par))?${FIN_MOT}|(?:par[ ]+)?paliers?[ ]+de${FIN_MOT}`,
    ),
    jeton: () => ({ type: 'pas' }),
  },
  { re: re(`(?:en[ ]+)?alternance${FIN_MOT}|altern(?:e|es|ee|ees|er|ant)${FIN_MOT}`), jeton: () => ({ type: 'alternance' }) },
  { re: re(`arret(?:er)?${FIN_MOT}|stop(?:per)?${FIN_MOT}`), jeton: () => ({ type: 'arret' }) },
  { re: re(`(?:puis|apres|ensuite)${FIN_MOT}|[,;.]`), jeton: () => ({ type: 'sep' }) },
  { re: re('\\/'), jeton: () => ({ type: 'slash' }) },
  { re: re(`et${FIN_MOT}`), jeton: () => ({ type: 'et' }) },
  { re: re(`a(?![a-z'])`), jeton: () => ({ type: 'a' }) },
  { re: re('[:×*+()]'), jeton: () => null },
];

const RE_MOT = re("[a-z]+'?");
const RE_TOUS_LES = re(`(?:tou(?:te)?s[ ]+les|chaque)[ ]+`);

/** Lit une unité (jours, semaines, mois, comprimés) juste après un nombre. */
function lireUnite(s: string, pos: number, valeur: number, joursParMois: number) {
  RE_UNITE.lastIndex = pos;
  const m = RE_UNITE.exec(s);
  if (!m) return null;
  const fin = pos + m[0].length;
  if (m[1]) return { fin, jeton: { type: 'duree' as const, valeur } };
  if (m[2]) return { fin, jeton: { type: 'duree' as const, valeur: valeur * 7 } };
  if (m[3]) return { fin, jeton: { type: 'duree' as const, valeur: valeur * joursParMois, mois: true } };
  return { fin, jeton: { type: 'cp' as const, valeur } };
}

/** « tous les 15 jours », « toutes les 2 semaines », « tous les deux mois ». */
function lireRythme(s: string, pos: number, joursParMois: number) {
  RE_TOUS_LES.lastIndex = pos;
  const m = RE_TOUS_LES.exec(s);
  if (!m) return null;
  const nombre = lireNombre(s, pos + m[0].length);
  if (!nombre) return null;
  const unite = lireUnite(s, nombre.fin, nombre.valeur, joursParMois);
  if (!unite || unite.jeton.type !== 'duree') return null;
  return { fin: unite.fin, jeton: { ...unite.jeton, type: 'rythme' as const } };
}

/** Nombre (chiffres ou lettres) suivi éventuellement d'une unité. */
function lireQuantite(s: string, pos: number, joursParMois: number) {
  let nombre: NombreLu | null = lireChiffres(s, pos);
  let enLettres = false;
  if (!nombre) {
    nombre = lireLettres(s, pos);
    enLettres = true;
  }
  if (!nombre) return null;
  const unite = lireUnite(s, nombre.fin, nombre.valeur, joursParMois);
  if (unite) return unite;
  // « un », « une » sans unité sont des articles, pas des doses.
  if (enLettres && (nombre.valeur === 1 || nombre.valeur === 0.5)) return null;
  // « /15 j » : rythme écrit avec une barre (géré par l'appelant via slash).
  return { fin: nombre.fin, jeton: { type: 'nombre' as const, valeur: nombre.valeur } };
}

/** Découpe le texte normalisé en jetons. */
export function decouper(s: string, joursParMois: number): Jeton[] {
  const jetons: Jeton[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === ' ') {
      i++;
      continue;
    }
    const lu = lireJeton(s, i, joursParMois);
    if (lu.jeton) {
      const jeton: Jeton = { ...lu.jeton, span: [i, lu.fin] };
      // « par mois », « mensuel » : la règle ne connaît pas la convention.
      if (jeton.type === 'rythme' && jeton.mois && jeton.valeur === 1) jeton.valeur = joursParMois;
      jetons.push(jeton);
    }
    i = lu.fin;
  }
  return fusionnerRythmesBarres(jetons);
}

function lireJeton(s: string, i: number, joursParMois: number): { fin: number; jeton: Omit<Jeton, 'span'> | null } {
  // Les règles fixes passent d'abord, sauf les nombres qui doivent être lus
  // avant « a » ou les mots inconnus.
  for (const regle of REGLES.slice(0, 4)) {
    const lu = essayer(regle, s, i);
    if (lu) return lu;
  }
  const rythme = lireRythme(s, i, joursParMois);
  if (rythme) return rythme;
  const quantite = lireQuantite(s, i, joursParMois);
  if (quantite) return quantite;
  // « -5 », « - 5 », « -dix » : signe moins devant un nombre = pas de baisse.
  if (s[i] === '-') {
    let j = i + 1;
    while (s[j] === ' ') j++;
    if (lireNombre(s, j)) return { fin: i + 1, jeton: { type: 'moins' } };
  }
  for (const regle of REGLES.slice(4)) {
    const lu = essayer(regle, s, i);
    if (lu) return lu;
  }
  RE_MOT.lastIndex = i;
  const mot = RE_MOT.exec(s);
  if (mot) {
    const fin = i + mot[0].length;
    return { fin, jeton: MOTS_NEUTRES.has(mot[0]) ? null : { type: 'inconnu' } };
  }
  // Caractère isolé non reconnu.
  return { fin: i + 1, jeton: { type: 'inconnu' } };
}

function essayer(regle: Regle, s: string, i: number) {
  regle.re.lastIndex = i;
  const m = regle.re.exec(s);
  if (!m || m[0].length === 0) return null;
  return { fin: i + m[0].length, jeton: regle.jeton(m) };
}

/** « -5/15 j » : une barre suivie d'une durée est un rythme (« tous les 15 j »). */
function fusionnerRythmesBarres(jetons: Jeton[]): Jeton[] {
  const sortie: Jeton[] = [];
  for (let k = 0; k < jetons.length; k++) {
    const t = jetons[k]!;
    const suivant = jetons[k + 1];
    if (t.type === 'slash' && suivant?.type === 'duree') {
      sortie.push({ ...suivant, type: 'rythme', span: [t.span[0], suivant.span[1]] });
      k++;
      continue;
    }
    sortie.push(t);
  }
  return sortie;
}

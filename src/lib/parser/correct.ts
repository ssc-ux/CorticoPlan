/**
 * Correction automatique des fautes de frappe et d'orthographe.
 *
 * Un mot inconnu est remplacé par le mot du vocabulaire le plus proche s'il
 * n'en diffère que d'une lettre (deux pour les mots longs) : lettre en trop,
 * en moins, remplacée ou inversée. Si deux mots sont aussi proches, on ne
 * corrige pas (pas de devinette). Chaque correction est signalée.
 *
 * Le texte corrigé peut changer de longueur : une table de correspondance
 * permet de retrouver la position de chaque caractère dans le texte d'origine
 * (pour le surlignage).
 */

/** Mots que le moteur comprend (texte normalisé, sans accents). */
const VOCABULAIRE = [
  'semaine', 'semaines', 'jour', 'jours', 'mois', 'puis', 'pendant', 'durant', 'jusqu', 'jusqua', 'baisser', 'baisse',
  'diminuer', 'diminue', 'diminution', 'decroissance', 'reduire', 'reduction', 'degression', 'enlever', 'retirer',
  'moins', 'arret', 'arreter', 'stop', 'stopper', 'sevrage', 'prednisone', 'prednisolone', 'cortancyl', 'solupred',
  'milligrammes', 'milligramme', 'toutes', 'tous', 'chaque', 'alternance', 'quinzaine', 'maintenir', 'poursuivre',
  'continuer', 'environ', 'matin', 'ensuite', 'apres', 'palier', 'paliers', 'atteindre', 'progressive', 'progressif',
  'progressivement', 'corticotherapie', 'cortisone', 'hebdomadaire', 'mensuel', 'mensuelle', 'demi', 'demie',
  'comprime', 'comprimes', 'reevaluation', 'consultation', 'nouvel', 'ordre', 'long', 'cours', 'total', 'complet',
  'definitif', 'maintien', 'entretien', 'quotidien', 'quotidienne', 'traitement', 'deux', 'trois', 'quatre', 'cinq',
  'six', 'sept', 'huit', 'neuf', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'trente',
  'quarante', 'cinquante', 'soixante', 'pendant', 'jusqu', 'dose', 'doses', 'prise', 'schema', 'posologie',
  'objectif', 'objectifs', 'cible', 'ligne', 'nouvelle', 'retour', 'point', 'virgule', 'kilo', 'kilos', 'kilogramme', 'kilogrammes', // dictée vocale
];

/** Mots courts ou abréviations connus : jamais corrigés. */
const CONNUS = new Set([
  ...VOCABULAIRE, 'j', 'jr', 'jrs', 's', 'sem', 'mg', 'kg', 'cp', 'cps', 'cpr', 'h', 'x', 'et', 'a', 'de', 'du', 'le',
  'la', 'les', 'l', 'd', 'en', 'au', 'un', 'une', 'par', 'sur', 'pdt', 'po', 'os', 'per', 'on', 'ou', 'dix', 'zero',
  'soit', 'fois', 'unique', 'partir', 'jusque', 'des', 'ce', 'se', 'si', 'ne', 'pas', 'vie', 'sans', 'avec',
]);

/** Fautes fréquentes impossibles à corriger par la distance seule. */
const ALIAS: Record<string, string> = { mgs: 'mg', mgr: 'mg', mgrs: 'mg', smn: 'sem', sm: 'sem', jr: 'j', jrs: 'jrs' };

/** Mots de même sens pour le moteur : une égalité entre eux n'est pas une ambiguïté. */
const MEDICAMENT = new Set(['prednisone', 'prednisolone', 'cortancyl', 'solupred', 'cortisone', 'corticotherapie']);
const equivalents = (a: string, b: string) =>
  a.startsWith(b) || b.startsWith(a) || (MEDICAMENT.has(a) && MEDICAMENT.has(b)); // « jour »/« jours », « prednisone »/« prednisolone »

/** Distance de Damerau-Levenshtein (insertion, suppression, substitution, inversion). */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

function corrigerMot(mot: string): string | null {
  if (CONNUS.has(mot)) return null;
  if (ALIAS[mot]) return ALIAS[mot]!;
  if (mot.length < 3) return null;
  const seuil = mot.length >= 7 ? 2 : 1;
  let meilleur: string | null = null;
  let dMin = Infinity;
  let ex = false;
  for (const v of VOCABULAIRE) {
    if (Math.abs(v.length - mot.length) > seuil) continue;
    const dd = distance(mot, v);
    if (dd < dMin) {
      dMin = dd;
      meilleur = v;
      ex = false;
    } else if (dd === dMin && v !== meilleur && !equivalents(v, meilleur!)) ex = true;
  }
  return meilleur && dMin <= seuil && !ex ? meilleur : null;
}

export interface TexteCorrige {
  texte: string;
  /** Pour chaque caractère du texte corrigé : position de début / fin dans l'original. */
  debut: number[];
  fin: number[];
  corrections: { avant: string; apres: string; span: [number, number] }[];
}

/** Corrige les mots inconnus d'un texte déjà normalisé. */
export function corriger(s: string): TexteCorrige {
  const sortie: TexteCorrige = { texte: '', debut: [], fin: [], corrections: [] };
  let pos = 0;
  const copier = (jusqua: number) => {
    for (; pos < jusqua; pos++) {
      sortie.texte += s[pos];
      sortie.debut.push(pos);
      sortie.fin.push(pos + 1);
    }
  };
  for (const m of s.matchAll(/[a-z]+/g)) {
    const d = m.index!;
    const f = d + m[0].length;
    // Lettres collées à un chiffre (« 3semianes ») : le mot reste un mot.
    const apres = corrigerMot(m[0]);
    if (!apres) continue;
    copier(d);
    for (const c of apres) {
      sortie.texte += c;
      sortie.debut.push(d);
      sortie.fin.push(f);
    }
    pos = f;
    sortie.corrections.push({ avant: m[0], apres, span: [d, f] });
  }
  copier(s.length);
  return sortie;
}

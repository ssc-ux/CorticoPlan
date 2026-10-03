/**
 * Lecture des nombres, en chiffres (« 12,5 », « ½ ») ou en lettres
 * (« vingt-cinq », « deux et demi »), dans un texte déjà normalisé.
 */

export interface NombreLu {
  valeur: number;
  /** Position juste après le nombre. */
  fin: number;
}

/** Nombres en lettres reconnus (texte normalisé, sans accents). */
const MOTS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
  sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
  quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40,
  cinquante: 50, soixante: 60, 'quatre-vingt': 80, 'quatre-vingts': 80,
  demi: 0.5, demie: 0.5,
};

const RE_CHIFFRES = /(\d+(?:[.,]\d+)?)(?: *½)?|½/y;
// Un mot-nombre, éventuellement « quatre-vingt(s) » qui contient un tiret.
const RE_MOT = /(quatre[- ]vingts?|[a-z]+)(?![a-z])/y;
// Liaison entre deux mots-nombres : « - », espace, « et ».
const RE_LIAISON = /(?: *- *| +et +| +)/y;

/** Lit un nombre écrit en chiffres à la position `pos`. */
export function lireChiffres(s: string, pos: number): NombreLu | null {
  RE_CHIFFRES.lastIndex = pos;
  const m = RE_CHIFFRES.exec(s);
  if (!m) return null;
  if (m[0] === '½') return { valeur: 0.5, fin: pos + 1 };
  let valeur = Number(m[1]!.replace(',', '.'));
  if (m[0].includes('½')) valeur += 0.5;
  return { valeur, fin: pos + m[0].length };
}

function lireMot(s: string, pos: number): { valeur: number; fin: number } | null {
  RE_MOT.lastIndex = pos;
  const m = RE_MOT.exec(s);
  if (!m) return null;
  const mot = m[1]!.replace(' ', '-');
  const valeur = MOTS[mot];
  return valeur === undefined ? null : { valeur, fin: pos + m[0].length };
}

/**
 * Règles d'enchaînement du français : une dizaine accepte une unité
 * (vingt-cinq), « dix » accepte une unité (dix-sept), soixante et
 * quatre-vingt acceptent aussi 10 à 19 (soixante-quinze). Après une unité,
 * seul « demi » peut suivre : « vingt cinq quatre » n'est pas 29.
 */
function peutSuivre(precedent: number, valeur: number): boolean {
  if (precedent === 60 || precedent === 80) return valeur >= 1 && valeur <= 19;
  if (precedent >= 20 && precedent % 10 === 0) return valeur >= 1 && valeur <= 9;
  if (precedent === 10) return valeur >= 7 && valeur <= 9;
  return false;
}

/**
 * Lit un nombre écrit en lettres (« soixante-dix-sept » = 60 + 10 + 7) ;
 * « demi » ajoute 0,5.
 */
export function lireLettres(s: string, pos: number): NombreLu | null {
  // Le mot doit commencer en début de mot.
  if (pos > 0 && /[a-z0-9]/.test(s[pos - 1]!)) return null;
  const premier = lireMot(s, pos);
  if (!premier) return null;
  let total = premier.valeur;
  let precedent = premier.valeur;
  let fin = premier.fin;
  for (;;) {
    RE_LIAISON.lastIndex = fin;
    const liaison = RE_LIAISON.exec(s);
    if (!liaison) break;
    const suivant = lireMot(s, fin + liaison[0].length);
    if (!suivant) break;
    const estDemi = suivant.valeur === 0.5;
    if (!estDemi && !peutSuivre(precedent, suivant.valeur)) break;
    total += suivant.valeur;
    precedent = suivant.valeur;
    fin = suivant.fin;
    if (estDemi) break;
  }
  return { valeur: total, fin };
}

/** Lit un nombre en chiffres ou en lettres. */
export function lireNombre(s: string, pos: number): NombreLu | null {
  const n = lireChiffres(s, pos) ?? lireLettres(s, pos);
  return n && avecVirgule(s, n);
}

/** Dictée vocale : « deux virgule cinq » = 2,5 ; sinon le nombre tel quel. */
export function avecVirgule(s: string, n: NombreLu): NombreLu {
  RE_VIRGULE.lastIndex = n.fin;
  const v = RE_VIRGULE.exec(s);
  if (!v) return n;
  const d = lireChiffres(s, n.fin + v[0].length) ?? lireLettres(s, n.fin + v[0].length);
  if (!d || !Number.isInteger(d.valeur) || d.valeur >= 100) return n;
  return { valeur: n.valeur + d.valeur / 10 ** String(d.valeur).length, fin: d.fin };
}
const RE_VIRGULE = /[ ]+virgule[ ]+/y;

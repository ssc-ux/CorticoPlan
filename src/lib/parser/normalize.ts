/**
 * Normalisation du texte saisi.
 *
 * Contrainte : le texte normalisé a EXACTEMENT la même longueur que le texte
 * d'origine (un caractère pour un caractère). Ainsi, une position trouvée dans
 * le texte normalisé désigne le même endroit dans le texte d'origine, ce qui
 * permet de surligner les mots non compris.
 */

/** Remplacements de caractères typographiques par leur équivalent simple. */
const EQUIVALENTS: Record<string, string> = {
  '’': "'", // apostrophe typographique ’
  '‘': "'",
  'ʼ': "'",
  '−': '-', // signe moins −
  '–': '-', // tiret demi-cadratin –
  '—': '-', // tiret cadratin —
  ' ': ' ', // espace insécable
  ' ': ' ', // espace fine insécable
  '\t': ' ',
  '\r': ' ',
};

/** Minuscules, sans accents, ponctuation simplifiée ; longueur conservée. */
export function normaliser(texte: string): string {
  let sortie = '';
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!;
    const equivalent = EQUIVALENTS[c];
    if (equivalent !== undefined) {
      sortie += equivalent;
      continue;
    }
    // Décompose « é » en « e » + accent, puis retire l'accent.
    const simple = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // Si la transformation change la longueur (rare : ligatures…), on garde
    // le caractère d'origine en minuscule pour ne pas décaler les positions.
    sortie += simple.length === 1 ? simple : c.toLowerCase().length === 1 ? c.toLowerCase() : c;
  }
  return sortie;
}

/** Formate un nombre à la française : 12.5 → « 12,5 ». */
export function nombreFr(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

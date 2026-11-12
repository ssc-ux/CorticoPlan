/**
 * Propositions de correction : au lieu de seulement signaler ce qui n'est pas
 * compris, on essaie des réécritures (mot proche, mot en trop, valeur d'une
 * fourchette) et on ne propose que celles que le moteur comprend mieux.
 * Rien n'est appliqué sans un geste du médecin.
 */
import type { Options, ResultatAnalyse } from '../types';
import { motsProches } from './correct';
import { analyser } from './index';

export interface Proposition {
  /** Texte complet corrigé. */
  texte: string;
  /** Morceaux pour l'affichage : `avant` barré, `apres` mis en valeur. */
  morceaux: { t: string; avant?: string; apres?: string }[];
  /** Le texte corrigé est entièrement compris. */
  ok: boolean;
}

/** Orthographe affichée (le vocabulaire du moteur est sans accents). */
const AFFICHAGE: Record<string, string> = {
  jusqu: 'jusqu’à', jusqua: 'jusqu’à', arret: 'arrêt', arreter: 'arrêter', decroissance: 'décroissance',
  reduire: 'réduire', reduction: 'réduction', degression: 'dégression', apres: 'après', reevaluation: 'réévaluation',
  definitif: 'définitif', corticotherapie: 'corticothérapie', schema: 'schéma', progressive: 'progressive',
  hebdomadaire: 'hebdomadaire', comprime: 'comprimé', comprimes: 'comprimés',
};
/** Mots de dictée ou trop vagues : jamais proposés en remplacement. */
const EXCLUS = new Set(['ligne', 'nouvelle', 'retour', 'point', 'virgule', 'kilo', 'kilos', 'kilogramme', 'kilogrammes', 'ordre', 'long', 'cours', 'nouvel']);

interface Edition {
  d: number;
  f: number;
  par: string;
}

const score = (r: ResultatAnalyse) =>
  r.problemes.filter((p) => p.niveau === 'erreur').length * 10 + r.problemes.filter((p) => p.niveau === 'avertissement').length;

function appliquer(texte: string, eds: Edition[]): string {
  let s = texte;
  for (const e of [...eds].sort((a, b) => b.d - a.d)) s = s.slice(0, e.d) + e.par + s.slice(e.f);
  return s;
}

function morceaux(texte: string, eds: Edition[]): Proposition['morceaux'] {
  const sortie: Proposition['morceaux'] = [];
  let pos = 0;
  for (const e of [...eds].sort((a, b) => a.d - b.d)) {
    if (e.d > pos) sortie.push({ t: texte.slice(pos, e.d) });
    sortie.push({ t: '', avant: texte.slice(e.d, e.f), apres: e.par });
    pos = e.f;
  }
  if (pos < texte.length) sortie.push({ t: texte.slice(pos) });
  return sortie;
}

/** Retire un mot et un espace autour, sans laisser d'espace double. */
function suppression(texte: string, d: number, f: number): Edition {
  if (texte[f] === ' ') return { d, f: f + 1, par: '' };
  if (texte[d - 1] === ' ') return { d: d - 1, f, par: '' };
  return { d, f, par: '' };
}

/** Réécritures possibles pour un problème signalé à un endroit précis. */
function candidats(texte: string, code: string, d: number, f: number): Edition[] {
  const extrait = texte.slice(d, f);
  if (code === 'mot-inconnu') {
    const mots = /^[a-zà-ÿ]+$/i.test(extrait) ? motsProches(extrait).filter((m) => !EXCLUS.has(m)) : [];
    return [...mots.map((m) => ({ d, f, par: AFFICHAGE[m] ?? m })), suppression(texte, d, f)];
  }
  if (code === 'fourchette') {
    // « 3-4 semaines », « 3 à 4 sem » : l'une ou l'autre valeur.
    const m = /^(\d+(?:[.,]\d+)?)\s*(?:-|à|a|ou)\s*(\d+(?:[.,]\d+)?)(.*)$/i.exec(extrait);
    if (m) return [{ d, f, par: `${m[1]}${m[3]}` }, { d, f, par: `${m[2]}${m[3]}` }];
  }
  return [];
}

/**
 * Jusqu'à `max` propositions, de la plus complète à la moins complète.
 * Chaque proposition corrige tout ce qu'elle peut ; les variantes changent
 * la réécriture d'un seul endroit.
 */
export function proposer(texte: string, resultat: ResultatAnalyse, options: Partial<Options> = {}, max = 3): Proposition[] {
  if (resultat.ok) return [];
  const base = score(resultat);
  const lieux = resultat.problemes
    .filter((p) => p.span && (p.code === 'mot-inconnu' || p.code === 'fourchette'))
    .map((p) => ({ code: p.code, d: p.span![0], f: p.span![1] }))
    .filter((l, i, t) => t.findIndex((u) => u.d === l.d) === i)
    .sort((a, b) => a.d - b.d);
  if (!lieux.length || lieux.length > 4) return [];

  const evaluer = (eds: Edition[]) => {
    const t = appliquer(texte, eds);
    const r = analyser(t, options);
    // Supprimer un mot peut changer le sens : à égalité, on préfère le remplacer.
    return { eds, t, r, s: score(r) + eds.filter((e) => !e.par).length * 2, cle: JSON.stringify(r.paliers) + t.replace(/\D/g, '') };
  };

  // Meilleure réécriture de chaque endroit, les autres étant déjà corrigés au mieux.
  const choix: Edition[] = [];
  const variantes: { i: number; e: Edition }[] = [];
  for (const l of lieux) {
    const essais = candidats(texte, l.code, l.d, l.f)
      .map((e) => evaluer([...choix, e]))
      .sort((a, b) => a.s - b.s);
    if (!essais.length) continue;
    for (const v of essais.slice(1)) variantes.push({ i: choix.length, e: v.eds.at(-1)! });
    choix.push(essais[0]!.eds.at(-1)!);
  }
  if (!choix.length) return [];

  const complet = evaluer(choix);
  const sortie = [complet, ...variantes.map((v) => evaluer(choix.map((c, j) => (j === v.i ? v.e : c))))]
    .filter((p) => p.s < base)
    // Deux corrections qui donnent le même schéma avec les mêmes nombres : une seule suffit.
    .filter((p, i, t) => t.findIndex((u) => u.t === p.t || (u.cle === p.cle && p.r.ok)) === i)
    .sort((a, b) => Number(b.r.ok) - Number(a.r.ok) || a.s - b.s);
  // Une proposition qui compile tout éclipse celles qui laissent des erreurs.
  const retenues = sortie[0]?.r.ok ? sortie.filter((p) => p.r.ok) : sortie;
  return retenues.slice(0, max).map((p) => ({ texte: p.t, morceaux: morceaux(texte, p.eds), ok: p.r.ok }));
}

/**
 * Schémas pré-remplis (mode « Choisir un schéma »).
 */
import donnees from '../data/schemas.json';

export interface Schema {
  pathologie: string;
  nom: string;
  texte: string;
  mgKg: boolean;
  statut: string;
  /** Ce que CorticoPlan a réellement lu pour établir ce schéma. */
  verification: string;
  /** Passe à true quand le prescripteur a vérifié le schéma dans sa source. */
  valide: boolean;
  source: { document: string; annee: number; version: string; url: string; page: string };
}

/** Les schémas en mg/kg sont exclus : CorticoPlan travaille en doses fixes. */
export const SCHEMAS: Schema[] = (donnees.schemas as Schema[]).filter((s) => !s.mgKg);

export const PATHOLOGIES: string[] = [...new Set(SCHEMAS.map((s) => s.pathologie))].sort((a, b) => a.localeCompare(b, 'fr'));

export const estEssai = (s: Schema) => s.statut.startsWith("issu d'un essai");
/** Schéma issu (ou construit sur les repères) d'un PNDS de la HAS : toujours en tête de liste. */
export const estPnds = (s: Schema) => !estEssai(s) && /PNDS/.test(s.statut + s.source.document);
/** Ordre d'affichage : PNDS, puis recommandations, puis essais. */
export const rang = (s: Schema) => (estPnds(s) ? 0 : estEssai(s) ? 2 : 1);
export const schemasDe = (p: string) => SCHEMAS.filter((s) => s.pathologie === p).sort((a, b) => rang(a) - rang(b));
/** Libellé court : « Artérite à cellules géantes (Horton) » → « Horton ». */
export const court = (p: string) =>
  p
    .replace(/^Artérite à cellules géantes.*/, 'Horton')
    .split(/[(:]/)[0]!
    .replace('Anémie hémolytique auto-immune', 'AHAI')
    .replace('Purpura thrombopénique immunologique', 'PTI')
    .replace(/^Granulomatose éosinophilique.*/, 'GEPA')
    .trim();

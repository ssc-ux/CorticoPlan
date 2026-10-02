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

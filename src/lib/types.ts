/**
 * Types partagés par tout le moteur.
 *
 * Le modèle unique est la liste de paliers : le texte libre, les schémas PNDS
 * et l'édition du tableau produisent tous un `Palier[]`.
 */

/** Dose quotidienne en mg, ou alternance [jour 1, jour 2] (ex. [10, 7.5]). */
export type Dose = number | [number, number];

export interface Palier {
  dose: Dose;
  /** Durée en jours ; `null` = à poursuivre (dernier palier uniquement). */
  jours: number | null;
}

/** Portion du texte d'origine : [début, fin[ en index de caractères. */
export type Span = [number, number];

export type Niveau = 'erreur' | 'avertissement' | 'info';

/** Codes stables, utilisés par l'interface et par les tests du corpus. */
export type CodeProbleme =
  | 'mot-inconnu'
  | 'mg-kg-non-pris-en-charge'
  | 'dose-en-comprimes'
  | 'fourchette'
  | 'segment-incompris'
  | 'dose-ambigue'
  | 'duree-manquante'
  | 'duree-deduite'
  | 'duree-dernier-palier-ignoree'
  | 'pas-manquant'
  | 'rythme-manquant'
  | 'borne-manquante'
  | 'borne-incoherente'
  | 'borne-inatteignable'
  | 'alternance-incomplete'
  | 'dose-remonte'
  | 'dose-non-realisable'
  | 'paliers-apres-arret'
  | 'convention-mois';

export interface Probleme {
  code: CodeProbleme;
  niveau: Niveau;
  message: string;
  span?: Span;
}

export interface Options {
  /** Nombre de jours comptés pour « 1 mois » (4 semaines par défaut). */
  joursParMois: number;
}

export interface ResultatAnalyse {
  paliers: Palier[];
  problemes: Probleme[];
  /** Reformulation lisible, une ligne par palier. */
  reformulation: string[];
  /** Vrai si aucune erreur : le schéma est utilisable. */
  ok: boolean;
}

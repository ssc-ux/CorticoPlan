/**
 * Types partagés par tout le moteur.
 *
 * Le modèle unique est la liste de paliers : le texte libre, les schémas PNDS
 * et l'édition du tableau produisent tous un `Palier[]`.
 */

/**
 * Dose quotidienne en mg, ou « un jour sur deux » : [dose, 0].
 * (L'alternance entre deux doses non nulles, ex. 10/7,5, n'est pas utilisée.)
 */
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
  | 'correction-auto'
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
  | 'borne-par-defaut'
  | 'borne-incoherente'
  | 'borne-inatteignable'
  | 'alternance-incomplete'
  | 'alternance-deux-doses'
  | 'dose-remonte'
  | 'dose-non-realisable'
  | 'paliers-apres-arret'
  | 'convention-mois'
  | 'echeance-manquante'
  | 'echeance-depassee'
  | 'objectif-rapide'
  | 'objectif-calcule';

export interface Probleme {
  code: CodeProbleme;
  niveau: Niveau;
  message: string;
  span?: Span;
  /** Réponses proposées en un geste : texte à insérer à une position du texte d'origine. */
  suggestions?: { libelle: string; position: number; insertion: string }[];
}

export interface Options {
  /** Nombre de jours comptés pour « 1 mois » (4 semaines par défaut). */
  joursParMois: number;
  /**
   * Date de début (AAAA-MM-JJ). Si connue, les échéances en mois (« à 6 mois »,
   * « M6 ») tombent à la date anniversaire ; sinon 1 mois = `joursParMois`.
   */
  debut?: string;
}


export interface ResultatAnalyse {
  paliers: Palier[];
  problemes: Probleme[];
  /** Reformulation lisible, une ligne par palier. */
  reformulation: string[];
  /** Vrai si aucune erreur : le schéma est utilisable. */
  ok: boolean;
}

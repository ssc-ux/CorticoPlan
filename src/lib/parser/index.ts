/**
 * Analyseur de texte libre : point d'entrée unique du moteur.
 *
 *   texte → normaliser → découper (jetons) → assembler (paliers) → vérifier
 *
 * Utilisé pour le texte saisi par le médecin ET pour les schémas PNDS
 * (qui sont des textes pré-remplis) : un seul moteur.
 */
import { OPTIONS_PAR_DEFAUT } from '../config';
import { ajouterJours, dateFr, estDateValide, moisEnJours } from '../dates';
import { reformuler } from '../format';
import type { Options, Probleme, ResultatAnalyse, Span } from '../types';
import { assembler } from './assemble';
import { verifier } from './checks';
import { corriger } from './correct';
import { decouper } from './lexer';
import { normaliser } from './normalize';

/** Durée maximale acceptée pour un palier, un rythme ou une échéance : 10 ans. */
const JOURS_MAX = 3650;
const dureeValide = (jours: number) => Number.isInteger(jours) && jours >= 1 && jours <= JOURS_MAX;

export function analyser(texte: string, options: Partial<Options> = {}): ResultatAnalyse {
  const opts: Options = { ...OPTIONS_PAR_DEFAUT, ...options };
  // Fautes de frappe corrigées avant le découpage ; les positions sont
  // ramenées au texte d'origine pour le surlignage.
  const corrige = corriger(normaliser(texte));
  const jetons = decouper(corrige.texte, opts.joursParMois).map((t) => ({
    ...t,
    span: [corrige.debut[t.span[0]] ?? texte.length, corrige.fin[t.span[1] - 1] ?? texte.length] as Span,
  }));
  const problemes: Probleme[] = [];
  if (corrige.corrections.length) {
    problemes.push({
      code: 'correction-auto',
      niveau: 'info',
      message: `Corrigé automatiquement : ${corrige.corrections.map((c) => `« ${texte.slice(...c.span)} » → « ${c.apres} »`).join(', ')}.`,
    });
  }

  // Jetons signalés directement, avec leur position pour le surlignage.
  for (const t of jetons) {
    const extrait = texte.slice(t.span[0], t.span[1]);
    if (t.type === 'inconnu') {
      problemes.push({ code: 'mot-inconnu', niveau: 'erreur', message: `Mot non compris : « ${extrait} ».`, span: t.span });
    } else if ((t.type === 'duree' || t.type === 'rythme') && !dureeValide(t.valeur!)) {
      problemes.push({
        code: 'duree-invalide',
        niveau: 'erreur',
        message: `Durée « ${extrait} » non valide : un nombre entier de jours, de 1 jour à 10 ans.`,
        span: t.span,
      });
    } else if (t.type === 'echeance' && t.valeur! > JOURS_MAX) {
      problemes.push({ code: 'duree-invalide', niveau: 'erreur', message: `Échéance « ${extrait} » trop lointaine (10 ans au plus).`, span: t.span });
    } else if (t.type === 'fourchette') {
      problemes.push({ code: 'fourchette', niveau: 'erreur', message: `Fourchette « ${extrait} » : choisissez une valeur.`, span: t.span });
    }
  }
  // L'ordonnance est toujours rédigée en prednisone : une autre molécule écrite est signalée.
  const molecule = /(?<![a-z])(prednisolone|solupred)(?![a-z])/.exec(normaliser(texte));
  if (molecule) {
    problemes.push({
      code: 'autre-molecule',
      niveau: 'avertissement',
      message: `« ${molecule[1]} » est écrit, mais l’ordonnance est rédigée en prednisone : corrigez le nom du médicament après l’avoir copiée si besoin.`,
    });
  }
  // Échéances en mois (« à 6 mois ») : date anniversaire si la date de début est connue.
  const debut = opts.debut && estDateValide(opts.debut) ? opts.debut : null;
  const temps = {
    moisEnJours: (n: number) => moisEnJours(n, opts.joursParMois, debut),
    date: debut ? (j: number) => dateFr(ajouterJours(debut, j)) : undefined,
  };
  // Une durée hors bornes rendrait le calcul des dates impossible : pas de déroulé.
  const paliers = problemes.some((p) => p.code === 'duree-invalide') ? [] : verifier(assembler(jetons, problemes, temps), problemes);
  if (jetons.some((t) => t.mois && !t.calendaire)) {
    const anniversaire = jetons.some((t) => t.calendaire) ? ' ; les échéances (« à 6 mois », « M6 ») tombent à la date anniversaire' : '';
    problemes.push({ code: 'convention-mois', niveau: 'info', message: `« 1 mois » est compté ${opts.joursParMois} jours (réglable)${anniversaire}.` });
  }
  return {
    paliers,
    problemes,
    reformulation: reformuler(paliers),
    ok: !problemes.some((p) => p.niveau === 'erreur'),
  };
}

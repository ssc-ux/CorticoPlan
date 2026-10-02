/**
 * Analyseur de texte libre : point d'entrée unique du moteur.
 *
 *   texte → normaliser → découper (jetons) → assembler (paliers) → vérifier
 *
 * Utilisé pour le texte saisi par le médecin ET pour les schémas PNDS
 * (qui sont des textes pré-remplis) : un seul moteur.
 */
import { OPTIONS_PAR_DEFAUT } from '../config';
import { reformuler } from '../format';
import type { Options, Probleme, ResultatAnalyse } from '../types';
import { assembler } from './assemble';
import { verifier } from './checks';
import { decouper } from './lexer';
import { normaliser } from './normalize';

export function analyser(texte: string, options: Partial<Options> = {}): ResultatAnalyse {
  const opts: Options = { ...OPTIONS_PAR_DEFAUT, ...options };
  const jetons = decouper(normaliser(texte), opts.joursParMois);
  const problemes: Probleme[] = [];

  // Jetons signalés directement, avec leur position pour le surlignage.
  for (const t of jetons) {
    const extrait = texte.slice(t.span[0], t.span[1]);
    if (t.type === 'inconnu') {
      problemes.push({ code: 'mot-inconnu', niveau: 'erreur', message: `Mot non compris : « ${extrait} ».`, span: t.span });
    } else if (t.type === 'mgkg') {
      problemes.push({ code: 'mg-kg-non-pris-en-charge', niveau: 'erreur', message: 'Les doses en mg/kg ne sont pas prises en charge : indiquez la dose en mg.', span: t.span });
    } else if (t.type === 'cp') {
      problemes.push({ code: 'dose-en-comprimes', niveau: 'erreur', message: 'Dose en comprimés : indiquez la dose en mg.', span: t.span });
    } else if (t.type === 'fourchette') {
      problemes.push({ code: 'fourchette', niveau: 'erreur', message: `Fourchette « ${extrait} » : choisissez une valeur.`, span: t.span });
    }
  }
  if (jetons.some((t) => t.mois)) {
    problemes.push({ code: 'convention-mois', niveau: 'info', message: `« 1 mois » est compté ${opts.joursParMois} jours (réglable).` });
  }

  const paliers = verifier(assembler(jetons, problemes), problemes);
  return {
    paliers,
    problemes,
    reformulation: reformuler(paliers),
    ok: !problemes.some((p) => p.niveau === 'erreur'),
  };
}

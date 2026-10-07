/**
 * Assemblage : jetons → blocs → paliers.
 *
 * 1. Le texte est coupé en segments aux séparateurs (puis, virgule, …).
 * 2. Chaque segment devient un « bloc » : une dose fixe, une décroissance
 *    régulière ou un arrêt. Les briques d'un segment peuvent être dans
 *    n'importe quel ordre.
 * 3. Les blocs sont déroulés en paliers, en portant la dose courante d'un bloc
 *    à l'autre.
 *
 * Règles convenues avec le prescripteur :
 * - un nombre seul est une dose en mg ;
 * - dans une décroissance sans dose de départ, la première baisse a lieu à J1
 *   (dès le début du bloc) ;
 * - le schéma se termine sur la dernière dose écrite, maintenue (« à
 *   poursuivre »), sauf arrêt explicite.
 * - un objectif daté (« 10 mg à M3 », « arrêt à 12 mois ») est compté depuis
 *   J1 ; « objectif 10 mg en 6 semaines » compte depuis la fin de l'étape
 *   précédente. Les paliers intermédiaires sont calculés (voir `objectif`).
 * Toute interprétation non évidente est signalée, jamais faite en silence.
 */
import { formatDuree } from '../format';
import type { Dose, Palier, Probleme, Span } from '../types';
import { nombreFr } from './normalize';
import type { Jeton } from './lexer';

type Bloc =
  | { type: 'dose'; dose: Dose; jours: number | null; span: Span; /** « jusqu'à M12 » : fin comptée depuis J1. */ jusqua?: number }
  | {
      type: 'objectif';
      cible: number;
      depart: number | null;
      /** Pas imposé (« par paliers de 2,5 mg ») ; sinon échelle usuelle. */
      pas: number | null;
      /** Échéance comptée depuis J1 (« à 3 mois », « M3 ») … */
      echeance: number | null;
      /** … ou depuis la fin de l'étape précédente (« objectif 10 mg en 6 semaines »). */
      dans: number | null;
      span: Span;
    }
  | {
      type: 'decroissance';
      depart: number | null;
      pas: number;
      rythme: number;
      borne: number | null;
      jours: number | null;
      /** Aucune borne écrite : déterminée au déroulé selon ce qui suit. */
      sansBorne?: boolean;
      span: Span;
    }
  | { type: 'arret'; span: Span };

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Coupe la liste de jetons aux séparateurs. */
function segmenter(jetons: Jeton[]): Jeton[][] {
  const segments: Jeton[][] = [[]];
  for (const t of jetons) {
    if (t.type === 'sep') segments.push([]);
    else segments[segments.length - 1]!.push(t);
  }
  // « 20 mg 3 sem → 15 mg 3 sem → 10 mg » : sans baisse dans le segment, la
  // flèche sépare des paliers (elle veut dire « puis », pas « jusqu'à »).
  const sortie: Jeton[][] = [];
  for (const seg of segments) {
    const avecBaisse = seg.some((t) => t.type === 'pas' || t.type === 'moins');
    if (avecBaisse || !seg.some((t) => t.fleche)) {
      sortie.push(seg);
      continue;
    }
    let courant: Jeton[] = [];
    for (const t of seg) {
      if (t.fleche) {
        sortie.push(courant);
        courant = [];
      } else courant.push(t);
    }
    sortie.push(courant);
  }
  return sortie.filter((s) => s.length > 0);
}

/** Jetons déjà signalés par ailleurs : ils ne participent pas au sens. */
const IGNORES = new Set(['inconnu', 'mgkg', 'cp', 'fourchette', 'mg', 'et', 'slash']);

/** Transforme un segment en bloc (ou `null` s'il ne porte aucune information). */
/** Ce qui se transmet d'un segment à l'autre (dosage du comprimé déjà écrit). */
interface Contexte {
  dosageCp: number | null;
  temps: Temps;
}

function lireSegment(seg: Jeton[], problemes: Probleme[], precedent: Bloc | undefined, ctx: Contexte): Bloc | 'duree-seule' | null {
  const span: Span = [seg[0]!.span[0], seg[seg.length - 1]!.span[1]];
  const doses: number[] = [];
  let paire: [number, number] | null = null;
  let pas: number | null = null;
  let motPasSansValeur = false;
  let rythme: number | null = null;
  let borne: number | null = null;
  let borneFaible: number | null = null; // « à 10 »
  let duree: number | null = null;
  let alternance = false;
  let unJourSurDeux = false;
  let arret = false;
  let sevrageSeul = false;
  let objectif = false;
  let echeance: number | null = null; // « à 3 mois », « M3 »
  let jusquaEcheance: number | null = null; // « jusqu'à M12 »
  let incompris = false;
  let attentePas = false; // « baisser toutes les 2 sem de 5 mg » : le pas vient après
  let pasDiffere = false; // pas donné par un mot (« baisser de… ») plutôt que par « - »
  // Annotations non prises en charge (« soit 0,7 mg/kg », « 1 cp ») : ignorées
  // si le segment donne aussi une dose en mg, sinon signalées en erreur.
  const annotations: Jeton[] = [];
  const comprimes: { jeton: Jeton; nombre: number; dosage: number | null }[] = [];

  for (let k = 0; k < seg.length; k++) {
    const t = seg[k]!;
    const s1 = seg[k + 1];
    const s2 = seg[k + 2];
    switch (t.type) {
      case 'nombre':
        // « 10/7,5 » ou « 10 et 7,5 (en alternance) » : deux doses alternées.
        if ((s1?.type === 'slash' || s1?.type === 'et') && s2?.type === 'nombre') {
          paire = [t.valeur!, s2.valeur!];
          k += 2;
        } else if (s1?.type === 'mg' && (seg[k + 2]?.type === 'slash' || seg[k + 2]?.type === 'et') && seg[k + 3]?.type === 'nombre') {
          paire = [t.valeur!, seg[k + 3]!.valeur!];
          k += 3;
        } else if (s1?.type === 'mgkg') {
          annotations.push(s1);
          k++;
        } else if (attentePas && pas === null) {
          pas = t.valeur!;
          pasDiffere = true;
          attentePas = false;
        } else {
          doses.push(t.valeur!);
        }
        break;
      case 'mgkg':
        annotations.push(t);
        break;
      case 'cp':
        // « 2 cp de 5 mg », « 2 cp à 5 mg » : dosage du comprimé juste après.
        if (s1?.type === 'nombre') {
          comprimes.push({ jeton: t, nombre: t.valeur!, dosage: s1.valeur! });
          k++;
        } else if (s1?.type === 'a' && s2?.type === 'nombre') {
          comprimes.push({ jeton: t, nombre: t.valeur!, dosage: s2.valeur! });
          k += 2;
        } else comprimes.push({ jeton: t, nombre: t.valeur!, dosage: null });
        break;
      case 'pas':
      case 'moins':
        if (s1?.type === 'nombre') {
          pas = s1.valeur!;
          if (t.type === 'pas') pasDiffere = true; // mot (« décroissance de ») et non signe « - »
          k++;
        } else {
          motPasSansValeur = true;
          attentePas = true;
        }
        break;
      case 'jusqua':
        if (s1?.type === 'nombre' && s2?.type === 'mgkg') {
          annotations.push(s2);
          k += 2;
        } else if (s1?.type === 'nombre') {
          borne = s1.valeur!;
          k++;
        } else if (s1?.type === 'arret' || s1?.type === 'sevrage') {
          borne = 0;
          k++;
        } else if (s1?.type === 'echeance' || s1?.type === 'duree') {
          if (jusquaEcheance !== null) incompris = true;
          jusquaEcheance = jours(s1, ctx.temps);
          k++;
        } else incompris = true;
        break;
      case 'a':
        if (s1?.type === 'nombre' && s2?.type === 'mgkg') {
          annotations.push(s2);
          k += 2;
        } else if (s1?.type === 'nombre') {
          borneFaible = s1.valeur!;
          k++;
        } else if (s1?.type === 'arret' || s1?.type === 'sevrage') {
          borneFaible = 0;
          k++;
        } else if (s1?.type === 'echeance' || s1?.type === 'duree') {
          // « 10 mg à 3 mois », « arrêt à M12 » : échéance d'un objectif.
          if (echeance !== null) incompris = true;
          echeance = jours(s1, ctx.temps);
          k++;
        }
        break;
      case 'echeance':
        if (echeance !== null) incompris = true;
        echeance = jours(t, ctx.temps);
        break;
      case 'objectif':
        objectif = true;
        break;
      case 'sevrage':
        sevrageSeul = true;
        break;
      case 'rythme':
        if (rythme !== null) incompris = true;
        rythme = t.valeur!;
        break;
      case 'duree':
        if (duree !== null) incompris = true;
        duree = t.valeur!;
        break;
      case 'alternance':
        alternance = true;
        break;
      case 'unJourSurDeux':
        unJourSurDeux = true;
        break;
      case 'arret':
        arret = true;
        break;
      default:
        if (!IGNORES.has(t.type)) incompris = true;
    }
  }


  const echec = (code: Probleme['code'], message: string) => {
    problemes.push({ code, niveau: 'erreur', message, span });
    return null;
  };

  // Fourchette (« 3-4 semaines », déjà signalée) : segment ignoré.
  if (seg.some((t) => t.type === 'fourchette')) return null;
  // Comprimés : la dose en mg est déduite seulement si elle est certaine.
  for (const c of comprimes) {
    const info = (message: string) => problemes.push({ code: 'dose-en-comprimes', niveau: 'info', message, span: c.jeton.span });
    if (c.dosage !== null) {
      // « 2 cp de 5 mg » = 10 mg ; une autre dose écrite doit concorder.
      const total = arrondi(c.nombre * c.dosage);
      if (doses.some((d) => d !== total)) {
        return echec('dose-ambigue', `${c.nombre} cp de ${nombreFr(c.dosage)} mg = ${nombreFr(total)} mg : ne concorde pas avec la dose écrite.`);
      }
      doses.splice(0, doses.length, total);
      ctx.dosageCp = c.dosage;
      info(`${c.nombre} cp de ${nombreFr(c.dosage)} mg compris comme ${nombreFr(total)} mg/j.`);
    } else if (doses.length === 1 && c.nombre === 1) {
      ctx.dosageCp = doses[0]!;
      info('« 1 cp » : la dose en mg écrite est retenue.');
    } else if (doses.length === 0 && ctx.dosageCp !== null) {
      // « … puis 1 cp » : même comprimé que plus haut.
      const total = arrondi(c.nombre * ctx.dosageCp);
      doses.push(total);
      info(`${c.nombre} cp compris comme ${nombreFr(total)} mg/j (comprimé de ${nombreFr(ctx.dosageCp)} mg écrit plus haut).`);
    } else if (doses.length === 1) {
      // « Cortancyl 5 mg : 2 cp » : 5 mg est le dosage du comprimé → 10 mg.
      const total = arrondi(c.nombre * doses[0]!);
      ctx.dosageCp = doses[0]!;
      info(`${nombreFr(doses[0]!)} mg × ${c.nombre} cp compris comme ${nombreFr(total)} mg/j (écrivez la dose totale en mg pour éviter toute ambiguïté).`);
      doses.splice(0, 1, total);
    } else {
      return echec('dose-en-comprimes', 'Dose en comprimés sans dosage : indiquez la dose en mg (ex. « 20 mg »).');
    }
  }
  // « 20 mg (20 mg) » : la même dose répétée compte une fois.
  if (doses.length > 1 && doses.every((d) => d === doses[0])) doses.splice(1);
  // « Décroissance : 20 mg pendant 2 semaines » : mot de baisse servant de titre
  // (ni rythme ni borne) → le nombre pris pour un pas est en fait la dose.
  if (pasDiffere && !objectif && rythme === null && borne === null && borneFaible === null && duree !== null) {
    doses.unshift(pas!);
    pas = null;
    motPasSansValeur = false;
  }
  for (const t of annotations) {
    const mgkg = t.type === 'mgkg';
    const autreDose = doses.length > 0 || paire !== null || pas !== null;
    problemes.push({
      code: mgkg ? 'mg-kg-non-pris-en-charge' : 'dose-en-comprimes',
      niveau: autreDose ? 'info' : 'erreur',
      message: autreDose
        ? `Mention ${mgkg ? 'en mg/kg' : 'en comprimés'} ignorée : seule la dose en mg est retenue.`
        : `Dose ${mgkg ? 'en mg/kg' : 'en comprimés'} non prise en charge : indiquez la dose en mg.`,
      span: t.span,
    });
    if (!autreDose) return null;
  }
  if (sevrageSeul && borne === null && borneFaible === null && echeance === null) {
    return echec('pas-manquant', 'Sevrage : précisez la baisse (ex. « -1 mg toutes les 4 semaines jusqu’au sevrage »).');
  }
  if (incompris) return echec('segment-incompris', 'Segment non compris : reformulez-le.');

  // Objectif daté : « 10 mg à 3 mois », « objectif 5 mg en 6 semaines », « arrêt à M12 ».
  const delai = objectif && echeance === null ? duree : null;
  if (echeance !== null || delai !== null) {
    if (rythme !== null) return echec('segment-incompris', 'Objectif daté et rythme de baisse dans le même segment : gardez l’un ou l’autre.');
    if (echeance !== null && duree !== null) return echec('segment-incompris', 'Objectif : une durée et une échéance à la fois.');
    if (paire || unJourSurDeux || alternance) return echec('segment-incompris', 'Objectif : indiquez une dose quotidienne.');
    if (pas !== null && pas <= 0) return echec('pas-manquant', 'Le pas de baisse doit être positif.');
    const cible = borne ?? borneFaible ?? (arret || sevrageSeul ? 0 : doses.pop() ?? null);
    if (cible === null) return echec('segment-incompris', 'Objectif sans dose : précisez la dose à atteindre (ex. « 10 mg à 3 mois »).');
    if (doses.length > 1) return echec('dose-ambigue', 'Trop de doses dans cet objectif.');
    return { type: 'objectif', cible, depart: doses[0] ?? null, pas, echeance, dans: delai, span };
  }
  if (objectif) {
    problemes.push({
      code: 'echeance-manquante', niveau: 'erreur', span,
      message: 'Objectif sans échéance : à quel moment l’atteindre ?',
      suggestions: [1, 3, 6].map((m) => ({ libelle: `à ${m} mois`, position: span[1], insertion: ` à ${m} mois` })),
    });
    return null;
  }
  // « jusqu'à M12 » ne s'applique qu'à une dose fixe.
  if (jusquaEcheance !== null && (doses.length !== 1 || pas !== null || motPasSansValeur || rythme !== null || arret)) {
    return echec('segment-incompris', '« Jusqu’à » une date : réservé à une dose fixe (ex. « 5 mg jusqu’à M12 »).');
  }
  // Verbe sous-entendu après une première baisse : « puis de 2,5 mg toutes les
  // 2 semaines jusqu'à 10 mg » → la dose unique est le pas.
  if (
    pas === null && !motPasSansValeur && rythme !== null && doses.length === 1 && !paire && precedent?.type === 'decroissance'
  ) {
    pas = doses.pop()!;
  }
  // Sans baisse, « à 40 mg » (« 1 mois à 40 mg ») désigne simplement la dose.
  if (pas === null && !motPasSansValeur && borneFaible !== null) doses.push(borneFaible);

  // Décroissance régulière : un pas est donné (ou le mot « baisser » sans valeur).
  if (pas !== null || motPasSansValeur) {
    if (pas === null) return echec('pas-manquant', 'Baisse demandée sans valeur de pas (ex. « −5 mg »).');
    if (pas <= 0) return echec('pas-manquant', 'Le pas de baisse doit être positif.');
    if (paire) return echec('segment-incompris', 'Une décroissance ne peut pas partir d’une alternance.');
    if (doses.length > 2) return echec('dose-ambigue', 'Trop de doses dans ce segment.');
    const depart = doses[0] ?? null;
    const borneFinale = borne ?? borneFaible ?? doses[1] ?? (arret ? 0 : null);
    if (rythme === null) return echec('rythme-manquant', 'Rythme de baisse non précisé (ex. « toutes les 2 semaines »).');
    if (borneFinale === null && duree === null) {
      // Pas de borne écrite : décidée au déroulé (arrêt, dose suivante, ou question).
      return { type: 'decroissance', depart, pas, rythme, borne: 0, jours: null, sansBorne: true, span };
    }
    return { type: 'decroissance', depart, pas, rythme, borne: borneFinale, jours: duree, span };
  }

  if (rythme !== null) return echec('segment-incompris', 'Rythme sans baisse : précisez le pas (ex. « −5 mg par semaine »).');
  if (borne !== null) return echec('pas-manquant', 'Borne sans pas de baisse : précisez de combien baisser.');

  if (arret) {
    if (doses.length > 0 || paire) return echec('segment-incompris', 'Arrêt et dose dans le même segment.');
    return { type: 'arret', span };
  }

  // Pas d'alternance entre deux posologies (choix du prescripteur).
  if (paire) {
    return echec('alternance-deux-doses', 'Alternance entre deux doses non prise en charge : utilisez une dose fixe, ou « un jour sur deux ».');
  }

  if (doses.length === 1) {
    const d = doses[0]!;
    if (jusquaEcheance !== null && duree !== null) return echec('segment-incompris', 'Durée et « jusqu’à » à la fois : gardez l’un ou l’autre.');
    const fin = jusquaEcheance !== null ? { jusqua: jusquaEcheance } : {};
    if (unJourSurDeux) return { type: 'dose', dose: [d, 0], jours: duree, span, ...fin };
    if (alternance) return echec('alternance-incomplete', 'Alternance : précisez « un jour sur deux » (ex. « 20 mg un jour sur deux »).');
    return { type: 'dose', dose: d, jours: duree, span, ...fin };
  }

  if (doses.length > 1) return echec('dose-ambigue', 'Plusieurs doses dans ce segment : séparez-les par « puis ».');

  // Durée seule (« 20 mg, pendant 3 semaines ») : complète le bloc précédent.
  if (duree !== null && precedent?.type === 'dose' && precedent.jours === null) {
    precedent.jours = duree;
    return 'duree-seule';
  }
  if (duree !== null || alternance || unJourSurDeux) return echec('segment-incompris', 'Segment sans dose.');
  return null;
}

/** Première dose d'un bloc, si elle est connue sans calcul. */
function premiereDose(bloc: Bloc | undefined): number | null {
  if (!bloc) return null;
  if (bloc.type === 'dose') return typeof bloc.dose === 'number' ? bloc.dose : null;
  if (bloc.type === 'decroissance' || bloc.type === 'objectif') return bloc.depart;
  return 0;
}

/**
 * Échelle usuelle : -5 mg au-dessus de 20 mg, -2,5 mg jusqu'à 10 mg, puis -1 mg
 * (pas multipliés par `facteur` quand le temps manque).
 */
function doseSuivante(d: number, pas: number | null, facteur = 1): number {
  if (pas !== null) return arrondi(d - pas);
  const sous = (unite: number) => arrondi(Math.ceil(d / unite - 1e-9) * unite - unite);
  return d > 20 ? sous(5 * facteur) : d > 10 ? sous(2.5 * facteur) : sous(facteur);
}

/**
 * Répartit au plus `jours` sur `n` paliers, en semaines entières (les jours en
 * trop sont laissés : la cible arrive quelques jours plus tôt, jamais plus
 * tard) ; les semaines en plus vont aux derniers paliers (doses basses, baisse
 * plus lente). Moins d'une semaine par palier : en jours.
 */
function repartir(jours: number, n: number): number[] {
  const unite = jours >= 7 * n ? 7 : 1;
  const total = Math.floor(jours / unite);
  const base = Math.floor(total / n);
  const plus = total % n;
  return Array.from({ length: n }, (_, i) => (base + (i >= n - plus ? 1 : 0)) * unite);
}

/** Déroule les blocs en paliers. */
function derouler(blocs: Bloc[], problemes: Probleme[], temps: Temps): Palier[] {
  /** « J85 », ou « le 07/01/2027 (J85) » si la date de début est connue. */
  const quand = (j: number) => (temps.date ? `le ${temps.date(j)} (J${j + 1})` : `à J${j + 1}`);
  const paliers: Palier[] = [];
  let courante: number | null = null;
  /** Dose atteinte par un objectif, dont la durée dépend de l'étape suivante. */
  let atteinte: { palier: Palier; span: Span } | null = null;
  /** Jours écoulés depuis J1 (un palier sans durée ne compte pas). */
  const ecoule = () => paliers.reduce((s, p) => s + (p.jours ?? 0), 0);

  blocs.forEach((bloc, i) => {
    const dernier = i === blocs.length - 1;
    const suivant = blocs[i + 1];

    if (atteinte && bloc.type !== 'objectif') {
      const { palier, span } = atteinte;
      atteinte = null;
      if (bloc.type === 'decroissance' && bloc.depart === null) {
        palier.jours = bloc.rythme;
        problemes.push({ code: 'duree-deduite', niveau: 'info', span,
          message: `${formatDoseCourte(palier.dose)} gardés ${bloc.rythme} jours après l’objectif (rythme de la baisse suivante).` });
      } else if (palier.dose !== 0) {
        problemes.push({ code: 'duree-manquante', niveau: 'erreur', span,
          message: `Combien de temps garder ${formatDoseCourte(palier.dose)} une fois l’objectif atteint ? Ajoutez un objectif daté ou une durée.` });
      }
    }

    if (bloc.type === 'objectif') {
      objectif(bloc);
      return;
    }

    if (bloc.type === 'arret') {
      paliers.push({ dose: 0, jours: null });
      courante = 0;
      return;
    }

    if (bloc.type === 'dose') {
      let jours = bloc.jours;
      if (bloc.jusqua !== undefined) {
        jours = bloc.jusqua - ecoule();
        if (jours <= 0) {
          problemes.push({ code: 'echeance-depassee', niveau: 'erreur', span: bloc.span,
            message: `« Jusqu’à » ${quand(bloc.jusqua)} : tombe avant la fin des étapes précédentes (J${ecoule() + 1}).` });
          return;
        }
      }
      if (jours === null && !dernier) {
        if (suivant?.type === 'objectif') {
          // « 40 mg puis 20 mg à M1 » : la durée de 40 mg est calculée par l'objectif.
        } else if (suivant?.type === 'decroissance' && suivant.depart === null) {
          // « 20 mg puis −5 mg/sem » : 20 mg dure une période de la baisse.
          jours = suivant.rythme;
          problemes.push({
            code: 'duree-deduite',
            niveau: 'info',
            message: `Durée de ${formatDoseCourte(bloc.dose)} non précisée : ${jours} jours retenus (rythme de la baisse suivante).`,
            span: bloc.span,
          });
        } else {
          problemes.push({ code: 'duree-manquante', niveau: 'erreur', message: 'Durée manquante pour ce palier.', span: bloc.span });
        }
      }
      paliers.push({ dose: bloc.dose, jours });
      courante = typeof bloc.dose === 'number' ? bloc.dose : null;
      return;
    }

    // Décroissance régulière.
    const { pas, rythme, span } = bloc;
    if (bloc.sansBorne) {
      const suite = premiereDose(suivant);
      if (dernier || suivant?.type === 'arret') {
        problemes.push({ code: 'borne-par-defaut', niveau: 'info', span,
          message: 'Aucune borne indiquée : la baisse est poursuivie jusqu’à l’arrêt (ajoutez « jusqu’à 10 mg » sinon).' });
      } else if (suite !== null && suite > 0) {
        // « -10 mg par 2 semaines puis 20 mg 1 mois » : on baisse jusqu'à la dose suivante.
        bloc.borne = suite;
        problemes.push({ code: 'borne-par-defaut', niveau: 'info', span,
          message: `Baisse poursuivie jusqu’à ${nombreFr(suite)} mg, la dose écrite ensuite.` });
      } else {
        // Réellement ambigu : on demande, avec des réponses en un geste.
        const depuis = bloc.depart ?? (courante !== null ? courante - pas : null);
        const choix: number[] = [];
        if (depuis !== null) {
          for (let d = arrondi(depuis - pas); d > 0; d = arrondi(d - pas)) if (d % 5 === 0 || pas < 1) choix.push(d);
        }
        const rythmeTxt = rythme === 7 ? 'chaque semaine' : rythme % 7 === 0 ? `toutes les ${rythme / 7} semaines` : `tous les ${rythme} jours`;
        problemes.push({
          code: 'borne-manquante', niveau: 'erreur', span,
          message: `Jusqu’où baisser de ${nombreFr(pas)} mg ${rythmeTxt} ?`,
          suggestions: choix.slice(-4).map((d) => ({ libelle: `jusqu’à ${nombreFr(d)} mg`, position: span[1], insertion: ` jusqu’à ${nombreFr(d)} mg` })),
        });
        return;
      }
    }
    let depart = bloc.depart;
    if (depart === null) {
      if (courante === null) {
        problemes.push({ code: 'segment-incompris', niveau: 'erreur', message: 'Baisse sans dose de départ.', span });
        return;
      }
      depart = arrondi(courante - pas); // première baisse à J1
      if (depart < 0 || (depart === 0 && courante === 0)) {
        problemes.push({ code: 'borne-incoherente', niveau: 'erreur', span,
          message: 'Cette baisse part d’une dose déjà à 0 mg : vérifiez l’étape précédente.' });
        return;
      }
    }

    const niveaux: number[] = [];
    if (bloc.borne === null) {
      // « −1 mg toutes les 4 sem pendant 3 mois » : nombre de paliers = durée / rythme.
      const n = bloc.jours! / rythme;
      if (!Number.isInteger(n)) {
        problemes.push({ code: 'borne-inatteignable', niveau: 'erreur', message: 'La durée n’est pas un multiple du rythme de baisse.', span });
        return;
      }
      for (let k = 0; k < n; k++) niveaux.push(arrondi(depart - k * pas));
      if (niveaux.some((d) => d < 0)) {
        problemes.push({ code: 'borne-incoherente', niveau: 'erreur', message: 'La baisse descend sous 0 mg.', span });
        return;
      }
      niveaux.forEach((d, k) => paliers.push({ dose: d, jours: dernier && k === n - 1 ? null : rythme }));
      courante = niveaux[niveaux.length - 1] ?? courante;
      return;
    }

    const borne = bloc.borne;
    if (borne > depart) {
      problemes.push({ code: 'borne-incoherente', niveau: 'erreur', message: `La borne (${nombreFr(borne)} mg) est au-dessus de la dose de départ (${nombreFr(depart)} mg).`, span });
      return;
    }
    for (let d = depart; d > borne + 1e-9; d = arrondi(d - pas)) niveaux.push(d);
    const dernierNiveau = niveaux[niveaux.length - 1];
    if (dernierNiveau !== undefined && arrondi(dernierNiveau - pas) < borne - 1e-9) {
      problemes.push({
        code: 'borne-inatteignable',
        niveau: 'avertissement',
        message: `Le pas de ${nombreFr(pas)} mg ne tombe pas juste sur ${nombreFr(borne)} mg : dernière baisse de ${nombreFr(arrondi(dernierNiveau - borne))} mg.`,
        span,
      });
    }
    niveaux.forEach((d) => paliers.push({ dose: d, jours: rythme }));
    if (dernier || borne === 0) {
      paliers.push({ dose: borne, jours: null });
    } else if (premiereDose(suivant) !== borne) {
      paliers.push({ dose: borne, jours: rythme });
    }
    courante = borne;
  });

  /**
   * Objectif daté : de la dose courante à la cible, en suivant l'échelle
   * usuelle (ou le pas écrit), paliers répartis en semaines entières pour que
   * la cible commence au plus tard à l'échéance. Une dose écrite sans durée
   * juste avant (« 40 mg puis 20 mg à M1 ») occupe le premier palier.
   */
  function objectif(bloc: Extract<Bloc, { type: 'objectif' }>) {
    const { cible, span } = bloc;
    const erreur = (code: Probleme['code'], message: string) => problemes.push({ code, niveau: 'erreur', message, span });
    let ouvert = paliers[paliers.length - 1];
    if (ouvert && (ouvert.jours !== null || typeof ouvert.dose !== 'number' || ouvert.dose === 0)) ouvert = undefined;
    if (bloc.depart !== null) {
      if (ouvert && ouvert.dose !== bloc.depart) return erreur('dose-ambigue', `Dose de départ (${nombreFr(bloc.depart)} mg) différente de la dose précédente.`);
      if (!ouvert) {
        ouvert = { dose: bloc.depart, jours: null };
        paliers.push(ouvert);
      }
    }
    const depart = ouvert ? (ouvert.dose as number) : courante;
    if (depart === null) {
      return problemes.push({
        code: 'segment-incompris', niveau: 'erreur', span,
        message: 'Objectif sans dose de départ : de quelle dose part-on ?',
        suggestions: [10, 20, 40, 60].filter((d) => d > cible).slice(-3)
          .map((d) => ({ libelle: `${d} mg puis…`, position: span[0], insertion: `${d} mg puis ` })),
      });
    }
    if (cible > depart) return erreur('borne-incoherente', `L’objectif (${nombreFr(cible)} mg) est au-dessus de la dose actuelle (${nombreFr(depart)} mg).`);
    const debut = ecoule();
    const jours = bloc.echeance !== null ? bloc.echeance - debut : bloc.dans!;
    if (jours <= 0) {
      return erreur('echeance-depassee', `L’objectif de ${nombreFr(cible)} mg (${quand(bloc.echeance!)}) tombe avant la fin des étapes précédentes (J${debut + 1}).`);
    }

    // Doses intermédiaires selon l'échelle, la cible exclue.
    const echelle = (facteur: number) => {
      const n: number[] = [];
      for (let d = doseSuivante(depart, bloc.pas, facteur); d > cible + 1e-9; d = doseSuivante(d, bloc.pas, facteur)) n.push(d);
      return n;
    };
    let niveaux = echelle(1);
    const nPas = bloc.pas !== null ? (depart - cible) / bloc.pas : 0;
    if (Math.abs(nPas - Math.round(nPas)) > 1e-9) {
      problemes.push({ code: 'borne-inatteignable', niveau: 'avertissement', span,
        message: `Le pas de ${nombreFr(bloc.pas!)} mg ne tombe pas juste sur ${nombreFr(cible)} mg : dernière baisse plus petite.` });
    }
    // Au moins une semaine par palier : sinon on saute des doses.
    const place = Math.max(Math.floor(jours / 7), 1) - (ouvert ? 1 : 0);
    if (niveaux.length > Math.max(place, 0)) {
      // Pas plus grands (×2, ×3…) plutôt que des doses sautées au hasard.
      let facteur = 1;
      while (bloc.pas === null && niveaux.length > place && facteur < 10) niveaux = echelle(++facteur);
      if (niveaux.length > place) niveaux = place > 0 ? niveaux.filter((_, k) => (k + 1) % Math.ceil(niveaux.length / place) === 0).slice(0, place) : [];
      problemes.push({ code: 'objectif-rapide', niveau: 'avertissement', span,
        message: `Objectif rapide (${nombreFr(depart)} → ${nombreFr(cible)} mg en ${formatDuree(jours)}) : baisses plus fortes que d’habitude pour garder au moins 1 semaine par palier.` });
    }
    const etapes: Palier[] = [...(ouvert ? [ouvert] : []), ...niveaux.map((d) => ({ dose: d, jours: 0 }))];
    let duree = 0;
    if (etapes.length > 0) {
      repartir(jours, etapes.length).forEach((j, k) => ((etapes[k]!.jours = j), (duree += j)));
      paliers.push(...etapes.slice(ouvert ? 1 : 0));
    }
    const atteint = debut + duree;
    const avance = debut + jours - atteint;
    problemes.push({ code: 'objectif-calcule', niveau: 'info', span,
      message: cible === 0
        ? `Arrêt ${quand(atteint)}${etapes.length ? ` : ${etapes.length} palier(s) calculé(s) sur ${formatDuree(duree)}` : ''}.`
        : `Objectif ${nombreFr(cible)} mg atteint ${quand(atteint)}${etapes.length ? ` : ${etapes.length} palier(s) calculé(s) sur ${formatDuree(duree)}` : ' (dès la fin de l’étape précédente)'}${avance > 0 ? `, ${avance} jour(s) avant l’échéance` : ''}.` });
    const palier: Palier = { dose: cible, jours: null };
    paliers.push(palier);
    courante = cible;
    atteinte = cible === 0 ? null : { palier, span };
  }

  return paliers;
}

function formatDoseCourte(dose: Dose): string {
  return typeof dose === 'number' ? `${nombreFr(dose)} mg` : `${nombreFr(dose[0])}/${nombreFr(dose[1])} mg`;
}

/** Point d'entrée de l'assemblage. */
/** Conversion des échéances en jours. */
export interface Temps {
  /** Nombre de mois → jours écoulés depuis J1 (mois calendaires si la date de début est connue). */
  moisEnJours: (n: number) => number;
  /** Jour (0 = J1) → date « 07/01/2027 », si la date de début est connue. */
  date?: (j: number) => string;
}

/** Échéance d'un jeton durée/échéance, en jours depuis J1. */
function jours(t: Jeton, temps: Temps): number {
  if (t.nbMois === undefined) return t.valeur!;
  if (temps.date) t.calendaire = true;
  return temps.moisEnJours(t.nbMois);
}

export function assembler(jetons: Jeton[], problemes: Probleme[], temps: Temps): Palier[] {
  const blocs: Bloc[] = [];
  const ctx: Contexte = { dosageCp: null, temps };
  for (const seg of segmenter(jetons)) {
    const bloc = lireSegment(seg, problemes, blocs[blocs.length - 1], ctx);
    if (bloc && bloc !== 'duree-seule') blocs.push(bloc);
  }
  return derouler(blocs, problemes, temps);
}

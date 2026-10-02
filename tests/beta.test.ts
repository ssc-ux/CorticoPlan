/**
 * Bêta-test génératif : des milliers de formulations libres, produites au
 * hasard (mais de façon reproductible) à partir de schémas connus, doivent
 * toutes redonner exactement les paliers attendus.
 *
 * Un second test envoie du texte aléatoire pour vérifier que l'analyseur ne
 * plante jamais et renvoie toujours un résultat cohérent.
 */
import { describe, expect, it } from 'vitest';
import { versTexte } from '../src/lib/format';
import { analyser } from '../src/lib/parser';
import type { Palier } from '../src/lib/types';

/** Générateur pseudo-aléatoire à graine (mulberry32) : résultats reproductibles. */
function hasard(graine: number) {
  let a = graine >>> 0;
  const suivant = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const choisir = <T,>(liste: readonly T[]): T => liste[Math.floor(suivant() * liste.length)]!;
  return { suivant, choisir, pile: (p = 0.5) => suivant() < p };
}

const EN_LETTRES: Record<number, string[]> = {
  5: ['cinq'], 10: ['dix'], 15: ['quinze'], 20: ['vingt'], 25: ['vingt-cinq', 'vingt cinq'],
  30: ['trente'], 40: ['quarante'], 50: ['cinquante'], 60: ['soixante'], 2: ['deux'], 3: ['trois'], 4: ['quatre'],
};

function ecrireNombre(n: number, h: ReturnType<typeof hasard>): string {
  if (EN_LETTRES[n] && h.pile(0.15)) return h.choisir(EN_LETTRES[n]!);
  const s = String(n);
  return s.includes('.') && h.pile(0.6) ? s.replace('.', ',') : s;
}

function ecrireDose(d: number, h: ReturnType<typeof hasard>): string {
  const n = ecrireNombre(d, h);
  // « 20mg » et « 20 » seul, mais jamais « vingtmg » ni « vingt » seul : « soixante
  // trois semaines » est réellement ambigu (signalé en erreur par le parseur).
  const chiffres = /^[\d,.]+$/.test(n) ? [`${n}mg`, n] : [];
  return h.choisir([`${n} mg`, ...chiffres, `${n} mg/j`, `${n} mg/jour`, `${n} mg par jour`, `${n} milligrammes`]);
}

function ecrireDuree(jours: number, h: ReturnType<typeof hasard>): string {
  const options: string[] = [];
  if (jours % 7 === 0) {
    const n = ecrireNombre(jours / 7, h);
    options.push(`${n} sem`, `${n} semaine${jours > 7 ? 's' : ''}`, `pendant ${n} semaine${jours > 7 ? 's' : ''}`, `x ${n} sem`);
    if (/^\d+$/.test(n)) options.push(`${n}s`, `${n} s`);
  }
  if (jours % 28 === 0) options.push(`${jours / 28} mois`, `pendant ${jours / 28} mois`);
  options.push(`${jours} j`, `${jours}j`, `${jours} jours`, `pendant ${jours} jours`, `${jours} jrs`, `durant ${jours} jours`);
  return h.choisir(options);
}

function ecrireRythme(jours: number, h: ReturnType<typeof hasard>): string {
  const options = [`tous les ${jours} jours`, `tous les ${jours} j`, `/${jours} j`];
  if (jours === 7) options.push('/sem', 'par semaine', 'toutes les semaines', 'chaque semaine', 'tous les 7 jours');
  if (jours === 14) options.push('toutes les 2 semaines', 'toutes les deux semaines', '/2 sem', 'tous les quinze jours'.replace('quinze', '14'));
  if (jours === 28) options.push('toutes les 4 semaines', 'tous les mois', 'par mois', '/mois');
  return h.choisir(options);
}

const SEPARATEURS = [' puis ', ', puis ', ', ', ' ; ', '\n', '. Puis ', ' ensuite ', ' puis\n', ' -puis- '.replace(/-/g, '')];

interface Genere { texte: string; attendu: Palier[] }

/** Construit un schéma au hasard, son écriture libre et les paliers attendus. */
function generer(h: ReturnType<typeof hasard>): Genere {
  const morceaux: string[] = [];
  const attendu: Palier[] = [];
  const dureesPossibles = [7, 10, 14, 15, 21, 28, 56];

  // 1 à 4 paliers fixes, doses strictement décroissantes.
  const doses = [60, 50, 40, 30, 25, 20, 17.5, 15, 12.5, 10, 7.5, 5, 2.5]
    .filter(() => h.pile(0.35))
    .slice(0, 1 + Math.floor(h.suivant() * 4));
  if (doses.length === 0) doses.push(20);
  const fin = h.choisir(['maintien', 'arret', 'baisse', 'baisse-arret', 'baisse-jusqua-arret'] as const);

  doses.forEach((d, i) => {
    const dernierFixe = i === doses.length - 1;
    const jours = h.choisir(dureesPossibles);
    const sansDuree = dernierFixe && fin === 'maintien';
    const dose = ecrireDose(d, h);
    if (sansDuree) {
      morceaux.push(dose);
      attendu.push({ dose: d, jours: null });
    } else if (h.pile(0.15)) {
      morceaux.push(`${ecrireDuree(jours, h)} à ${dose}`);
      attendu.push({ dose: d, jours });
    } else {
      morceaux.push(`${dose} ${ecrireDuree(jours, h)}`);
      attendu.push({ dose: d, jours });
    }
  });

  const derniere = doses[doses.length - 1]!;
  if (fin.startsWith('baisse')) {
    const pasPossibles = [1, 2, 2.5, 5, 10].filter((p) => p < derniere && Number.isInteger(derniere / p));
    if (pasPossibles.length === 0) return generer(h);
    const pas = h.choisir(pasPossibles);
    const rythme = h.choisir([7, 14, 15, 28]);
    const jusquaArret = fin === 'baisse-jusqua-arret';
    const niveaux = Math.round(derniere / pas);
    const nbBaisses = jusquaArret ? niveaux : 1 + Math.floor(h.suivant() * Math.max(1, niveaux - 1));
    const borne = Math.round((derniere - nbBaisses * pas) * 100) / 100;
    if (borne < 0 || nbBaisses < 1) return generer(h);
    const p = ecrireNombre(pas, h);
    const verbe = h.choisir([`-${p} mg`, `- ${p} mg`, `-${p}`, `baisser de ${p} mg`, `diminuer de ${p} mg`, `décroissance de ${p} mg`, `par paliers de ${p} mg`, `réduire de ${p} mg`]);
    const cible = jusquaArret
      ? h.choisir(["jusqu'à l'arrêt", "jusqu'à arrêt", 'jusqu’à l’arrêt'])
      : h.choisir([`jusqu'à ${ecrireDose(borne, h)}`, `jusqu’à ${borne} mg`, `-> ${borne} mg`, `→ ${borne}`, `jusqu'a ${borne}`]);
    morceaux.push(h.pile() ? `${verbe} ${ecrireRythme(rythme, h)} ${cible}` : `${verbe} ${cible} ${ecrireRythme(rythme, h)}`);
    for (let k = 1; k <= nbBaisses - (borne === 0 ? 1 : 0); k++) {
      const d = Math.round((derniere - k * pas) * 100) / 100;
      if (d !== borne) attendu.push({ dose: d, jours: rythme });
    }
    if (fin === 'baisse-arret' && borne !== 0) {
      attendu.push({ dose: borne, jours: rythme });
      morceaux.push(h.choisir(['arrêt', 'arret', 'stop', 'arrêter', 'Arrêt']));
      attendu.push({ dose: 0, jours: null });
    } else {
      attendu.push({ dose: borne, jours: null });
    }
  } else if (fin === 'arret') {
    morceaux.push(h.choisir(['arrêt', 'arret', 'stop', 'arrêter', 'Arrêt']));
    attendu.push({ dose: 0, jours: null });
  }

  // Assemblage avec séparateurs, préfixe et casse aléatoires.
  let texte = morceaux.map((m, i) => (i === 0 ? m : h.choisir(SEPARATEURS) + m)).join('');
  texte = h.choisir(['', 'Prednisone ', 'prednisone ', 'Cortancyl ', 'PREDNISONE ']) + texte;
  if (h.pile(0.2)) texte = texte.toUpperCase();
  if (h.pile(0.2)) texte = texte.replace(/ /g, '  ');
  if (h.pile(0.2)) texte += h.choisir(['.', ' le matin', ', le matin.', '\n']);
  return { texte, attendu };
}

describe('bêta-test génératif', () => {
  // BETA_TOURS=10 npx vitest run tests/beta.test.ts → 50 000 formulations.
  const tours = Number(process.env.BETA_TOURS ?? 1);
  it(`${5000 * tours} formulations libres redonnent les paliers attendus`, () => {
    const h = hasard(20261002);
    const echecs: string[] = [];
    for (let i = 0; i < 5000 * tours; i++) {
      const { texte, attendu } = generer(h);
      const r = analyser(texte, { joursParMois: 28 });
      // Aller-retour : le texte canonique (après édition du tableau) redonne les mêmes paliers.
      const retour = analyser(versTexte(r.paliers), { joursParMois: 28 });
      const ok = r.ok && JSON.stringify(r.paliers) === JSON.stringify(attendu) && JSON.stringify(retour.paliers) === JSON.stringify(attendu);
      if (!ok && echecs.length < 15) {
        echecs.push(`« ${texte} »\n  attendu ${JSON.stringify(attendu)}\n  obtenu  ${JSON.stringify(r.paliers)}\n  ${r.problemes.map((p) => p.message).join(' | ')}`);
      }
    }
    expect(echecs, echecs.join('\n\n')).toEqual([]);
  });

  it('10 000 saisies aléatoires ne font jamais planter l’analyseur', () => {
    const h = hasard(42);
    const briques = ['20', 'mg', ' ', 'puis', '-', '5', '/', 'sem', 'jusqu’à', '->', '½', ',', '.', '\n', 'j', 'mois', 'arrêt',
      'un jour sur deux', 'en alternance', 'de', 'à', 'baisser', '0', '12,5', 'vingt', 'cp', 'mg/kg', '3-4', 'xyz', 'é', '(', ')', '1 j/2'];
    for (let i = 0; i < 10000; i++) {
      const texte = Array.from({ length: 1 + Math.floor(h.suivant() * 14) }, () => h.choisir(briques)).join(h.pile() ? ' ' : '');
      const r = analyser(texte);
      for (const p of r.problemes) if (p.span) expect(p.span[1]).toBeLessThanOrEqual(texte.length);
      r.paliers.forEach((p, k) => {
        const valeurs = typeof p.dose === 'number' ? [p.dose] : p.dose;
        expect(valeurs.every((v) => Number.isFinite(v) && v >= 0), texte).toBe(true);
        if (r.ok && k < r.paliers.length - 1) expect(p.jours, texte).not.toBeNull();
      });
      expect(r.reformulation).toHaveLength(r.paliers.length);
    }
  });
});

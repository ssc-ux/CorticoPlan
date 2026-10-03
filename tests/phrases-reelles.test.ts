/**
 * Phrases écrites comme dans un vrai courrier (avec fautes de frappe), chacune
 * avec le résultat attendu, noté « dose:jours » (sans « :jours » = à poursuivre,
 * « 0 » = arrêt). Toutes doivent être comprises sans erreur.
 */
import { describe, expect, it } from 'vitest';
import { analyser } from '../src/lib/parser';

const CAS: [string, string][] = [
  ['Prednisone 1 mg/kg/j soit 60 mg/j pendant 3 semaines puis décroissance de 10 mg tous les 10 jours jusqu\'à 20 mg puis de 2,5 mg tous les 10 jours jusqu\'à 10 mg',
    '60:21 50:10 40:10 30:10 20:10 17.5:10 15:10 12.5:10 10'],
  ['Cortancyl 40 mg par jour le matin pendant 1 mois, puis baisse de 5 mg toutes les 2 semaines jusqu\'à 20 mg, puis 2,5 mg toutes les 2 semaines jusqu\'à 10 mg, puis 1 mg par mois jusqu\'à l\'arrêt',
    '40:28 35:14 30:14 25:14 20:14 17.5:14 15:14 12.5:14 10:14 9:28 8:28 7:28 6:28 5:28 4:28 3:28 2:28 1:28 0'],
  ['20 mg/j x 15 j puis 15 mg/j x 15 j puis 10 mg/j x 15 j puis 5 mg/j x 15 j puis stop', '20:15 15:15 10:15 5:15 0'],
  ['PREDNISONE 30MG/J 1 MOIS PUIS 25MG/J 1 MOIS PUIS 20 MG/J', '30:28 25:28 20'],
  ['Décroissance de la corticothérapie : 20 mg pendant 2 semaines, 17,5 mg pendant 2 semaines, 15 mg pendant 2 semaines puis 12,5 mg', '20:14 17.5:14 15:14 12.5'],
  ['60 mg/j à diminuer de 10 mg par semaine jusqu\'à 30 mg puis de 5 mg par semaine jusqu\'à 10 mg', '60:7 50:7 40:7 30:7 25:7 20:7 15:7 10'],
  ['Prednisone 0,5 mg/kg/j soit 30 mg/j pendant 4 semaines puis diminution de 5 mg tous les 15 jours', '30:28 25:15 20:15 15:15 10:15 5:15 0'],
  ['Prednisone 15 mg/j pendant 1 mois puis 12,5 mg/j pendant 1 mois puis 10 mg/j puis diminution de 1 mg/mois',
    '15:28 12.5:28 10:28 9:28 8:28 7:28 6:28 5:28 4:28 3:28 2:28 1:28 0'],
  ['60 mg pendant 3 semaines, puis on diminue de 10 mg chaque semaine jusqu\'à 20 mg, puis de 5 mg chaque semaine jusqu\'à 10 mg, puis de 1 mg tous les mois jusqu\'à 5 mg',
    '60:21 50:7 40:7 30:7 20:7 15:7 10:7 9:28 8:28 7:28 6:28 5'],
  ['Cortancyl 5 mg : 1 cp le matin pendant 1 mois puis arrêt', '5:28 0'],
  ['Cortancyl 5 mg : 2 cp le matin pendant 1 mois puis 1 cp', '10:28 5'],
  ['40 mg (2 cp de 20 mg) pendant 3 semaines puis 20 mg', '40:21 20'],
  ['Cortancyl 20 mg (1 cp) pendant 3 semaines puis 10 mg (2 cp à 5 mg) pendant 3 semaines puis arrêt', '20:21 10:21 0'],
  ['Prednisone 20 mg le matin à poursuivre jusqu\'à nouvel ordre', '20'],
  ['40 mg 4 semaines. Décroissance : -5 mg/semaine jusqu\'à 20 mg', '40:28 35:7 30:7 25:7 20'],
  ['Prednisone 1 mg/kg/j (60 mg) pendant 3 semaines puis arrêt', '60:21 0'],
  ['60 mg/j J1-J21 puis 40 mg/j J22-J35 puis 20 mg/j', '60:21 40:14 20'],
  ['Prednisone 40 mg/j pendant 1 mois, puis diminuer de 5 mg/j tous les 15 jours jusqu\'à 20 mg/j, puis de 2,5 mg/j tous les 15 jours jusqu\'à 10 mg/j, puis de 1 mg/j tous les mois',
    '40:28 35:15 30:15 25:15 20:15 17.5:15 15:15 12.5:15 10:15 9:28 8:28 7:28 6:28 5:28 4:28 3:28 2:28 1:28 0'],
  ['Prednisone : 20 mg/j pendant 6 semaines puis baisser de 2,5 mg toutes les 4 semaines jusqu\'à 5 mg puis de 1 mg toutes les 4 semaines jusqu\'à arrêt',
    '20:42 17.5:28 15:28 12.5:28 10:28 7.5:28 5:28 4:28 3:28 2:28 1:28 0'],
  ['Prednisone 50 mg pendant 1 semaine, 40 mg pendant 1 semaine, 30 mg pendant 1 semaine, 20 mg pendant 1 semaine, 10 mg pendant 1 semaine puis arrêt', '50:7 40:7 30:7 20:7 10:7 0'],
  ['Prednisone 7,5 mg/j au long cours', '7.5'],
  ['20mg/j 3sem -> 15mg/j 3sem -> 10mg/j', '20:21 15:21 10'],
  ['20 mg 2 sem → 15 mg 2 sem → 10 mg 2 sem → arrêt', '20:14 15:14 10:14 0'],
  ['60 mg/j puis baisser de 10 mg/j chaque semaine', '60:7 50:7 40:7 30:7 20:7 10:7 0'],
  ['prednisone 10mg/j pdt 10j puis 5mg/j pdt 10j puis arret', '10:10 5:10 0'],
  ['Commencer à 40 mg/j pendant 3 semaines puis diminuer de 5 mg toutes les semaines jusqu\'à 10 mg', '40:21 35:7 30:7 25:7 20:7 15:7 10'],
  ['Débuter la prednisone à 1 mg/kg/j (soit 70 mg/j) pendant 3 semaines puis 50 mg', '70:21 50'],
  ['Prednisone 30 mg/j pendant 15 jours puis décroissance progressive de 5 mg tous les 15 jours jusqu\'à l\'arrêt', '30:15 25:15 20:15 15:15 10:15 5:15 0'],
  // Fautes de frappe et d'orthographe
  ['40 mg pendnat 3 semianes puis dimunuer de 5 mg tout les 15 jours jusqu\'a 20 mg', '40:21 35:15 30:15 25:15 20'],
  ['predinsone 20 mg 2 smaines pius 10 mg', '20:14 10'],
  ['30 mg 1 moi puis 20 mg 1 moi puis aret', '30:28 20:28 0'],
  ['20 mg 3 sem puis bisser de 5 mg toute les semaines jusq\'a 5 mg', '20:21 15:7 10:7 5'],
  ['15 mg puis -1 mg toutes les 4 semainnes jusqu\'à l\'arrett', '15:28 14:28 13:28 12:28 11:28 10:28 9:28 8:28 7:28 6:28 5:28 4:28 3:28 2:28 1:28 0'],
  ['Cortancyl 25 mg/j pendant 2 semaine puis 20 mg/j pendant 2 semaine puis decroissance de 2,5 mg tout les 15 jours jusqua 10 mg',
    '25:14 20:14 17.5:15 15:15 12.5:15 10'],
  // Dictée vocale (texte tel que produit par la dictée du téléphone).
  ['Prednisone 20 milligrammes pendant 15 jours puis 15 milligrammes pendant 2 semaines puis diminuer de 2,5 milligrammes tous les 15 jours jusqu\'à 5 milligrammes.',
    '20:15 15:14 12.5:15 10:15 7.5:15 5'],
  ['Vingt milligrammes pendant quinze jours, puis quinze milligrammes pendant quinze jours, puis dix milligrammes', '20:15 15:15 10'],
  ['20 mg pendant 7 jours à la ligne 15 mg pendant 7 jours nouvelle ligne 10 mg', '20:7 15:7 10'],
  ['prednisone 20 mg/j pendant 2 semaines point puis 10 mg point', '20:14 10'],
  ['prednisone deux virgule cinq milligrammes pendant un mois puis arrêt', '2.5:28 0'],
  ['Prednisone 20 mg pendant 1 semaine puis 10 mg pendant 1 semaine et arrêter', '20:7 10:7 0'],
  ['Prednisone 30 milligrammes par jour durant 3 semaines virgule puis 20 milligrammes', '30:21 20'],
];

function noter(texte: string): string {
  return analyser(texte, { joursParMois: 28 }).paliers
    .map((p) => (typeof p.dose === 'number' ? String(p.dose) : `${p.dose[0]}/${p.dose[1]}`) + (p.jours === null ? '' : `:${p.jours}`))
    .join(' ');
}

describe('phrases réelles', () => {
  for (const [texte, attendu] of CAS) {
    it(texte, () => {
      const r = analyser(texte, { joursParMois: 28 });
      expect(r.problemes.filter((p) => p.niveau === 'erreur').map((p) => p.message), texte).toEqual([]);
      expect(noter(texte)).toBe(attendu);
    });
  }
});

/**
 * Alertes discrètes et non bloquantes, calculées à partir des seuils de
 * `src/config/alerts.json`. Un seuil laissé à "TODO" désactive l'alerte.
 */
import config from '../config/alerts.json';
import { dateFr } from './dates';
import { nombreFr } from './parser/normalize';
import { doseMoyenne, type Ligne } from './schedule';

export interface Alerte {
  message: string;
  source: string;
}

type Valeur = number | string;
const nombre = (v: Valeur): number | null => (typeof v === 'number' ? v : null);

export function alertes(lignes: Ligne[], cfg: typeof config = config): Alerte[] {
  const sortie: Alerte[] = [];
  if (lignes.length === 0) return sortie;

  // 1. Passage sous le seuil surrénalien (première fois que la dose passe dessous).
  const seuil = nombre(cfg.surrenalien.doseMg as Valeur);
  if (seuil !== null) {
    const k = lignes.findIndex((l, i) => i > 0 && doseMoyenne(l.dose) < seuil && doseMoyenne(lignes[i - 1]!.dose) >= seuil);
    if (k > 0) {
      sortie.push({
        message: `Passage sous ${nombreFr(seuil)} mg/j le ${dateFr(lignes[k]!.debut)} : ${cfg.surrenalien.description.toLowerCase()}.`,
        source: cfg.surrenalien.source,
      });
    }
  }

  // 2. Dose ≥ seuil pendant au moins N jours consécutifs.
  const dosePcp = nombre(cfg.pneumocystose.doseMinMg as Valeur);
  const dureePcp = nombre(cfg.pneumocystose.dureeMinJours as Valeur);
  if (dosePcp !== null && dureePcp !== null) {
    let suite = 0;
    for (const l of lignes) {
      if (doseMoyenne(l.dose) >= dosePcp) {
        suite += l.jours ?? Infinity;
        if (suite >= dureePcp) {
          sortie.push({
            message: `≥ ${nombreFr(dosePcp)} mg/j pendant ${dureePcp} jours ou plus : ${cfg.pneumocystose.description.toLowerCase()}.`,
            source: cfg.pneumocystose.source,
          });
          break;
        }
      } else suite = 0;
    }
  }

  // 3. Durée totale de corticothérapie (un palier « à poursuivre » la prolonge).
  const dureeOs = nombre(cfg.osteoporose.dureeMinJours as Valeur);
  if (dureeOs !== null) {
    const enCours = lignes.some((l) => l.fin === null && l.dose !== 0);
    const total = lignes.reduce((s, l) => s + (l.dose === 0 ? 0 : l.jours ?? 0), 0);
    if (enCours || total > dureeOs) {
      sortie.push({
        message: `Corticothérapie de plus de ${dureeOs} jours : ${cfg.osteoporose.description.toLowerCase()}.`,
        source: cfg.osteoporose.source,
      });
    }
  }
  return sortie;
}

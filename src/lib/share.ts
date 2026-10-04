/**
 * Partage par lien : le schéma est encodé dans l'adresse après « # ».
 * Ce qui suit « # » n'est jamais envoyé au serveur (ni journalisé).
 */
import type { Palier } from './types';

export interface Partage {
  texte: string;
  debut?: string;
}

function versBase64Url(s: string): string {
  const octets = new TextEncoder().encode(s);
  let binaire = '';
  octets.forEach((o) => (binaire += String.fromCharCode(o)));
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binaire, (c) => c.charCodeAt(0)));
}

/** « s » : lien de partage entre médecins ; « a » : page patient (agenda), ouverte par le QR code. */
export function encoderPartage(p: Partage, cle: 's' | 'a' = 's'): string {
  return cle + '=' + versBase64Url(JSON.stringify({ t: p.texte, d: p.debut }));
}

/** Lit « #s=… » (ou « #a=… ») ; renvoie `null` si absent ou illisible. */
export function decoderPartage(hash: string, cle: 's' | 'a' = 's'): Partage | null {
  const m = new RegExp(`(?:^#?|&)${cle}=([A-Za-z0-9_-]+)`).exec(hash);
  if (!m) return null;
  try {
    const o = JSON.parse(depuisBase64Url(m[1]!));
    if (typeof o.t !== 'string') return null;
    return { texte: o.t.slice(0, 5000), debut: typeof o.d === 'string' ? o.d : undefined };
  } catch {
    return null;
  }
}

/**
 * Format compact du QR code patient (moins de caractères = QR moins dense,
 * plus facile à scanner) : « 20261004~40*28_30*14_20/0*14_5* ».
 * Chaque palier : dose (ou « a/b » un jour sur deux) « * » jours (vide = à poursuivre).
 */
export function encoderPaliers(paliers: Palier[], debut: string): string {
  const p = paliers.map((x) => `${typeof x.dose === 'number' ? x.dose : x.dose.join('/')}*${x.jours ?? ''}`).join('_');
  return `p=${debut.replaceAll('-', '')}~${p}`;
}

export function decoderPaliers(hash: string): { paliers: Palier[]; debut: string } | null {
  const m = /(?:^#?|&)p=(\d{8})~([\d.*_/]+)/.exec(hash);
  if (!m) return null;
  const debut = `${m[1]!.slice(0, 4)}-${m[1]!.slice(4, 6)}-${m[1]!.slice(6)}`;
  const paliers: Palier[] = [];
  for (const morceau of m[2]!.split('_').slice(0, 200)) {
    const [d, j] = morceau.split('*');
    const doses = (d ?? '').split('/').map(Number);
    const jours = j ? Number(j) : null;
    if (doses.some((x) => !Number.isFinite(x) || x < 0 || x > 1000) || (jours !== null && !(jours > 0 && jours < 5000))) return null;
    paliers.push({ dose: doses.length === 2 ? [doses[0]!, doses[1]!] : doses[0]!, jours });
  }
  return paliers.length ? { paliers, debut } : null;
}

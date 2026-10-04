/**
 * Partage par lien : le schéma est encodé dans l'adresse après « # ».
 * Ce qui suit « # » n'est jamais envoyé au serveur (ni journalisé).
 */
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

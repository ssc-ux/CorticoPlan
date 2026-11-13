/*
 * Service worker : rend le site utilisable hors ligne.
 * - Pages : réseau d'abord (pour avoir la dernière version), cache sinon.
 * - Fichiers (scripts, styles, icônes) : cache d'abord, réseau sinon.
 * Tous les fichiers sont mis en cache dès l'installation : le site fonctionne
 *   hors ligne après une seule visite.
 * Aucune donnée médicale n'est mise en cache : seulement les fichiers du site.
 */
// La version et la liste des fichiers sont remplies à la construction (vite.config.ts) :
// le cache change de nom à chaque version, l'ancien est supprimé.
const CACHE = 'corticoplan-850aaad044';
const FICHIERS = ["./","./index.html","./icon.svg","./manifest.webmanifest","./theme.js","./assets/index-BPcNT9wZ.css","./assets/index-YoNJmbiR.js","./assets/plus-jakarta-sans-eXO_dkmS.woff2"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Ne supprime que les anciens caches de CorticoPlan : les autres outils partagent le domaine.
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k.startsWith('corticoplan-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copie));
          return rep;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true })),
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (enCache) =>
        enCache ||
        fetch(req).then((rep) => {
          if (rep.ok) {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(req, copie));
          }
          return rep;
        }),
    ),
  );
});

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Le site se construit dans site/, publié tel quel par GitHub Pages
// (la page d'accueil du dépôt, index.html, redirige vers site/).
export default defineConfig({
  root: 'web',
  publicDir: '../public',
  base: './', // chemins relatifs : fonctionne dans n'importe quel sous-dossier
  plugins: [svelte()],
  build: { outDir: '../site', emptyOutDir: true },
});

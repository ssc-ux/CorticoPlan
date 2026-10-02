import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le site fonctionne quel que soit le sous-dossier
  // (GitHub Pages sert le dépôt sous /CorticoPlan/).
  base: './',
  plugins: [svelte()],
  test: { include: ['tests/**/*.test.ts'] },
});

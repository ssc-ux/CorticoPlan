import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

/**
 * Service worker : src/sw.js est complété à la construction avec la liste des
 * fichiers du site (mis en cache dès l'installation) et un numéro de version
 * (l'ancien cache est supprimé à chaque mise à jour).
 */
function serviceWorker(): Plugin {
  return {
    name: 'corticoplan-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const fichiers = ['./', './index.html', './icon.svg', './manifest.webmanifest', './theme.js']
        .concat(Object.keys(bundle).filter((f) => f.startsWith('assets/')).sort().map((f) => './' + f));
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8');
      const version = createHash('sha256').update(source + fichiers.join()).digest('hex').slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: source.replace('__VERSION__', version).replace('__FICHIERS__', JSON.stringify(fichiers)),
      });
    },
  };
}

// Le site se construit dans site/ ; la mise en ligne (branche gh-pages) est
// faite par .github/workflows/deploy.yml.
export default defineConfig({
  root: 'web',
  publicDir: '../public',
  base: './', // chemins relatifs : fonctionne dans n'importe quel sous-dossier
  plugins: [svelte(), serviceWorker()],
  build: { outDir: '../site', emptyOutDir: true },
});

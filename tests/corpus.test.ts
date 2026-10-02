/**
 * Exécute tous les cas de tests/corpus/*.json contre le parseur.
 * Ajouter un cas = ajouter un objet dans un fichier JSON, rien d'autre.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyser } from '../src/lib/parser';
import type { CodeProbleme, Palier } from '../src/lib/types';

interface Cas {
  id: string;
  entree: string;
  paliers: Palier[];
  problemes: CodeProbleme[];
}

const dossier = join(import.meta.dirname, 'corpus');
const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.json'));
const ids = new Set<string>();

for (const fichier of fichiers) {
  const cas: Cas[] = JSON.parse(readFileSync(join(dossier, fichier), 'utf8'));
  describe(fichier, () => {
    for (const c of cas) {
      it(`${c.id} — « ${c.entree.replace(/\n/g, ' ⏎ ')} »`, () => {
        expect(ids.has(c.id), `identifiant en double : ${c.id}`).toBe(false);
        ids.add(c.id);
        const r = analyser(c.entree, { joursParMois: 28 });
        expect(r.paliers).toEqual(c.paliers);
        const codes = [...new Set(r.problemes.filter((p) => p.niveau !== 'info').map((p) => p.code))].sort();
        expect(codes).toEqual([...c.problemes].sort());
      });
    }
  });
}

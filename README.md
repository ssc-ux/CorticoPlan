# CorticoPlan

Générateur de schémas de décroissance de corticothérapie (prednisone), pour médecins.
Site statique, en français, sans serveur : **aucune donnée n'est stockée ni envoyée.**

> ⚠️ Aide à la rédaction. Ne remplace pas le jugement médical. Le schéma reste sous la
> responsabilité du prescripteur. Aucune donnée patient dans ce dépôt.

## État

- [x] Étape 2 — Parseur de texte libre (déterministe, sans IA) + corpus de tests
- [ ] Étape 3 — Tableau daté, édition, texte d'ordonnance
- [ ] Étape 4 — Mode PNDS
- [ ] Étape 5 — Impression, partage par lien, hors ligne
- [ ] Étape 6 — Mise en ligne (GitHub Pages)

## Commandes

```bash
npm install
npm test              # corpus + tests unitaires + bêta-test (5 000 formulations)
BETA_TOURS=10 npm test  # bêta-test étendu (50 000 formulations)
npm run typecheck
```

## Organisation

- `src/lib/parser/` : normalisation → découpage en jetons → assemblage en paliers → contrôles.
- `src/lib/format.ts` : reformulation lisible.
- `tests/corpus/` : cas « texte → paliers attendus » (voir son README pour en ajouter).

Conventions : un nombre seul est une dose en mg ; la première baisse a lieu à J1 ;
le schéma se termine sur la dernière dose écrite (« à poursuivre ») sauf « arrêt » ;
1 mois = 28 jours (réglable). Toute interprétation non évidente est signalée.

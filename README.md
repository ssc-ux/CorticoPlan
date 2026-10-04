# CorticoPlan

Créé par **Quentin Astouati**.

Rédiger un schéma de décroissance de **prednisone** en quelques secondes :
tableau daté, texte d'ordonnance à copier, calendrier patient à imprimer.

**Site : https://ssc-ux.github.io/CorticoPlan/**

> ⚠️ Aide à la rédaction. Ne remplace pas le jugement médical. Le schéma reste sous la
> responsabilité du prescripteur. Aucune donnée n'est enregistrée ni envoyée : tout est
> calculé dans le navigateur. Ne jamais saisir de nom de patient.

## Utilisation

1. **Écrire le schéma** comme dans un courrier, par exemple :
   `40 mg 1 mois puis baisser de 5 mg tous les 15 jours jusqu'à 20 mg puis -2,5 mg toutes les 2 semaines jusqu'à 10 mg`
   — ou **Choisir un schéma** dans la liste.
2. Vérifier la **reformulation** affichée sous le champ (ce qui n'est pas compris est surligné en rouge).
3. Choisir la **date de début**.
4. Le **tableau** apparaît : toucher une ligne pour modifier une dose ou une durée.
5. **Copier le texte de l'ordonnance** et le coller dans votre logiciel.
6. Au besoin : **Imprimer le calendrier patient** (1 page A4, une case par jour) ou **Partager** le schéma par lien.

Le site fonctionne aussi **hors ligne** une fois ouvert une première fois, et peut être
ajouté à l'écran d'accueil du téléphone.

### Ce que comprend le champ libre

| Écriture | Exemples |
|---|---|
| Dose | `20`, `20 mg`, `20 mg/j`, `vingt mg`, `12,5`, `7 ½` |
| Durée | `3 sem`, `15 j`, `1 mois` (= 28 jours, réglable), `pendant 10 jours`, `x 10 j` |
| Baisse | `-5`, `moins 5`, `baisser de 5`, `diminuer de 5`, `enlever 5`, `par paliers de 2,5` |
| Rythme | `/sem`, `par semaine`, `tous les 15 jours`, `toutes les 4 semaines` |
| Borne | `jusqu'à 10`, `→ 10`, `-> 10`, `de 20 à 10`, `jusqu'à l'arrêt` |
| Un jour sur deux | `20 mg 1 j/2`, `20 mg un jour sur deux` |
| Dictée vocale | texte dicté au téléphone puis collé : `vingt milligrammes`, `deux virgule cinq`, `à la ligne`, `point` |
| Fin | `arrêt` ; sinon la dernière dose est **maintenue** (« à poursuivre », « jusqu'à réévaluation » acceptés) |

Conventions : un nombre seul est une dose en mg ; dans une baisse, la première
diminution a lieu dès le premier jour du bloc. Non pris en charge (signalé) :
doses en mg/kg, en comprimés, fourchettes (« 3-4 semaines »), alternance entre deux doses.

### Pour le patient

Le calendrier imprimé (une case à cocher par jour) surligne les **jours de changement de dose** et
résume les étapes en haut de page. Son **QR code** ouvre sur le téléphone du patient une page avec la
dose du jour et le prochain changement, et un bouton « Ajouter à mon agenda » : **un rappel le jour de
chaque changement de dose** (et le jour de l'arrêt), à l'heure choisie. Le schéma est dans le QR code
lui-même (après « # ») : rien n'est envoyé ni enregistré, aucun nom n'y figure.

### Comparer des schémas

Onglet **Comparer** : toucher la tuile d'une maladie affiche tous ses schémas sur un même
graphique ; décocher ceux qui n'intéressent pas. On peut ajouter les schémas d'une autre maladie
et le schéma écrit dans « Écrire ». Un tableau indique pour chacun la dose de départ, la semaine
où l'on passe à 7,5 mg puis à 5 mg, l'arrêt et la dose cumulée ; « Utiliser » reprend le schéma.

## Modifier le contenu (sans programmer)

Depuis github.com, ouvrir le fichier, cliquer sur le crayon ✏️, modifier, puis « Commit changes ».
Le site se met à jour tout seul en 1 à 2 minutes si les tests passent.

- **Schémas proposés** : `src/data/schemas.json` — copier un bloc existant, modifier
  `pathologie`, `nom`, `texte` (écrit comme dans le champ libre), `statut` et `source`.
  90 schémas sont proposés (PNDS HAS, recommandations KDIGO, ACR, EULAR (dont EULAR/PReS 2024 pour la maladie de Still), SFR et
  protocoles d'essais publiés sur ClinicalTrials.gov : ADVOCATE, AURORA, BLISS-LN, MANDARA, PEXIVAS,
  SELECT-GCA), chacun avec sa source (document, page,
  lien), tous marqués
  **« À vérifier »** : après vérification dans la source, passer `"valide": false` à `true`.
- **Seuils d'alerte** : `src/config/alerts.json` — remplacer chaque `"TODO"` par un nombre
  (sans guillemets) et indiquer la source. Une alerte avec `TODO` reste désactivée.
- **Cas de test** : `tests/corpus/*.json` (voir `tests/corpus/README.md`).

## Pour les développeurs

```bash
npm install
npm run dev               # site local
npm test                  # 60+ tests dont bêta-test (5 000 formulations aléatoires)
BETA_TOURS=10 npm test    # bêta-test étendu (50 000 formulations)
npm run build             # site statique dans site/ (publié tel quel)
```

- `src/lib/` : logique pure et testée (parseur, dates, ordonnance, partage, alertes).
- `src/components/` : interface (Svelte 5).
- `web/index.html` : page d'entrée du site ; `index.html` (racine) redirige vers `site/`.
- `.github/workflows/deploy.yml` : tests puis mise à jour de `site/` (publié par GitHub Pages depuis `main`).
- Ne pas modifier `site/` à la main : il est régénéré automatiquement.

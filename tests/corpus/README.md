# Corpus de tests du parseur

Chaque fichier `.json` contient une liste de cas. Tous les fichiers du dossier
sont exécutés automatiquement par `tests/corpus.test.ts`.

```json
{
  "id": "identifiant-unique",
  "entree": "20 mg 3 sem puis -5 mg/sem jusqu'à 10 mg",
  "paliers": [
    { "dose": 20, "jours": 21 },
    { "dose": 15, "jours": 7 },
    { "dose": 10, "jours": null }
  ],
  "problemes": []
}
```

- `dose` : mg/jour, ou `[dose, 0]` pour « un jour sur deux » (pas d'alternance entre deux doses).
- `jours` : durée du palier ; `null` = à poursuivre (ou arrêt si dose 0).
- `problemes` : codes **exacts** des erreurs et avertissements attendus
  (les simples informations ne sont pas vérifiées). Liste des codes :
  `src/lib/types.ts`.
- Convention : 1 mois = 28 jours.

Pour ajouter un cas réel : copier un bloc, changer `id`, `entree` et le
résultat attendu. **Aucune donnée patient.**

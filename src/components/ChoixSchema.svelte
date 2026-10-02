<script lang="ts">
  /**
   * Mode « Choisir un schéma » : pathologie → schéma. Le schéma choisi
   * remplit simplement le champ de texte (un seul moteur).
   */
  import { PATHOLOGIES, SCHEMAS, type Schema } from '../lib/schemas';

  let { onchoix }: { onchoix: (s: Schema) => void } = $props();
  let pathologie = $state('');
  const liste = $derived(SCHEMAS.filter((s) => s.pathologie === pathologie));
</script>

<div class="choix">
  <label for="patho">Pathologie</label>
  <select id="patho" bind:value={pathologie}>
    <option value="" disabled>Choisir…</option>
    {#each PATHOLOGIES as p}<option value={p}>{p}</option>{/each}
  </select>

  {#each liste as s}
    <button type="button" class="schema" onclick={() => onchoix(s)}>
      <span class="nom">{s.nom}</span>
      <span class="statut" class:non-valide={!s.valide}>{s.valide ? '✓ Vérifié' : 'À vérifier'} — {s.statut}</span>
      <span class="source">{s.source.document} — {s.source.page}</span>
    </button>
  {/each}

  <p class="discret">Le schéma choisi s'écrit dans le champ de texte : vous pouvez ensuite le modifier librement.</p>
</div>

<style>
  .choix {
    display: grid;
    gap: 0.6rem;
  }
  label {
    font-weight: 600;
  }
  select {
    min-height: 44px;
    padding: 0.4rem 0.6rem;
    border: 2px solid var(--bord);
    border-radius: var(--rayon);
    background: var(--fond);
  }
  .schema {
    display: grid;
    gap: 0.2rem;
    text-align: left;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--bord);
    border-radius: var(--rayon);
    background: var(--fond);
  }
  .schema:hover {
    border-color: var(--accent);
  }
  .nom {
    font-weight: 600;
  }
  .statut {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--accent);
  }
  .statut.non-valide {
    color: var(--erreur);
  }
  .source {
    font-size: 0.8rem;
    color: var(--texte-3);
  }
  p {
    margin: 0;
  }
</style>

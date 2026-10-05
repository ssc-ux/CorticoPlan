<script lang="ts">
  /**
   * Texte d'ordonnance + bouton « Copier » (qui copie toujours le texte entier).
   * Sur téléphone, une ordonnance longue est repliée à 4 lignes.
   */
  let { texte }: { texte: string } = $props();
  let copie = $state(false);
  let deplie = $state(false);
  const nbLignes = $derived(texte.split('\n').length);
  const repliable = $derived(nbLignes > 4);

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      // Ancien navigateur : sélection + commande de copie.
      const zone = document.createElement('textarea');
      zone.value = texte;
      document.body.append(zone);
      zone.select();
      document.execCommand('copy');
      zone.remove();
    }
    copie = true;
    setTimeout(() => (copie = false), 2000);
  }
</script>

<div class="zone" class:replie={repliable && !deplie}>
  <pre>{texte}</pre>
</div>
{#if repliable}
  <button type="button" class="deplier" onclick={() => (deplie = !deplie)}>
    {deplie ? 'Réduire' : `Afficher toute l'ordonnance (${nbLignes} lignes)`}
  </button>
{/if}
<button type="button" class="bouton principal" onclick={copier}>
  {copie ? '✓ Copié' : 'Copier le texte de l’ordonnance'}
</button>

<style>
  .zone {
    position: relative;
  }
  .deplier {
    display: block;
    margin: -0.4rem 0 0.75rem;
    padding: 4px 0;
    border: 0;
    background: none;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }
  /* Téléphone : 4 lignes visibles, fondu en bas. Grand écran : tout est affiché. */
  @media (max-width: 1099px) {
    .replie pre {
      max-height: calc(4 * 1.6em + 1.7rem);
      overflow: hidden;
    }
    .replie::after {
      content: '';
      position: absolute;
      inset: auto 1px 0.75rem 1px;
      height: 2.2em;
      border-radius: 0 0 var(--rayon) var(--rayon);
      background: linear-gradient(transparent, var(--fond));
      pointer-events: none;
    }
  }
  @media (min-width: 1100px) {
    .deplier {
      display: none;
    }
  }
  pre {
    margin: 0 0 0.75rem;
    padding: 0.85rem 0.9rem;
    background: var(--fond);
    border: 1px solid var(--bord);
    border-radius: var(--rayon);
    white-space: pre-wrap;
    word-break: break-word;
    font: inherit;
    line-height: 1.6;
  }
</style>

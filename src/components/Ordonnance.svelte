<script lang="ts">
  /** Texte d'ordonnance + bouton « Copier ». */
  let { texte }: { texte: string } = $props();
  let copie = $state(false);

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

<pre>{texte}</pre>
<button type="button" class="bouton principal" onclick={copier}>
  {copie ? '✓ Copié' : 'Copier le texte de l’ordonnance'}
</button>

<style>
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

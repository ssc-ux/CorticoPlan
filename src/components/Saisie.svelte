<script lang="ts">
  /**
   * Champ de saisie libre, avec des exemples qui défilent en gris clair tant
   * que le champ est vide et n'a pas le focus.
   */
  import { onDestroy } from 'svelte';
  import { EXEMPLES } from '../lib/exemples';

  let { texte = $bindable(), accueil = false }: { texte: string; accueil?: boolean } = $props();

  let focus = $state(false);
  let index = $state(0);
  let visible = $state(true);

  // Toutes les 3,5 s : fondu de sortie, exemple suivant, fondu d'entrée.
  const minuteur = setInterval(() => {
    visible = false;
    setTimeout(() => {
      index = (index + 1) % EXEMPLES.length;
      visible = true;
    }, 300);
  }, 3500);
  onDestroy(() => clearInterval(minuteur));

  const afficherExemple = $derived(texte.length === 0 && !focus);
</script>

<div class="champ" class:accueil>
  <label for="saisie" class="visuellement-cache">Schéma de décroissance, écrit comme dans un courrier</label>
  <textarea
    id="saisie"
    bind:value={texte}
    onfocus={() => (focus = true)}
    onblur={() => (focus = false)}
    rows="4"
    spellcheck="false"
    autocomplete="off"
  ></textarea>
  {#if afficherExemple}
    <div class="exemple" class:visible aria-hidden="true">Ex. : {EXEMPLES[index]}</div>
  {/if}
  {#if texte.length > 0}
    <button class="effacer" type="button" onclick={() => (texte = '')} aria-label="Effacer le texte">×</button>
  {/if}
</div>

<style>
  .champ {
    position: relative;
  }
  textarea {
    display: block;
    width: 100%;
    min-height: 7.5rem;
    padding: 0.85rem 2.6rem 0.85rem 0.9rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    color: var(--fg);
    resize: vertical;
    font-size: 1.05rem;
    line-height: 1.5;
  }
  textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  /* Accueil : champ arrondi et ombré, comme une barre de recherche. */
  .accueil textarea {
    min-height: 6rem;
    padding: 0.9rem 2.8rem 0.9rem 1.25rem;
    border-radius: 24px;
    box-shadow: 0 1px 6px rgb(32 33 36 / 0.12);
    transition: box-shadow 0.2s;
  }
  .accueil textarea:hover,
  .accueil textarea:focus {
    box-shadow: 0 2px 10px rgb(32 33 36 / 0.22);
  }
  .accueil .exemple {
    inset: 0.9rem 2.8rem auto 1.25rem;
  }
  .exemple {
    position: absolute;
    inset: 0.85rem 2.6rem auto 0.9rem;
    color: var(--texte-3);
    font-size: 1.05rem;
    font-weight: 300;
    line-height: 1.5;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .exemple.visible {
    opacity: 1;
  }
  .effacer {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--texte-3);
    font-size: 1.4rem;
    line-height: 1;
  }
  .effacer:hover {
    background: var(--surface);
    color: var(--texte);
  }
  @media (prefers-reduced-motion: reduce) {
    /* Accueil : champ arrondi et ombré, comme une barre de recherche. */
  .accueil textarea {
    min-height: 6rem;
    padding: 0.9rem 2.8rem 0.9rem 1.25rem;
    border-radius: 24px;
    box-shadow: 0 1px 6px rgb(32 33 36 / 0.12);
    transition: box-shadow 0.2s;
  }
  .accueil textarea:hover,
  .accueil textarea:focus {
    box-shadow: 0 2px 10px rgb(32 33 36 / 0.22);
  }
  .accueil .exemple {
    inset: 0.9rem 2.8rem auto 1.25rem;
  }
  .exemple {
      transition: none;
    }
  }
</style>

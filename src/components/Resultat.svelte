<script lang="ts">
  /**
   * Sous le champ : ce que le moteur a compris (reformulation), ce qu'il n'a
   * pas compris (surligné dans le texte), et les avertissements.
   */
  import type { ResultatAnalyse, Span } from '../lib/types';

  let { texte, resultat }: { texte: string; resultat: ResultatAnalyse } = $props();

  // Affichage simple : s'il y a des mots non compris, on ne montre qu'eux
  // (les autres erreurs en découlent souvent) ; sinon les autres erreurs.
  const inconnus = $derived(resultat.problemes.filter((p) => p.code === 'mot-inconnu'));
  const erreurs = $derived(
    inconnus.length ? inconnus : resultat.problemes.filter((p) => p.niveau === 'erreur'),
  );
  const messages = $derived(
    inconnus.length
      ? [`Mot${inconnus.length > 1 ? 's' : ''} non compris : ${inconnus.map((p) => `« ${texte.slice(...p.span!)} »`).join(', ')}. Reformulez ou supprimez.`]
      : [...new Set(erreurs.map((p) => p.message))],
  );

  /** Découpe le texte en morceaux normaux / surlignés. */
  const morceaux = $derived.by(() => {
    const spans: Span[] = erreurs
      .filter((p) => p.span)
      .map((p) => p.span!)
      .sort((a, b) => a[0] - b[0]);
    const sortie: { t: string; marque: boolean }[] = [];
    let pos = 0;
    for (const [d, f] of spans) {
      if (d < pos) continue;
      if (d > pos) sortie.push({ t: texte.slice(pos, d), marque: false });
      sortie.push({ t: texte.slice(d, f), marque: true });
      pos = f;
    }
    if (pos < texte.length) sortie.push({ t: texte.slice(pos), marque: false });
    return sortie;
  });

  const avertissements = $derived(resultat.problemes.filter((p) => p.niveau === 'avertissement'));
  const infos = $derived(resultat.problemes.filter((p) => p.niveau === 'info'));
</script>

{#if texte.trim()}
  <div class="resultat" aria-live="polite">
    {#if erreurs.length}
      <div class="bloc erreur">
        <p class="titre">À corriger</p>
        <p class="texte-surligne">
          {#each morceaux as m}{#if m.marque}<mark>{m.t}</mark>{:else}{m.t}{/if}{/each}
        </p>
        <ul>
          {#each messages as m}<li>{m}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if resultat.reformulation.length}
      <div class="bloc compris">
        <p class="titre">{erreurs.length ? 'Compris pour l’instant' : 'Compris'}</p>
        <ol>
          {#each resultat.reformulation as ligne}<li>{ligne}</li>{/each}
        </ol>
      </div>
    {/if}

    {#each avertissements as a}
      <p class="bloc attention"><span aria-hidden="true">⚠</span> {a.message}</p>
    {/each}
    {#if !erreurs.length}
      {#each infos as i}
        <p class="info">ⓘ {i.message}</p>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .resultat {
    display: grid;
    gap: 0.6rem;
    margin-top: 0.75rem;
  }
  .bloc {
    margin: 0;
    padding: 0.75rem 0.9rem;
    border-radius: var(--rayon);
  }
  .titre {
    margin: 0 0 0.3rem;
    font-weight: 700;
    font-size: 0.9rem;
  }
  .erreur {
    background: var(--erreur-fond);
    color: var(--texte);
    border-left: 4px solid var(--erreur);
  }
  .erreur .titre {
    color: var(--erreur);
  }
  .texte-surligne {
    margin: 0 0 0.4rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  mark {
    background: var(--surligne);
    color: inherit;
    border-radius: 3px;
    padding: 0 2px;
    text-decoration: underline wavy var(--erreur);
  }
  .compris {
    background: var(--accent-doux);
  }
  ol,
  ul {
    margin: 0;
    padding-left: 1.4rem;
  }
  .attention {
    background: var(--attention-fond);
    color: var(--texte);
    border-left: 4px solid var(--attention);
  }
  .info {
    margin: 0;
    color: var(--texte-3);
    font-size: 0.85rem;
  }
</style>

<script lang="ts">
  /**
   * Sous le champ : ce que le moteur a compris (reformulation), ce qu'il n'a
   * pas compris (surligné dans le texte), et les avertissements.
   */
  import type { ResultatAnalyse, Span } from '../lib/types';

  let { texte, resultat, onappliquer }: { texte: string; resultat: ResultatAnalyse; onappliquer?: (t: string) => void } = $props();

  function appliquer(position: number, insertion: string) {
    onappliquer?.(texte.slice(0, position) + insertion + texte.slice(position));
  }

  // Affichage simple : s'il y a des mots non compris, on ne montre qu'eux
  // (les autres erreurs en découlent souvent) ; sinon les autres erreurs.
  const inconnus = $derived(resultat.problemes.filter((p) => p.code === 'mot-inconnu'));
  /** Une seule question à la fois, avec réponses en un geste (« Jusqu'où baisser ? »). */
  const question = $derived(inconnus.length ? undefined : resultat.problemes.find((p) => p.suggestions?.length));
  const erreurs = $derived(
    inconnus.length ? inconnus : question ? [question] : resultat.problemes.filter((p) => p.niveau === 'erreur'),
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
        <p class="titre">{question ? 'Une précision' : 'À corriger'}</p>
        <p class="texte-surligne">
          {#each morceaux as m}{#if m.marque}<mark>{m.t}</mark>{:else}{m.t}{/if}{/each}
        </p>
        <ul>
          {#each messages as m}<li>{m}</li>{/each}
        </ul>
        {#if question}
          <div class="reponses">
            {#each question.suggestions ?? [] as r}
              <button type="button" onclick={() => appliquer(r.position, r.insertion)}>{r.libelle}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Tant qu'il reste une erreur ou une question, un déroulé partiel serait trompeur : on ne l'affiche pas. -->
    {#if resultat.reformulation.length && !erreurs.length}
      <!-- Au-delà de 3 paliers, le détail est replié (il est aussi dans le tableau et l'ordonnance). -->
      <details class="bloc compris" open={resultat.reformulation.length <= 3}>
        <summary class="titre">✓ Compris{resultat.reformulation.length > 3 ? ` : ${resultat.reformulation.length} paliers (afficher le détail)` : ''}</summary>
        <ol>
          {#each resultat.reformulation as ligne}<li>{ligne}</li>{/each}
        </ol>
      </details>
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
  .reponses {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .reponses button {
    min-height: 40px;
    padding: 6px 14px;
    border: 1px solid var(--accent);
    border-radius: 999px;
    background: var(--card);
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }
  .reponses button:hover {
    background: var(--c1s);
  }
  .compris {
    background: var(--accent-doux);
  }
  .compris summary {
    margin: 0;
    cursor: pointer;
    list-style: none;
  }
  .compris summary::-webkit-details-marker {
    display: none;
  }
  .compris[open] summary {
    margin-bottom: 0.3rem;
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

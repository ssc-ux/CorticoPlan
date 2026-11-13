<script lang="ts">
  /**
   * Sous le champ : uniquement ce qui est à corriger (surligné dans le texte)
   * ou à vérifier (avertissements). Quand tout est compris, rien n'est affiché.
   */
  import type { Proposition } from '../lib/parser/propose';
  import type { ResultatAnalyse, Span } from '../lib/types';

  let {
    texte,
    resultat,
    propositions = [],
    onappliquer,
  }: { texte: string; resultat: ResultatAnalyse; propositions?: Proposition[]; onappliquer?: (t: string) => void } = $props();

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
</script>

<!-- Schéma compris : rien n'est affiché ici (le tableau et l'ordonnance suffisent). -->
{#if texte.trim() && (propositions.length || erreurs.length || avertissements.length)}
  <div class="resultat" aria-live="polite">
    {#if propositions.length}
      <!-- Une correction est trouvée : on la propose plutôt que de signaler l'erreur. -->
      <div class="bloc proposition">
        <p class="titre">Vouliez-vous dire ?</p>
        <div class="choix">
          {#each propositions as p}
            <button type="button" onclick={() => onappliquer?.(p.texte)}>
              <span class="phrase"
                >{#each p.morceaux as m}{#if m.avant !== undefined}{#if m.avant}<s>{m.avant}</s>{/if}{#if m.apres}<b>{m.apres}</b>{/if}{:else}{m.t}{/if}{/each}</span
              >
              <span class="appliquer">{p.ok ? 'Corriger' : 'Corriger en partie'}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else if erreurs.length}
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

    {#each avertissements as a}
      <p class="bloc attention"><span aria-hidden="true">⚠</span> {a.message}</p>
    {/each}
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
  .proposition {
    background: var(--accent-doux);
    border-left: 4px solid var(--accent);
  }
  .proposition .titre {
    color: var(--accent);
  }
  .choix {
    display: grid;
    gap: 8px;
  }
  .choix button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--accent);
    border-radius: var(--rayon);
    background: var(--card);
    color: var(--texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .choix button:hover {
    background: var(--c1s);
  }
  .phrase {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .phrase s {
    color: var(--texte-3);
  }
  .phrase s + b {
    margin-left: 0.25em;
  }
  .phrase b {
    color: var(--accent);
  }
  .appliquer {
    flex: none;
    color: var(--accent);
    font-weight: 600;
    font-size: 0.9rem;
  }
  ul {
    margin: 0;
    padding-left: 1.4rem;
  }
  .attention {
    background: var(--attention-fond);
    color: var(--texte);
    border-left: 4px solid var(--attention);
  }
</style>

<script lang="ts">
  /**
   * Déroulant sous le champ principal quand on tape un protocole (« pexivas »).
   * Le protocole actif est déplié : une rangée de puces par choix (dose, poids…),
   * l'aperçu du schéma, puis « Utiliser ce schéma » qui remplit le champ.
   * Clavier (depuis le champ) : ↑ ↓ changent de protocole, Entrée utilise, Échap ferme.
   */
  import { possible, schemaPour, type Selection, type Suggestion } from '../lib/protocoles';
  import { court, estEssai, estPnds, type Schema } from '../lib/schemas';

  let {
    suggestions,
    requete,
    precedent = null,
    onchoix,
    onfermer,
  }: {
    suggestions: Suggestion[];
    requete: string;
    /** Schéma choisi avant « Changer » : ses choix sont repris. */
    precedent?: Schema | null;
    onchoix: (s: Schema) => void;
    onfermer: () => void;
  } = $props();

  let actif = $state(0);
  let choix = $state<Record<string, Selection>>({});
  const iActif = $derived(Math.min(actif, suggestions.length - 1));

  $effect(() => {
    void requete;
    actif = 0;
  });

  function selection({ protocole: p, preselection }: Suggestion): Selection {
    const avant = precedent && precedent.protocole === p.nom && precedent.pathologie === p.pathologie ? precedent.choix : {};
    return { ...preselection, ...avant, ...choix[p.cle] };
  }

  function sans(sel: Selection, cle: string): Selection {
    const { [cle]: _, ...reste } = sel;
    return reste;
  }

  function cocher(sug: Suggestion, critere: string, valeur: string) {
    choix[sug.protocole.cle] = { ...selection(sug), [critere]: valeur };
  }

  const type = (s: Schema) => (estPnds(s) ? 'PNDS' : estEssai(s) ? 'Essai' : 'Recommandation');

  /** Touches reçues du champ ; renvoie true si la touche a été utilisée. */
  export function clavier(e: KeyboardEvent): boolean {
    const n = suggestions.length;
    if (!n) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      actif = (iActif + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    } else if (e.key === 'Enter' && !e.shiftKey) {
      const sug = suggestions[iActif]!;
      const s = schemaPour(sug.protocole, selection(sug));
      if (s) onchoix(s);
    } else if (e.key === 'Escape') {
      onfermer();
    } else return false;
    e.preventDefault();
    return true;
  }
</script>

<div class="sugg" id="suggestions-protocoles">
  <p class="titre" aria-live="polite">
    {suggestions.length} protocole{suggestions.length > 1 ? 's' : ''} pour « {requete.trim()} »
  </p>
  {#each suggestions as sug, i (sug.protocole.cle)}
    {@const p = sug.protocole}
    {@const sel = selection(sug)}
    {@const schema = schemaPour(p, sel)}
    {#if i === iActif}
      <div class="carte">
        <div class="tete">
          <strong>{p.nom}</strong>
          <span class="discret">{p.pathologie} · {p.schemas.length} schéma{p.schemas.length > 1 ? 's' : ''}</span>
        </div>
        {#each p.criteres as c, k}
          <div class="critere" role="group" aria-label={c.nom}>
            <span class="nom">{k + 1} · {c.nom}</span>
            <div class="puces">
              {#each c.valeurs as v}
                <button
                  type="button"
                  class="puce"
                  class:on={sel[c.nom] === v}
                  class:vert={/PNDS/.test(v)}
                  aria-pressed={sel[c.nom] === v}
                  disabled={!possible(p, sans(sel, c.nom), c.nom, v)}
                  onclick={() => cocher(sug, c.nom, v)}>{v}</button
                >
              {/each}
            </div>
          </div>
        {/each}
        {#if schema}
          <p class="apercu">{schema.texte}</p>
          <p class="meta">
            <span class="badge" class:pnds={estPnds(schema)}>{type(schema)}</span>
            <span class:av={!schema.valide}>{schema.valide ? '✓ vérifié' : 'à vérifier'}</span>
          </p>
        {:else}
          <p class="apercu discret">
            Choisissez : {p.criteres.filter((c) => !sel[c.nom]).map((c) => c.nom.toLowerCase()).join(', ')}.
          </p>
        {/if}
        <button type="button" class="utiliser" disabled={!schema} onclick={() => schema && onchoix(schema)}>Utiliser ce schéma</button>
      </div>
    {:else}
      <button type="button" class="ligne" onclick={() => (actif = i)}>
        <strong>{p.nom}</strong>
        <span class="discret">{court(p.pathologie)} · {p.schemas.length} schéma{p.schemas.length > 1 ? 's' : ''}</span>
      </button>
    {/if}
  {/each}
  <button type="button" class="ligne libre" onclick={onfermer}>Garder « {requete.trim()} » comme texte libre</button>
</div>

<style>
  .sugg {
    margin-top: 6px;
    padding: 6px 0 4px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--card);
    box-shadow: 0 6px 14px rgb(32 33 36 / 0.12);
    text-align: left;
  }
  .titre {
    margin: 6px 16px 6px;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .carte {
    display: grid;
    gap: 10px;
    margin: 0 8px 4px;
    padding: 12px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 7%, var(--card));
  }
  .tete {
    display: grid;
  }
  .tete strong {
    font-size: 1.05rem;
  }
  .discret {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .critere {
    display: grid;
    gap: 6px;
  }
  .nom {
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 600;
  }
  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .puce {
    min-height: 40px;
    padding: 6px 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    color: var(--fg);
    font-size: 0.92rem;
    cursor: pointer;
  }
  .puce:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .puce.on {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-texte);
    font-weight: 600;
  }
  .puce.on.vert {
    border-color: var(--pnds);
    background: var(--pnds);
    color: var(--card);
  }
  .puce:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .apercu {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.45;
  }
  .meta {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: -4px 0 0;
    color: var(--muted);
    font-size: 0.82rem;
  }
  .badge {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--chip);
    color: var(--fg);
    font-weight: 600;
  }
  .badge.pnds {
    background: var(--pnds);
    color: var(--card);
  }
  .av {
    color: var(--attention);
    font-weight: 600;
  }
  .utiliser {
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: var(--accent-texte);
    font-weight: 600;
    cursor: pointer;
  }
  .utiliser:disabled {
    background: var(--chip);
    color: var(--muted);
    cursor: default;
  }
  .ligne {
    display: flex;
    flex-wrap: wrap;
    gap: 0 8px;
    align-items: baseline;
    width: 100%;
    min-height: 44px;
    padding: 8px 16px;
    border: 0;
    background: none;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
  }
  .ligne:hover {
    background: color-mix(in srgb, var(--accent) 5%, var(--card));
  }
  .libre {
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.9rem;
  }
</style>

<script lang="ts">
  /**
   * Onglet « Schémas » : une tuile par maladie ; toucher une tuile ouvre ses
   * schémas (recommandations/PNDS puis essais). La recherche parcourt tout.
   * Toucher un schéma remplit le champ de texte.
   */
  import { estEssai, estPnds, rang, SCHEMAS, type Schema } from '../lib/schemas';
  import Tuiles from './Tuiles.svelte';

  let { onchoix, pathologie = $bindable(null) }: { onchoix: (s: Schema) => void; pathologie?: string | null } = $props();
  let recherche = $state('');

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const trouves = $derived(
    recherche.trim()
      ? SCHEMAS.filter((s) => norm(`${s.pathologie} ${s.nom} ${s.statut} ${s.source.document}`).includes(norm(recherche.trim()))).sort(
          (a, b) => rang(a) - rang(b),
        )
      : [],
  );
  const groupes = $derived.by(() => {
    if (!pathologie) return [];
    const liste = SCHEMAS.filter((s) => s.pathologie === pathologie);
    return [
      // Les PNDS toujours en tête de liste.
      { titre: 'PNDS (HAS)', schemas: liste.filter(estPnds), pnds: true },
      { titre: 'Recommandations', schemas: liste.filter((s) => !estEssai(s) && !estPnds(s)) },
      { titre: 'Essais cliniques', schemas: liste.filter(estEssai) },
    ].filter((g) => g.schemas.length);
  });
</script>

{#snippet carte(s: Schema, avecMaladie: boolean)}
  <div class="card" class:pnds={estPnds(s)}>
    <button type="button" class="t" onclick={() => onchoix(s)}
      >{#if estPnds(s)}<span class="badge">PNDS</span>{/if}{s.nom}</button
    >
    <span class="m">
      {#if avecMaladie}<span>{s.pathologie}</span>{/if}
      <span class:av={!s.valide}>{s.valide ? '✓ vérifié' : 'à vérifier'}</span>
      <span>{s.statut.split(' — ')[0]}</span>
    </span>
    <a class="src" href={s.source.url} target="_blank" rel="noopener"
      >Source : {s.source.document}{s.source.page ? `, ${s.source.page}` : ''} ({s.source.annee})</a
    >
  </div>
{/snippet}

<div class="schemas">
  <label class="visuellement-cache" for="recherche">Rechercher un schéma</label>
  <input id="recherche" type="search" placeholder="Rechercher (Horton, lupus, ADVOCATE…)" bind:value={recherche} autocomplete="off" />

  {#if recherche.trim()}
    <p class="bar">{trouves.length} schéma{trouves.length > 1 ? 's' : ''} trouvé{trouves.length > 1 ? 's' : ''}</p>
    <div class="liste">
      {#each trouves as s}{@render carte(s, true)}{:else}<p class="vide">Aucun schéma ne correspond.</p>{/each}
    </div>
  {:else if pathologie}
    <button type="button" class="retour" onclick={() => (pathologie = null)}>← Toutes les maladies</button>
    <h2 class="maladie">{pathologie}</h2>
    {#each groupes as g}
      <h3 class:pnds={g.pnds}>{g.titre} <span class="n">{g.schemas.length}</span></h3>
      <div class="liste">{#each g.schemas as s}{@render carte(s, false)}{/each}</div>
    {/each}
  {:else}
    <Tuiles onchoix={(p) => (pathologie = p)} />
  {/if}
</div>

<style>
  .schemas {
    padding-top: 14px;
  }
  input[type='search'] {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    color: var(--fg);
  }
  input[type='search']:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .n {
    color: var(--accent);
    font-size: 0.82rem;
    font-weight: 500;
  }
  .retour {
    margin-top: 12px;
    padding: 6px 0;
    border: 0;
    background: none;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }
  .maladie {
    margin: 6px 0 0;
    color: var(--fg);
    font-size: 1.2rem;
    text-transform: none;
    letter-spacing: 0;
  }
  h3 {
    margin: 18px 0 0;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  /* Schémas du PNDS mis en avant en vert. */
  .card.pnds {
    margin: 6px 0;
    padding: 12px 12px 12px 14px;
    border: 0;
    border-left: 4px solid var(--pnds);
    border-radius: 8px;
    background: var(--pnds-fond);
  }
  h3.pnds {
    color: var(--pnds);
  }
  .badge {
    display: inline-block;
    margin-right: 6px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--pnds);
    color: var(--card);
    font-size: 0.72rem;
    font-weight: 700;
    vertical-align: 2px;
  }
  .bar {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 10px 0 0;
  }
  /* Grand écran : schémas sur deux colonnes. */
  @media (min-width: 900px) {
    .liste {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 24px;
      align-items: start;
    }
    .liste .vide {
      grid-column: 1 / -1;
    }
  }
  .card {
    position: relative;
    display: grid;
    row-gap: 2px;
    padding: 14px 0;
    border-bottom: 1px solid var(--line);
  }
  .t {
    border: 0;
    background: none;
    padding: 0;
    text-align: left;
    font-weight: 600;
    color: var(--fg);
    cursor: pointer;
  }
  .t::after {
    content: '';
    position: absolute;
    inset: 0;
  }
  .card:hover .t {
    color: var(--accent);
  }
  .m {
    color: var(--muted);
    font-size: 0.86rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0 6px;
  }
  .m > * + *::before {
    content: '·';
    display: inline-block;
    margin-right: 6px;
    color: var(--muted);
  }
  .src {
    position: relative;
    z-index: 1;
    justify-self: start;
    color: var(--accent);
    font-size: 0.8rem;
    line-height: 1.35;
    text-decoration: none;
  }
  .src:hover {
    text-decoration: underline;
  }
  .av {
    color: var(--attention);
    font-weight: 600;
  }
  .vide {
    color: var(--muted);
    padding: 24px 0;
  }
</style>

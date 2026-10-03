<script lang="ts">
  /**
   * Onglet « Schémas » (style PNDSthèque) : filtres par pathologie en pastilles,
   * recherche, liste à lignes fines. Toucher un schéma remplit le champ de texte.
   */
  import { PATHOLOGIES, SCHEMAS, type Schema } from '../lib/schemas';

  let { onchoix }: { onchoix: (s: Schema) => void } = $props();
  let pathologie = $state('Toutes');
  let recherche = $state('');

  /** Libellé court pour les pastilles : « Lupus : néphropathie… » → « Lupus ». */
  const court = (p: string) => p.split(/[(:]/)[0]!.replace('Anémie hémolytique auto-immune', 'AHAI').replace('Purpura thrombopénique immunologique', 'PTI').trim();
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const liste = $derived(
    SCHEMAS.filter(
      (s) =>
        (pathologie === 'Toutes' || s.pathologie === pathologie) &&
        (!recherche.trim() || norm(`${s.pathologie} ${s.nom} ${s.statut}`).includes(norm(recherche.trim()))),
    ),
  );
</script>

<div class="schemas">
  <label class="visuellement-cache" for="recherche">Rechercher un schéma</label>
  <input id="recherche" type="search" placeholder="Rechercher (Horton, lupus, PTI…)" bind:value={recherche} autocomplete="off" />

  <div class="cats" role="group" aria-label="Pathologie">
    {#each ['Toutes', ...PATHOLOGIES] as p}
      <button type="button" aria-pressed={pathologie === p} title={p} onclick={() => (pathologie = p)}>{court(p)}</button>
    {/each}
  </div>

  <p class="bar">{liste.length} schéma{liste.length > 1 ? 's' : ''} · touchez un schéma pour le reprendre</p>

  <div class="grid">
    {#each liste as s}
      <div class="card">
        <button type="button" class="t" onclick={() => onchoix(s)}>{s.nom}</button>
        <span class="m">
          <span>{s.pathologie}</span>
          <span class:av={!s.valide}>{s.valide ? '✓ vérifié' : 'à vérifier'}</span>
          <span>{s.statut.split(' — ')[0]}</span>
          <a href={s.source.url} target="_blank" rel="noopener">source{s.source.page ? `, ${s.source.page}` : ''}</a>
        </span>
      </div>
    {:else}
      <p class="vide">Aucun schéma ne correspond.</p>
    {/each}
  </div>
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
  .cats {
    display: flex;
    gap: 6px;
    margin: 14px -16px 6px;
    padding: 0 16px 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .cats::-webkit-scrollbar {
    display: none;
  }
  .cats button {
    flex: none;
    white-space: nowrap;
    border: 0;
    background: none;
    color: var(--muted);
    padding: 5px 12px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.92rem;
  }
  .cats button:hover {
    color: var(--fg);
  }
  .cats button[aria-pressed='true'] {
    color: var(--accent);
    background: var(--c1s);
    font-weight: 600;
  }
  .bar {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 6px 0 0;
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
  .m a {
    position: relative;
    z-index: 1;
    color: var(--accent);
    text-decoration: none;
  }
  .m a:hover {
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

<script lang="ts">
  /** Une tuile colorée par maladie (onglets « Schémas » et « Comparer »). */
  import { estPnds, PATHOLOGIES, schemasDe } from '../lib/schemas';

  let { onchoix, action = '' }: { onchoix: (p: string) => void; action?: string } = $props();
</script>

<div class="tuiles">
  {#each PATHOLOGIES as p, i}
    {@const n = schemasDe(p).length}
    {@const pnds = schemasDe(p).filter(estPnds).length}
    <button type="button" class="tuile" style={`--t: var(--s${(i % 8) + 1})`} onclick={() => onchoix(p)}>
      <span class="nom">{p}</span>
      <span class="n">{n} schéma{n > 1 ? 's' : ''}{#if pnds}<span class="pn"> · {pnds} PNDS</span>{/if}{#if action}<span class="action"> · {action}</span>{/if}</span>
    </button>
  {/each}
</div>

<style>
  .tuiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin-top: 16px;
  }
  .tuile {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
    min-height: 92px;
    padding: 12px 14px;
    border: 1px solid color-mix(in srgb, var(--t) 30%, var(--line));
    border-top: 4px solid var(--t);
    border-radius: 12px;
    background: color-mix(in srgb, var(--t) 9%, var(--card));
    color: var(--fg);
    text-align: left;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .tuile:hover,
  .tuile:focus-visible {
    transform: translateY(-2px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--t) 25%, transparent);
  }
  .nom {
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: break-word;
    -webkit-hyphens: auto;
    hyphens: auto;
  }
  .n {
    color: var(--accent);
    font-size: 0.82rem;
    font-weight: 500;
  }
  .pn {
    color: var(--pnds);
    font-weight: 700;
  }
  .action {
    color: var(--muted);
  }
</style>

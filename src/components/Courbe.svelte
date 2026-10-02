<script lang="ts">
  /**
   * Courbe de décroissance (dose par jour, en escalier) + dose cumulée.
   * Survol / toucher : la date et la dose du jour s'affichent.
   */
  import { ajouterJours, dateFr } from '../lib/dates';
  import { nombreFr } from '../lib/parser/normalize';
  import { doseCumulee, doseDuJour, dureeTotale } from '../lib/schedule';
  import type { Palier } from '../lib/types';

  let { paliers, debut }: { paliers: Palier[]; debut: string } = $props();

  // Le dessin suit la largeur réelle : le texte garde sa taille sur téléphone.
  let largeur = $state(640);
  const L = $derived(Math.max(280, largeur));
  const H = $derived(Math.round(Math.min(260, Math.max(180, L * 0.38))));
  const M = { g: 40, d: 12, h: 12, b: 28 };

  /** Dose de chaque jour ; un palier « à poursuivre » est montré sur 14 jours. */
  const jours = $derived.by(() => {
    const sortie: number[] = [];
    for (const p of paliers) {
      const n = p.jours ?? (p.dose === 0 ? 1 : 14);
      for (let k = 0; k < n; k++) sortie.push(doseDuJour(p.dose, k));
    }
    return sortie;
  });
  const enCours = $derived(paliers.length > 0 && paliers[paliers.length - 1]!.jours === null && paliers[paliers.length - 1]!.dose !== 0);
  const max = $derived(Math.max(5, ...jours));
  const echelleMax = $derived(Math.ceil(max / 10) * 10);
  const x = (j: number) => M.g + (j / Math.max(jours.length, 1)) * (L - M.g - M.d);
  const y = (d: number) => M.h + (1 - d / echelleMax) * (H - M.h - M.b);

  // Moyenne des « un jour sur deux » pour une courbe lisible (pas de dents de scie).
  const lissee = $derived.by(() => {
    const sortie: number[] = [];
    for (const p of paliers) {
      const n = p.jours ?? (p.dose === 0 ? 1 : 14);
      const v = typeof p.dose === 'number' ? p.dose : (p.dose[0] + p.dose[1]) / 2;
      for (let k = 0; k < n; k++) sortie.push(v);
    }
    return sortie;
  });

  const chemin = $derived.by(() => {
    if (!lissee.length) return '';
    let d = `M${x(0)},${y(lissee[0]!)}`;
    lissee.forEach((v, j) => {
      if (j > 0 && v !== lissee[j - 1]) d += `H${x(j)}V${y(v)}`;
    });
    return d + `H${x(lissee.length)}`;
  });

  const graduations = $derived(Array.from({ length: 5 }, (_, k) => (echelleMax / 4) * k));
  const cumul = $derived(doseCumulee(paliers));
  const duree = $derived(dureeTotale(paliers));

  let survol = $state<number | null>(null);
  function bouger(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    const j = Math.floor(((px - M.g) / (L - M.g - M.d)) * jours.length);
    survol = j >= 0 && j < jours.length ? j : null;
  }
</script>

{#if jours.length}
  <div class="chiffres">
    <div>
      <span class="valeur">{nombreFr(Math.round(cumul))} mg</span>
      <span class="libelle">dose cumulée{enCours ? ` sur ${duree} jours (avant le dernier palier)` : ''}</span>
    </div>
    <div>
      <span class="valeur">{duree} j</span>
      <span class="libelle">{enCours ? 'avant « à poursuivre »' : 'durée totale'}</span>
    </div>
  </div>

  <figure bind:clientWidth={largeur}>
    <svg
      viewBox={`0 0 ${L} ${H}`}
      role="img"
      aria-label="Courbe de la dose quotidienne de prednisone au fil du temps"
      onpointermove={bouger}
      onpointerleave={() => (survol = null)}
    >
      {#each graduations as g}
        <line x1={M.g} x2={L - M.d} y1={y(g)} y2={y(g)} class="grille" />
        <text x={M.g - 6} y={y(g) + 4} text-anchor="end" class="axe">{nombreFr(g)}</text>
      {/each}
      <text x={M.g} y={H - 8} class="axe">{dateFr(debut)}</text>
      <text x={L - M.d} y={H - 8} text-anchor="end" class="axe">
        {enCours ? 'à poursuivre →' : dateFr(ajouterJours(debut, jours.length - 1))}
      </text>
      <path d={chemin} class="ligne" />
      {#if survol !== null}
        <line x1={x(survol + 0.5)} x2={x(survol + 0.5)} y1={M.h} y2={H - M.b} class="repere" />
        <circle cx={x(survol + 0.5)} cy={y(jours[survol]!)} r="5" class="point" />
      {/if}
    </svg>
    <figcaption class="discret">
      {#if survol !== null}
        <strong>{dateFr(ajouterJours(debut, survol))}</strong> : {jours[survol] === 0 ? 'pas de prise' : `${nombreFr(jours[survol]!)} mg`}
      {:else}
        Dose quotidienne (mg/j). Survolez ou touchez la courbe pour voir un jour précis.
      {/if}
    </figcaption>
  </figure>
{/if}

<style>
  .chiffres {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .chiffres div {
    display: grid;
    padding: 0.6rem 0.8rem;
    background: var(--fond);
    border: 1px solid var(--bord);
    border-radius: var(--rayon);
  }
  .valeur {
    font-size: 1.35rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .libelle {
    font-size: 0.8rem;
    color: var(--texte-3);
  }
  figure {
    margin: 0;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
  }
  .grille {
    stroke: var(--bord);
    stroke-width: 1;
  }
  .axe {
    fill: var(--texte-3);
    font-size: 12px;
  }
  .ligne {
    fill: none;
    stroke: var(--courbe);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }
  .repere {
    stroke: var(--texte-3);
    stroke-dasharray: 3 3;
  }
  .point {
    fill: var(--courbe);
    stroke: var(--surface);
    stroke-width: 2;
  }
  figcaption {
    min-height: 1.5em;
    margin-top: 0.3rem;
  }
</style>

<script lang="ts">
  /**
   * Onglet « Comparer » : on coche des schémas (d'une ou de plusieurs maladies,
   * sans limite, et le schéma écrit dans « Écrire ») ; leurs courbes sont
   * superposées sur un même graphique, avec un tableau de repères dessous.
   */
  import { doseLe, reperes, semaine } from '../lib/compare';
  import { analyser } from '../lib/parser';
  import { doseMoyenne } from '../lib/schedule';
  import { nombreFr } from '../lib/parser/normalize';
  import { court, estPnds, PATHOLOGIES, SCHEMAS, schemasDe, type Schema } from '../lib/schemas';
  import { ecartsPnds } from '../lib/objectifs';
  import Tuiles from './Tuiles.svelte';
  import type { Options, Palier } from '../lib/types';

  let {
    texteSaisi,
    options = {},
    maladies = $bindable([]),
    choisis = $bindable([]),
    onutiliser,
  }: {
    texteSaisi: string;
    /** Réglages de l'onglet « Écrire » (durée d'un mois, date de début pour les échéances). */
    options?: Partial<Options>;
    /** Maladies affichées (vide : on montre les tuiles). Gardées par App quand on change d'onglet. */
    maladies?: string[];
    /** Schémas cochés. Clé = indice dans SCHEMAS, -1 = schéma de l'onglet « Écrire ». */
    choisis?: { cle: number; teinte: number }[];
    onutiliser: (s: Schema | null, texte: string) => void;
  } = $props();

  const NB_COULEURS = 8;
  const TIRETS = ['', '7 4', '2 3', '10 3 2 3']; // au-delà de 8 schémas : mêmes couleurs, traits différents

  const saisie = $derived(analyser(texteSaisi, options));
  const saisieOk = $derived(texteSaisi.trim() !== '' && saisie.ok && saisie.paliers.length > 0);
  const autres = $derived(PATHOLOGIES.filter((p) => !maladies.includes(p)));

  const coche = (cle: number) => choisis.some((c) => c.cle === cle);
  const teinteDe = (cle: number) => choisis.find((c) => c.cle === cle)?.teinte ?? 0;
  /** La couleur suit le schéma : première teinte libre ; les autres ne changent pas. */
  function cocher(liste: { cle: number; teinte: number }[], cle: number) {
    let teinte = 0;
    while (liste.some((c) => c.teinte === teinte)) teinte++;
    liste.push({ cle, teinte });
  }
  function basculer(cle: number) {
    if (coche(cle)) choisis = choisis.filter((c) => c.cle !== cle);
    else {
      const l = [...choisis];
      cocher(l, cle);
      choisis = l;
    }
  }
  /** Tuile : les schémas du PNDS cochés d'office ; les autres (essais, recommandations) s'ajoutent en les cochant. */
  function ouvrir(p: string) {
    const l: { cle: number; teinte: number }[] = [];
    for (const s of schemasDe(p).filter(estPnds)) cocher(l, SCHEMAS.indexOf(s));
    maladies = [p];
    choisis = l;
  }
  function ajouter(p: string) {
    if (!p) return;
    const l = [...choisis];
    for (const s of schemasDe(p).filter(estPnds)) if (!coche(SCHEMAS.indexOf(s))) cocher(l, SCHEMAS.indexOf(s));
    maladies = [...maladies, p];
    choisis = l;
  }
  function fermer() {
    maladies = [];
    choisis = [];
  }
  const style = (teinte: number) => ({
    couleur: `var(--s${(teinte % NB_COULEURS) + 1})`,
    tirets: TIRETS[Math.floor(teinte / NB_COULEURS) % TIRETS.length]!,
  });

  interface Serie {
    cle: number;
    nom: string;
    sous: string;
    couleur: string;
    tirets: string;
    paliers: Palier[];
    schema: Schema | null;
    texte: string;
  }
  const series = $derived(
    choisis
      .map(({ cle, teinte }): Serie | null => {
        const schema = cle >= 0 ? SCHEMAS[cle]! : null;
        const texte = schema ? schema.texte : texteSaisi;
        const r = schema ? analyser(texte) : saisie;
        if (!r.ok || !r.paliers.length) return null;
        return {
          cle,
          nom: schema ? schema.nom : 'Mon schéma (onglet Écrire)',
          sous: schema ? court(schema.pathologie) : '',
          ...style(teinte),
          paliers: r.paliers,
          schema,
          texte,
        };
      })
      .filter((s): s is Serie => s !== null),
  );
  const tableau = $derived(series.map((s) => ({ ...s, r: reperes(s.paliers) })));
  /** Le schéma écrit dépasse-t-il un repère daté du PNDS des maladies affichées ? */
  const ecarts = $derived(saisieOk ? ecartsPnds(saisie.paliers, maladies, options.debut) : []);

  // Graphique : semaines en abscisse, mg/j en ordonnée.
  let largeur = $state(640);
  const W = $derived(Math.max(280, largeur));
  const H = $derived(Math.round(Math.min(320, Math.max(220, W * 0.5))));
  const M = { g: 40, d: 14, h: 12, b: 30 };
  const nbJours = $derived.by(() => {
    const fin = Math.max(28, ...tableau.map((t) => t.r.arret ?? t.r.duree + 28));
    return Math.ceil(fin / 28) * 28; // multiple de 4 semaines
  });
  const doseMax = $derived(Math.max(5, ...tableau.flatMap((t) => t.paliers.map((p) => doseMoyenne(p.dose)))));
  const echelle = $derived(Math.ceil(doseMax / 10) * 10);
  const x = (j: number) => M.g + (j / nbJours) * (W - M.g - M.d);
  const y = (d: number) => M.h + (1 - d / echelle) * (H - M.h - M.b);
  const pasSemaines = $derived(nbJours / 7 <= 16 ? 2 : nbJours / 7 <= 32 ? 4 : nbJours / 7 <= 64 ? 8 : 13);
  const graduationsX = $derived(Array.from({ length: Math.floor(nbJours / 7 / pasSemaines) + 1 }, (_, k) => k * pasSemaines));
  const graduationsY = $derived(Array.from({ length: 5 }, (_, k) => (echelle / 4) * k));

  /** Courbe en escalier ; un schéma « à poursuivre » est prolongé jusqu'au bord. */
  function chemin(paliers: Palier[]): string {
    let j = 0;
    let d = '';
    for (const p of paliers) {
      const v = doseMoyenne(p.dose);
      d += d ? `V${y(v)}` : `M${x(0)},${y(v)}`;
      j = p.jours === null ? nbJours : p.dose === 0 ? j : j + p.jours;
      if (p.dose === 0) break;
      d += `H${x(Math.min(j, nbJours))}`;
    }
    return d;
  }

  let survol = $state<number | null>(null);
  function bouger(e: PointerEvent) {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const j = Math.floor(((px - M.g) / (W - M.g - M.d)) * nbJours);
    survol = j >= 0 && j < nbJours ? j : null;
  }
  const mg = (v: number) => `${nombreFr(v)} mg`;
</script>

{#snippet trait(teinte: number, l: number)}
  {@const st = style(teinte)}
  <svg width={l + 2} height="10" aria-hidden="true"
    ><line x1="1" x2={l + 1} y1="5" y2="5" stroke={st.couleur} stroke-width="3" stroke-dasharray={st.tirets} stroke-linecap="round" /></svg
  >
{/snippet}

<div class="comparer">
  {#if !maladies.length}
    <p class="intro">Touchez une maladie : ses schémas du PNDS s'affichent sur un même graphique ; cochez les schémas d'essais ou de recommandations pour les ajouter.</p>
    <Tuiles onchoix={ouvrir} action="comparer" />
  {:else}
    <button type="button" class="retour" onclick={fermer}>← Toutes les maladies</button>
    <h2 class="titre">{maladies.map(court).join(' + ')}</h2>
    {#if ecarts.length}
      <p class="ecart" role="note">
        ⚠ Votre schéma (onglet Écrire) dépasse {ecarts.length > 1 ? 'des repères' : 'un repère'} du PNDS :
        {#each ecarts as e, k}{k ? ' ; ' : ''}{e.repere === 0 ? `encore ${mg(e.dose)} à M${e.mois} (sevrage attendu)` : `${mg(e.dose)} à M${e.mois} (repère ≤ ${mg(e.repere)}/j)`}{/each}
        — <a href={ecarts[0]!.source.url} target="_blank" rel="noopener">{ecarts[0]!.source.document}, {ecarts[0]!.source.page}</a>.
      </p>
    {/if}

    <section class="carte">
      {#if !series.length}
        <p class="vide">
          {maladies.some((m) => schemasDe(m).some(estPnds)) ? 'Cochez au moins un schéma ci-dessous pour afficher sa courbe.' : 'Pas de schéma du PNDS pour cette maladie : cochez ci-dessous les schémas à afficher.'}
        </p>
      {:else}
      <figure bind:clientWidth={largeur}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Courbes superposées de la dose quotidienne de prednisone"
          onpointermove={bouger}
          onpointerleave={() => (survol = null)}
        >
          {#each graduationsY as g}
            <line x1={M.g} x2={W - M.d} y1={y(g)} y2={y(g)} class="grille" />
            <text x={M.g - 6} y={y(g) + 4} text-anchor="end" class="axe">{nombreFr(g)}</text>
          {/each}
          {#each graduationsX as k}
            <text x={x(k * 7)} y={H - 10} text-anchor="middle" class="axe">S{k}</text>
          {/each}
          {#each series as s}
            <path d={chemin(s.paliers)} class="ligne-serie" stroke={s.couleur} stroke-dasharray={s.tirets} />
          {/each}

          {#if survol !== null}
            <line x1={x(survol + 0.5)} x2={x(survol + 0.5)} y1={M.h} y2={H - M.b} class="repere" />
            {#each series as s}
              {@const r = reperes(s.paliers)}
              {#if r.arret === null || survol < r.arret}
                <circle cx={x(survol + 0.5)} cy={y(doseLe(s.paliers, survol))} r="4.5" fill={s.couleur} class="point" />
              {/if}
            {/each}
          {/if}
        </svg>
        <figcaption>
          {#if survol !== null}
            <strong>{semaine(survol)}, jour {survol + 1}</strong>
            <ul class="valeurs">
              {#each series as s}
                <li>
                  <svg width="14" height="8" aria-hidden="true"
                    ><line x1="1" x2="13" y1="4" y2="4" stroke={s.couleur} stroke-width="3" stroke-dasharray={s.tirets} /></svg
                  >
                  {doseLe(s.paliers, survol) === 0 ? 'arrêt' : mg(doseLe(s.paliers, survol))}
                  <span class="discret">— {s.nom}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <span class="discret">Dose quotidienne (mg/j) par semaine. Survolez ou touchez le graphique pour comparer un jour précis.</span>
          {/if}
        </figcaption>
      </figure>

      {/if}

      <div class="choix">
        <div class="entete">
          <span>{choisis.length} schéma{choisis.length > 1 ? 's' : ''} affiché{choisis.length > 1 ? 's' : ''}</span>
          {#if choisis.length}<button type="button" class="vider" onclick={() => (choisis = [])}>Tout décocher</button>{/if}
        </div>
        {#if saisieOk}
          <label class="ligne saisie">
            <input type="checkbox" checked={coche(-1)} onchange={() => basculer(-1)} />
            {#if coche(-1)}{@render trait(teinteDe(-1), 24)}{/if}
            <span>Mon schéma (onglet Écrire)</span>
          </label>
        {/if}
        {#each maladies as m}
          {#if maladies.length > 1}<h3>{court(m)}</h3>{/if}
          {#each schemasDe(m) as sc, k}
            {#if k > 0 && estPnds(schemasDe(m)[k - 1]!) && !estPnds(sc)}<p class="separe">Essais et recommandations : cochez pour ajouter</p>{/if}
            {@const i = SCHEMAS.indexOf(sc)}
            <label class="ligne" class:pnds={estPnds(sc)}>
              <input type="checkbox" checked={coche(i)} onchange={() => basculer(i)} />
              {#if coche(i)}{@render trait(teinteDe(i), 24)}{:else}<span class="sans-trait"></span>{/if}
              <span>{#if estPnds(sc)}<span class="badge">PNDS</span>{/if}{sc.nom}</span>
            </label>
          {/each}
        {/each}
        {#if autres.length}
          <label class="ajout"
            >+ Ajouter une autre maladie
            <select onchange={(e) => { ajouter(e.currentTarget.value); e.currentTarget.value = ''; }}>
              <option value="">choisir…</option>
              {#each autres as p}<option value={p}>{p}</option>{/each}
            </select></label
          >
        {/if}
      </div>

      {#if series.length}
      <div class="defile">
        <table>
          <thead>
            <tr>
              <th>Schéma</th>
              <th>Début</th>
              <th>≤ 7,5 mg</th>
              <th>≤ 5 mg</th>
              <th>Arrêt</th>
              <th>Dose cumulée</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each tableau as t}
              <tr>
                <td>
                  <svg width="14" height="8" aria-hidden="true"
                    ><line x1="1" x2="13" y1="4" y2="4" stroke={t.couleur} stroke-width="3" stroke-dasharray={t.tirets} /></svg
                  >
                  {t.nom}
                </td>
                <td>{mg(t.r.initiale)}</td>
                <td>{t.r.sous75 === null ? '—' : semaine(t.r.sous75)}</td>
                <td>{t.r.sous5 === null ? '—' : semaine(t.r.sous5)}</td>
                <td>{t.r.arret === null ? 'à poursuivre' : semaine(t.r.arret)}</td>
                <td>
                  {nombreFr(Math.round(t.r.cumul))} mg
                  {#if t.r.arret === null}<span class="discret">en {Math.round(t.r.duree / 7)} sem</span>{/if}
                </td>
                <td><button type="button" class="utiliser" onclick={() => onutiliser(t.schema, t.texte)}>Utiliser</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="discret note">
        Arrêt : semaine où la dose passe à 0. Dose cumulée : jusqu'à l'arrêt, ou jusqu'au début de la dernière dose « à poursuivre ».
      </p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .comparer {
    padding-top: 14px;
  }
  .ecart {
    margin: 0 0 10px;
    color: var(--attention);
    font-size: 0.85rem;
  }
  .ecart a {
    color: inherit;
  }
  .intro {
    margin: 8px 0 10px;
    color: var(--muted);
  }
  /* Grand écran : graphique à gauche, liste à cocher à droite, tableau dessous. */
  @media (min-width: 1100px) {
    .carte {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 0 24px;
      align-items: start;
    }
    .carte > figure,
    .carte > .vide {
      grid-column: 1;
      grid-row: 1;
      position: sticky;
      top: 70px;
    }
    .carte > .choix {
      grid-column: 2;
      grid-row: 1;
      margin-top: 0;
      max-height: 72vh;
      overflow-y: auto;
    }
    .carte > .defile,
    .carte > .note {
      grid-column: 1 / -1;
    }
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
  .titre {
    margin: 4px 0 10px;
    color: var(--fg);
    font-size: 1.2rem;
    text-transform: none;
    letter-spacing: 0;
  }
  .vide {
    margin: 0 0 12px;
    color: var(--muted);
  }
  .entete {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 6px 4px;
    color: var(--muted);
    font-size: 0.85rem;
  }
  h3 {
    margin: 12px 6px 2px;
    color: var(--muted);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .separe {
    margin: 12px 6px 2px;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 600;
  }
  .sans-trait {
    flex: none;
    width: 26px;
  }
  .ligne svg {
    flex: none;
    margin-top: 6px;
  }
  .ajout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 12px 6px;
    color: var(--accent);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .ajout select {
    width: 100%;
    min-width: 0;
    min-height: 34px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    color: var(--fg);
  }
  .choix {
    display: grid;
    gap: 2px;
    margin-top: 12px;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .ligne {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 6px;
    border-radius: 6px;
    cursor: pointer;
    line-height: 1.35;
  }
  .ligne input {
    flex: none;
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: var(--accent);
  }
  .ligne.pnds {
    background: var(--pnds-fond);
    border-left: 4px solid var(--pnds);
  }
  .saisie {
    font-weight: 600;
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
  h2 {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .vider {
    margin-left: auto;
    border: 0;
    background: none;
    color: var(--accent);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
  }
  figure {
    margin: 0;
  }
  svg[role='img'] {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
  }
  .grille {
    stroke: var(--line);
    stroke-width: 1;
  }
  .axe {
    fill: var(--muted);
    font-size: 12px;
  }
  .ligne-serie {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .repere {
    stroke: var(--muted);
    stroke-dasharray: 3 3;
  }
  .point {
    stroke: var(--card);
    stroke-width: 2;
  }
  figcaption {
    min-height: 1.5em;
    margin-top: 6px;
    font-size: 0.88rem;
  }
  .valeurs {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 2px;
  }
  .defile {
    margin-top: 12px;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.86rem;
  }
  th,
  td {
    padding: 8px 6px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
    font-variant-numeric: tabular-nums;
  }
  th {
    color: var(--muted);
    font-weight: 600;
    white-space: nowrap;
  }
  td:first-child {
    min-width: 180px;
  }
  td:not(:first-child) {
    white-space: nowrap;
  }
  .utiliser {
    border: 1px solid var(--accent);
    border-radius: 999px;
    background: var(--card);
    color: var(--accent);
    padding: 4px 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .note {
    margin: 8px 0 0;
    font-size: 0.8rem;
  }
</style>

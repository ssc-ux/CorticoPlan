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
  import { PATHOLOGIES, SCHEMAS, type Schema } from '../lib/schemas';
  import type { Palier } from '../lib/types';

  let {
    texteSaisi,
    maladie = $bindable(null),
    choisis = $bindable([]),
    onutiliser,
  }: {
    texteSaisi: string;
    maladie?: string | null;
    /** Schémas cochés (gardés par App quand on change d'onglet). Clé -1 = onglet « Écrire ». */
    choisis?: { cle: number; teinte: number }[];
    onutiliser: (s: Schema | null, texte: string) => void;
  } = $props();

  const NB_COULEURS = 8;
  const TIRETS = ['', '7 4', '2 3', '10 3 2 3']; // au-delà de 8 schémas : même couleurs, traits différents

  let ouverte = $state<string | null>(maladie ?? PATHOLOGIES[0] ?? null);
  $effect(() => {
    maladie = ouverte;
  });

  const estEssai = (s: Schema) => s.statut.startsWith("issu d'un essai");
  const estPnds = (s: Schema) => !estEssai(s) && /PNDS/.test(s.statut + s.source.document);
  const rang = (s: Schema) => (estPnds(s) ? 0 : estEssai(s) ? 2 : 1);
  const court = (p: string) =>
    p
      .replace(/^Artérite à cellules géantes.*/, 'Horton')
      .split(/[(:]/)[0]!
      .replace('Anémie hémolytique auto-immune', 'AHAI')
      .replace('Purpura thrombopénique immunologique', 'PTI')
      .replace(/^Granulomatose éosinophilique.*/, 'GEPA')
      .trim();

  const saisie = $derived(analyser(texteSaisi));
  const saisieOk = $derived(texteSaisi.trim() !== '' && saisie.ok && saisie.paliers.length > 0);
  const liste = $derived(
    SCHEMAS.map((s, i) => ({ s, i }))
      .filter(({ s }) => s.pathologie === ouverte)
      .sort((a, b) => rang(a.s) - rang(b.s)),
  );

  const coche = (cle: number) => choisis.some((c) => c.cle === cle);
  function basculer(cle: number) {
    if (coche(cle)) {
      choisis = choisis.filter((c) => c.cle !== cle);
      return;
    }
    // La couleur suit le schéma : on prend la première teinte libre, les autres ne changent pas.
    let teinte = 0;
    while (choisis.some((c) => c.teinte === teinte)) teinte++;
    choisis = [...choisis, { cle, teinte }];
  }

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
          couleur: `var(--s${(teinte % NB_COULEURS) + 1})`,
          tirets: TIRETS[Math.floor(teinte / NB_COULEURS) % TIRETS.length]!,
          paliers: r.paliers,
          schema,
          texte,
        };
      })
      .filter((s): s is Serie => s !== null),
  );
  const tableau = $derived(series.map((s) => ({ ...s, r: reperes(s.paliers) })));

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

<div class="comparer">
  <p class="intro">Cochez des schémas, d'une ou de plusieurs maladies : leurs courbes se superposent.</p>

  {#if saisieOk}
    <label class="ligne saisie">
      <input type="checkbox" checked={coche(-1)} onchange={() => basculer(-1)} />
      <span>Mon schéma (onglet Écrire)</span>
    </label>
  {/if}

  <div class="cats" role="group" aria-label="Maladie">
    {#each PATHOLOGIES as p}
      {@const n = choisis.filter((c) => c.cle >= 0 && SCHEMAS[c.cle]!.pathologie === p).length}
      <button type="button" aria-pressed={ouverte === p} title={p} onclick={() => (ouverte = p)}
        >{court(p)}{#if n}<span class="nb">{n}</span>{/if}</button
      >
    {/each}
  </div>

  <div class="choix">
    {#each liste as { s, i }}
      <label class="ligne" class:pnds={estPnds(s)}>
        <input type="checkbox" checked={coche(i)} onchange={() => basculer(i)} />
        <span>{#if estPnds(s)}<span class="badge">PNDS</span>{/if}{s.nom}</span>
      </label>
    {/each}
  </div>

  {#if series.length}
    <section class="carte">
      <h2>
        Comparaison <span class="aide">· {series.length} schéma{series.length > 1 ? 's' : ''}</span>
        <button type="button" class="vider" onclick={() => (choisis = [])}>Tout décocher</button>
      </h2>

      <ul class="legende">
        {#each series as s}
          <li>
            <svg width="26" height="10" aria-hidden="true"
              ><line x1="1" x2="25" y1="5" y2="5" stroke={s.couleur} stroke-width="3" stroke-dasharray={s.tirets} stroke-linecap="round" /></svg
            >
            <span class="nom">{s.nom}{#if s.sous}<span class="discret"> · {s.sous}</span>{/if}</span>
            <button type="button" class="retirer" aria-label={`Retirer ${s.nom}`} onclick={() => basculer(s.cle)}>×</button>
          </li>
        {/each}
      </ul>

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
    </section>
  {/if}
</div>

<style>
  .comparer {
    padding-top: 14px;
  }
  .intro {
    margin: 8px 0 10px;
    color: var(--muted);
  }
  .cats {
    display: flex;
    gap: 6px;
    margin: 8px -16px 6px;
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
  }
  .cats button[aria-pressed='true'] {
    color: var(--accent);
    background: var(--c1s);
    font-weight: 600;
  }
  .nb {
    margin-left: 5px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--card);
    font-size: 0.72rem;
    font-weight: 700;
  }
  .choix {
    display: grid;
    gap: 2px;
    max-height: 340px;
    overflow-y: auto;
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
  .aide {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
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
  .legende {
    display: grid;
    gap: 4px;
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
    font-size: 0.88rem;
  }
  .legende li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .legende svg {
    flex: none;
  }
  .legende .nom {
    flex: 1;
  }
  .retirer {
    flex: none;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--muted);
    font-size: 1.2rem;
    cursor: pointer;
  }
  .retirer:hover {
    background: var(--c1s);
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

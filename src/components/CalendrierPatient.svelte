<script lang="ts">
  /**
   * Calendrier patient imprimable (1 page A4) : une case à cocher par jour.
   * N'apparaît qu'à l'impression. Aucune donnée n'est enregistrée : le nom
   * s'écrit à la main sur le papier. Les jours de changement de dose sont
   * surlignés ; le QR code ouvre la page patient (rappels dans l'agenda).
   */
  import { renderSVG } from 'uqr';
  import { ajouterJours, dateCourte, dateFr, jourSemaine } from '../lib/dates';
  import { nombreFr } from '../lib/parser/normalize';
  import { formatDose } from '../lib/format';
  import { calendrier, doseDuJour } from '../lib/schedule';
  import type { Palier } from '../lib/types';

  let { paliers, debut, ordonnance, lienPatient }: { paliers: Palier[]; debut: string; ordonnance: string; lienPatient: string } =
    $props();

  // Lignes par page A4 : moins sur la première (en-tête, QR code).
  const LIGNES_PAGE1 = 21;
  const LIGNES_PAGE = 26;
  const qr = $derived(renderSVG(lienPatient, { border: 1 }));
  const etapes = $derived(calendrier(paliers, debut));
  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  interface Case {
    date: string;
    dose: number | null; // null = hors traitement
    arret?: boolean;
    /** Premier jour d'une nouvelle dose (surligné). */
    change?: boolean;
  }

  const calcul = $derived.by(() => {
    const parJour: Case[] = [];
    let jour = debut;
    for (const [i, p] of paliers.entries()) {
      if (p.dose === 0) {
        parJour.push({ date: jour, dose: null, arret: true });
        break;
      }
      const n = p.jours ?? 28; // « à poursuivre » : 4 semaines affichées
      for (let k = 0; k < n; k++) {
        parJour.push({ date: jour, dose: doseDuJour(p.dose, k), change: i > 0 && k === 0 });
        jour = ajouterJours(jour, 1);
      }
    }
    // Grille lundi → dimanche.
    const decalage = parJour.length ? jourSemaine(parJour[0]!.date) : 0;
    const cases: (Case | null)[] = [...Array(decalage).fill(null), ...parJour];
    while (cases.length % 7) cases.push(null);
    const semaines: (Case | null)[][] = [];
    for (let k = 0; k < cases.length; k += 7) semaines.push(cases.slice(k, k + 7));
    const pages: (Case | null)[][][] = [semaines.slice(0, LIGNES_PAGE1)];
    for (let k = LIGNES_PAGE1; k < semaines.length; k += LIGNES_PAGE) pages.push(semaines.slice(k, k + LIGNES_PAGE));
    return { pages };
  });
  const enCours = $derived(paliers.length > 0 && paliers[paliers.length - 1]!.jours === null && paliers[paliers.length - 1]!.dose !== 0);
</script>

<section class="impression">
  <div class="entete">
    <div class="titre">
      <h1>Mon traitement par prednisone</h1>
      <p class="consigne">À prendre <strong>le matin</strong>, en une prise. Cochez la case chaque jour après la prise.</p>
      <p class="nom">Nom : ______________________________ &nbsp; Début : {dateFr(debut)}</p>
    </div>
    <figure class="qr">
      {@html qr}
      <figcaption>Scannez : dose du jour et rappel agenda à chaque changement</figcaption>
    </figure>
  </div>
  <p class="etapes">
    {#each etapes as e, i}{#if i}<span class="fleche"> → </span>{/if}<span class="etape"
        ><b>{dateCourte(e.debut)}</b> {e.dose === 0 ? 'arrêt' : formatDose(e.dose).replace('/j', '')}</span
      >{/each}
  </p>
  {#each calcul.pages as page, n}
    <div class="page" class:suite={n > 0}>
      {#if n > 0}<p class="nom">Mon traitement par prednisone — suite ({n + 1}/{calcul.pages.length})</p>{/if}
      <table>
        <thead><tr>{#each JOURS as j}<th>{j}</th>{/each}</tr></thead>
        <tbody>
          {#each page as semaine}
            <tr>
              {#each semaine as c}
                <td class:vide={!c} class:change={c?.change || c?.arret}>
                  {#if c}
                    <span class="haut">
                      <span class="date">{dateCourte(c.date)}</span>
                      {#if c.change}<span class="nouveau">nouvelle dose</span>{/if}
                      {#if !c.arret && c.dose !== 0}<span class="case">☐</span>{/if}
                    </span>
                    {#if c.arret}
                      <span class="dose">Arrêt</span>
                    {:else if c.dose === 0}
                      <span class="dose sans">pas de prise</span>
                    {:else}
                      <span class="dose">{nombreFr(c.dose!)} mg</span>
                    {/if}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/each}
  {#if enCours}<p class="note">Ensuite : poursuivre la dernière dose jusqu'à nouvel avis médical.</p>{/if}
  <p class="ordo">{ordonnance}</p>
  <p class="note">Ne jamais arrêter brutalement la cortisone sans avis médical.</p>
</section>

<style>
  .impression {
    line-height: 1.15;
  }
  .entete {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 32mm;
    gap: 4mm;
    align-items: start;
  }
  .qr {
    width: 32mm;
    margin: 0;
    text-align: center;
  }
  .qr :global(svg) {
    display: block;
    width: 30mm;
    height: 30mm;
    margin: 0 auto;
  }
  tr {
    break-inside: avoid;
  }
  .page.suite {
    break-before: page;
  }
  .qr figcaption {
    font-size: 6.5pt;
    line-height: 1.2;
  }
  .etapes {
    display: flex;
    flex-wrap: wrap;
    column-gap: 1mm;
    margin: 0 0 2mm;
    font-size: 8pt;
    line-height: 1.35;
  }
  .etape {
    white-space: nowrap;
  }
  .fleche {
    color: #888;
  }
  /* Jour de changement de dose : bien visible, même imprimé en noir et blanc. */
  td.change {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: #fff1b8;
    border: 0.8mm solid #000;
  }
  .nouveau {
    white-space: nowrap;
    font-size: 5pt;
    line-height: 7pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .impression h1 {
    font-size: 16pt;
    margin: 0 0 2mm;
  }
  .consigne,
  .nom,
  .note,
  .ordo {
    margin: 0 0 2mm;
    font-size: 10pt;
  }
  .ordo {
    white-space: pre-wrap;
    font-size: 8.5pt;
    color: #333;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 2mm;
  }
  th {
    font-size: 9pt;
    padding: 1mm;
    border: 0.3mm solid #000;
    background: #eee;
  }
  td {
    border: 0.3mm solid #000;
    height: 9.6mm; /* hauteur fixe (case « nouvelle dose » comprise) : pagination prévisible */
    box-sizing: border-box;
    padding: 0.5mm 1mm;
    vertical-align: top;
    font-size: 8pt;
  }
  .haut {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  td.vide {
    background: #f4f4f4;
  }
  .date {
    color: #555;
    font-size: 7pt;
  }
  .dose {
    font-weight: 700;
    font-size: 9pt;
  }
  .dose.sans {
    font-weight: 400;
    font-size: 7pt;
  }
  .case {
    font-size: 11pt;
    line-height: 1;
  }
  .dose {
    display: block;
  }
</style>

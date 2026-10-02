<script lang="ts">
  /**
   * Calendrier patient imprimable (1 page A4) : une case à cocher par jour.
   * N'apparaît qu'à l'impression. Aucune donnée n'est enregistrée : le nom
   * s'écrit à la main sur le papier.
   */
  import { ajouterJours, dateCourte, dateFr, jourSemaine } from '../lib/dates';
  import { nombreFr } from '../lib/parser/normalize';
  import { doseDuJour } from '../lib/schedule';
  import type { Palier } from '../lib/types';

  let { paliers, debut, ordonnance }: { paliers: Palier[]; debut: string; ordonnance: string } = $props();

  const SEMAINES_MAX = 26; // au-delà, la page A4 déborde
  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  interface Case {
    date: string;
    dose: number | null; // null = hors traitement
    arret?: boolean;
  }

  const calcul = $derived.by(() => {
    const parJour: Case[] = [];
    let jour = debut;
    for (const p of paliers) {
      if (p.dose === 0) {
        parJour.push({ date: jour, dose: null, arret: true });
        break;
      }
      const n = p.jours ?? 28; // « à poursuivre » : 4 semaines affichées
      for (let k = 0; k < n; k++) {
        parJour.push({ date: jour, dose: doseDuJour(p.dose, k) });
        jour = ajouterJours(jour, 1);
      }
    }
    // Grille lundi → dimanche.
    const decalage = parJour.length ? jourSemaine(parJour[0]!.date) : 0;
    const cases: (Case | null)[] = [...Array(decalage).fill(null), ...parJour];
    while (cases.length % 7) cases.push(null);
    const semaines: (Case | null)[][] = [];
    for (let k = 0; k < cases.length; k += 7) semaines.push(cases.slice(k, k + 7));
    return { semaines: semaines.slice(0, SEMAINES_MAX), tronque: semaines.length > SEMAINES_MAX };
  });
  const enCours = $derived(paliers.length > 0 && paliers[paliers.length - 1]!.jours === null && paliers[paliers.length - 1]!.dose !== 0);
</script>

<section class="impression">
  <h1>Mon traitement par prednisone</h1>
  <p class="consigne">À prendre <strong>le matin</strong>, en une prise. Cochez la case chaque jour après la prise.</p>
  <p class="nom">Nom : ______________________________ &nbsp; Début : {dateFr(debut)}</p>
  <table>
    <thead><tr>{#each JOURS as j}<th>{j}</th>{/each}</tr></thead>
    <tbody>
      {#each calcul.semaines as semaine}
        <tr>
          {#each semaine as c}
            <td class:vide={!c}>
              {#if c}
                <span class="haut">
                  <span class="date">{dateCourte(c.date)}</span>
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
  {#if enCours}<p class="note">Ensuite : poursuivre la dernière dose jusqu'à nouvel avis médical.</p>{/if}
  {#if calcul.tronque}<p class="note">Calendrier limité aux {SEMAINES_MAX} premières semaines.</p>{/if}
  <p class="ordo">{ordonnance}</p>
  <p class="note">Ne jamais arrêter brutalement la cortisone sans avis médical.</p>
</section>

<style>
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
    height: 8.2mm;
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

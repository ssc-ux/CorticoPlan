<script lang="ts">
  /**
   * Page du patient, ouverte en scannant le QR code du calendrier imprimé :
   * dose du jour, prochains changements, et ajout des rappels à l'agenda du
   * téléphone. Tout est calculé sur le téléphone ; rien n'est envoyé.
   */
  import { versIcs } from '../lib/agenda';
  import { aujourdhui, dateFr, ecartJours } from '../lib/dates';
  import { formatDose } from '../lib/format';
  import { calendrier } from '../lib/schedule';
  import type { Palier } from '../lib/types';

  let { paliers, debut }: { paliers: Palier[]; debut: string } = $props();

  const lignes = $derived(calendrier(paliers, debut));
  const jour = aujourdhui();
  const actuelle = $derived(lignes.find((l) => l.debut <= jour && (l.fin === null || jour <= l.fin)));
  const prochaine = $derived(lignes.find((l) => l.debut > jour));
  let heure = $state('08:00');

  function agenda() {
    const ics = versIcs(paliers, debut, heure);
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'prednisone.ics' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  const libelle = (d: (typeof lignes)[number]['dose']) => (d === 0 ? 'arrêt' : `${formatDose(d)} le matin`);
</script>

<main class="patient">
  <h1><img src="./icon.svg" alt="" width="28" height="28" /> Mon traitement par prednisone</h1>

  {#if !lignes.length}
    <p class="carte">Ce lien n'est pas lisible. Demandez un nouveau calendrier à votre médecin.</p>
  {:else}
    <section class="carte aujourdhui">
      {#if actuelle}
        <p class="petit">Aujourd'hui</p>
        <p class="dose">{actuelle.dose === 0 ? 'Traitement terminé' : formatDose(actuelle.dose)}</p>
        {#if actuelle.dose !== 0}<p class="petit">le matin, en une prise</p>{/if}
      {:else if jour < debut}
        <p class="petit">Début le {dateFr(debut)}</p>
        <p class="dose">{formatDose(lignes[0]!.dose)}</p>
      {:else}
        <p class="dose">Traitement terminé</p>
      {/if}
      {#if prochaine}
        <p class="change">
          Prochain changement : <strong>le {dateFr(prochaine.debut)}</strong> → {libelle(prochaine.dose)}
          <span class="petit">(dans {ecartJours(jour, prochaine.debut)} jour{ecartJours(jour, prochaine.debut) > 1 ? 's' : ''})</span>
        </p>
      {/if}
    </section>

    <section class="carte">
      <h2>Rappel dans mon agenda le jour de chaque changement de dose</h2>
      <label class="heure">Heure du rappel <input type="time" bind:value={heure} /></label>
      <button type="button" class="principal" onclick={agenda}>📅 Ajouter à mon agenda</button>
      <p class="petit">Un rappel le jour où la dose change (et le jour de l'arrêt), avec la nouvelle dose. Votre téléphone propose de les ajouter à son calendrier ; rien n'est envoyé sur Internet.</p>
    </section>

    <section class="carte">
      <h2>Mon calendrier</h2>
      <ol class="etapes">
        {#each lignes as l}
          <li class:passe={l.fin !== null && l.fin < jour} class:encours={l === actuelle}>
            <span class="quand">
              {#if l.dose === 0}À partir du {dateFr(l.debut)}{:else if l.fin}Du {dateFr(l.debut)} au {dateFr(l.fin)}{:else}À partir du {dateFr(l.debut)}{/if}
            </span>
            <strong>{l.dose === 0 ? 'Arrêt' : formatDose(l.dose)}</strong>
            {#if l.fin === null && l.dose !== 0}<span class="petit">à poursuivre jusqu'à nouvel avis médical</span>{/if}
          </li>
        {/each}
      </ol>
    </section>

    <p class="alerte">Ne jamais arrêter brutalement la cortisone sans avis médical. En cas de fièvre, de malaise ou de doute, contactez votre médecin.</p>
  {/if}
</main>

<style>
  .patient {
    max-width: 560px;
    margin: 0 auto;
    padding: 16px 16px 40px;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.3rem;
  }
  h1 img {
    border-radius: 7px;
  }
  .carte {
    margin: 12px 0;
    padding: 16px;
    border-radius: 14px;
    background: var(--card);
    border: 1px solid var(--line);
  }
  h2 {
    margin: 0 0 10px;
    font-size: 1rem;
  }
  .aujourdhui {
    text-align: center;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--card)), color-mix(in srgb, var(--pnds) 12%, var(--card)));
  }
  .dose {
    margin: 2px 0;
    font-size: 2.6rem;
    font-weight: 800;
    color: var(--accent);
  }
  .petit {
    margin: 0;
    color: var(--muted);
    font-size: 0.88rem;
  }
  .change {
    margin: 12px 0 0;
  }
  .heure {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .heure input {
    min-height: 40px;
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    color: var(--fg);
    font-size: 1rem;
  }
  .principal {
    width: 100%;
    min-height: 50px;
    margin-bottom: 10px;
    border: 0;
    border-radius: 12px;
    background: var(--accent);
    color: var(--accent-texte);
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
  }
  .etapes {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .etapes li {
    display: grid;
    padding: 10px 12px;
    border-left: 4px solid var(--line);
    margin-bottom: 6px;
  }
  .etapes li.encours {
    border-left-color: var(--accent);
    background: var(--c1s);
    border-radius: 0 8px 8px 0;
  }
  .etapes li.passe {
    opacity: 0.5;
  }
  .quand {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .alerte {
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--attention-fond);
    border-left: 4px solid var(--attention);
  }
</style>

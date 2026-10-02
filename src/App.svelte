<script lang="ts">
  /**
   * Écran unique de CorticoPlan.
   * 1. Le médecin écrit (ou choisit) un schéma → 2. tableau daté modifiable
   * → 3. texte d'ordonnance à copier → courbe, calendrier patient, partage.
   * Rien n'est enregistré ni envoyé : tout se calcule dans le navigateur.
   */
  import CalendrierPatient from './components/CalendrierPatient.svelte';
  import ChoixSchema from './components/ChoixSchema.svelte';
  import Courbe from './components/Courbe.svelte';
  import Ordonnance from './components/Ordonnance.svelte';
  import Resultat from './components/Resultat.svelte';
  import Saisie from './components/Saisie.svelte';
  import Tableau from './components/Tableau.svelte';
  import { alertes } from './lib/alerts';
  import { aujourdhui, estDateValide } from './lib/dates';
  import { versTexte } from './lib/format';
  import { analyser } from './lib/parser';
  import { ordonnance } from './lib/prescription';
  import { calendrier } from './lib/schedule';
  import type { Schema } from './lib/schemas';
  import { decoderPartage, encoderPartage } from './lib/share';
  import type { Palier } from './lib/types';

  // Schéma reçu par un lien partagé (#s=…), sinon page vide.
  const partage = decoderPartage(location.hash);
  let texte = $state(partage?.texte ?? '');
  let debut = $state(partage?.debut && estDateValide(partage.debut) ? partage.debut : aujourdhui());
  let mode = $state<'ecrire' | 'choisir'>('ecrire');
  let joursParMois = $state(28);
  let schemaChoisi = $state<Schema | null>(null);
  let lienCopie = $state(false);

  const resultat = $derived(analyser(texte, { joursParMois }));
  const dateOk = $derived(estDateValide(debut));
  const pret = $derived(resultat.ok && resultat.paliers.length > 0 && dateOk);
  const lignes = $derived(pret ? calendrier(resultat.paliers, debut) : []);
  const texteOrdonnance = $derived(ordonnance(lignes));

  // Indication du schéma choisi : effacée avec le texte, et signalée comme
  // « modifié » dès que le texte ne correspond plus exactement au schéma.
  $effect(() => {
    if (!texte.trim()) schemaChoisi = null;
  });
  const schemaModifie = $derived(schemaChoisi !== null && texte !== schemaChoisi.texte);
  const listeAlertes = $derived(alertes(lignes));

  function choisir(s: Schema) {
    texte = s.texte;
    schemaChoisi = s;
    mode = 'ecrire';
  }

  function modifier(paliers: Palier[]) {
    texte = versTexte(paliers);
  }

  async function partager() {
    const url = `${location.origin}${location.pathname}#${encoderPartage({ texte, debut })}`;
    history.replaceState(null, '', url);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Schéma de corticothérapie', url });
        return;
      } catch {
        /* partage annulé : on copie le lien */
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    lienCopie = true;
    setTimeout(() => (lienCopie = false), 2500);
  }
</script>

<div class="ecran">
  <header>
    <div class="marque">
      <img src="./icon.svg" alt="" width="32" height="32" />
      <h1>CorticoPlan</h1>
    </div>
    <p class="avertissement">
      Aide à la rédaction : ne remplace pas le jugement médical. Le schéma reste sous la responsabilité du prescripteur.
    </p>
  </header>

  <main>
    <section class="carte">
      <div class="entete">
        <h2>1. Le schéma</h2>
        <div class="onglets" role="tablist">
          <button role="tab" aria-selected={mode === 'ecrire'} class:actif={mode === 'ecrire'} onclick={() => (mode = 'ecrire')}>Écrire</button>
          <button role="tab" aria-selected={mode === 'choisir'} class:actif={mode === 'choisir'} onclick={() => (mode = 'choisir')}>Choisir un schéma</button>
        </div>
      </div>

      {#if mode === 'ecrire'}
        <Saisie bind:texte />
        {#if schemaChoisi}
          <p class="discret source">
            {schemaModifie ? 'Modifié à partir de' : 'Schéma'} : {schemaChoisi.nom} — <strong>{schemaChoisi.statut}</strong> —
            <a href={schemaChoisi.source.url} target="_blank" rel="noopener">source</a>
          </p>
        {/if}
      {:else}
        <ChoixSchema onchoix={choisir} />
      {/if}

      <label class="date">
        Début le
        <input type="date" bind:value={debut} required />
      </label>

      {#if mode === 'ecrire'}<Resultat {texte} {resultat} />{/if}
    </section>

    {#if pret}
      <section class="carte">
        <h2>2. Tableau <span class="discret">— touchez une ligne pour la modifier</span></h2>
        <Tableau {lignes} onchange={modifier} />
        {#if listeAlertes.length}
          <ul class="alertes">
            {#each listeAlertes as a}<li>ⓘ {a.message} <span class="discret">({a.source})</span></li>{/each}
          </ul>
        {/if}
      </section>

      <section class="carte">
        <h2>3. Ordonnance</h2>
        <Ordonnance texte={texteOrdonnance} />
      </section>

      <section class="carte">
        <h2>Courbe</h2>
        <Courbe paliers={resultat.paliers} {debut} />
      </section>

      <div class="actions">
        <button type="button" class="bouton" onclick={() => window.print()}>🖨 Imprimer le calendrier patient</button>
        <button type="button" class="bouton" onclick={partager}>{lienCopie ? '✓ Lien copié' : '🔗 Partager ce schéma'}</button>
      </div>
    {:else if texte.trim() && !resultat.ok}
      <p class="discret attente">Corrigez le texte ci-dessus : le tableau et l'ordonnance apparaîtront ici.</p>
    {/if}
  </main>

  <footer>
    <details>
      <summary>Réglages</summary>
      <label>1 mois = <input type="number" min="28" max="31" bind:value={joursParMois} /> jours</label>
    </details>
    <p>
      Aucune donnée n'est enregistrée ni envoyée : tout est calculé sur cet appareil. Ne saisissez jamais de nom de patient.
    </p>
  </footer>
</div>

{#if pret}
  <CalendrierPatient paliers={resultat.paliers} {debut} ordonnance={texteOrdonnance} />
{/if}

<style>
  .ecran {
    max-width: 760px;
    margin: 0 auto;
    padding: 1rem 16px 2rem;
  }
  header {
    margin-bottom: 1rem;
  }
  .marque {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  h1 {
    font-size: 1.5rem;
  }
  .avertissement {
    margin: 0.6rem 0 0;
    padding: 0.55rem 0.8rem;
    border-radius: var(--rayon);
    background: var(--attention-fond);
    border-left: 4px solid var(--attention);
    font-size: 0.875rem;
  }
  main {
    display: grid;
    gap: 1rem;
  }
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .entete h2 {
    margin: 0;
  }
  .onglets {
    display: inline-flex;
    padding: 3px;
    border-radius: 999px;
    background: var(--fond);
    border: 1px solid var(--bord);
  }
  .onglets button {
    min-height: 38px;
    padding: 0.3rem 0.9rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--texte-2);
  }
  .onglets button.actif {
    background: var(--accent);
    color: var(--accent-texte);
  }
  .date {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.75rem;
    font-weight: 600;
  }
  .date input {
    min-height: 44px;
    padding: 0.3rem 0.6rem;
    border: 2px solid var(--bord);
    border-radius: var(--rayon);
    background: var(--fond);
  }
  .source {
    margin: 0.4rem 0 0;
  }
  .source a {
    color: var(--accent);
  }
  .alertes {
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.875rem;
    color: var(--texte-2);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .attente {
    text-align: center;
    margin: 0.5rem 0;
  }
  footer {
    margin-top: 2rem;
    font-size: 0.85rem;
    color: var(--texte-3);
  }
  footer input {
    width: 4.5rem;
    min-height: 36px;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--bord);
    border-radius: 6px;
    background: var(--fond);
  }
  summary {
    cursor: pointer;
    font-weight: 600;
  }
</style>

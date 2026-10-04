<script lang="ts">
  /**
   * Écran unique de CorticoPlan (style PNDSthèque).
   * Onglet « Écrire » : le médecin écrit le schéma → l'ordonnance à copier
   * apparaît juste dessous, puis le tableau (modifiable), la courbe, l'impression.
   * Onglet « Schémas » : schémas des PNDS et des essais, qui remplissent le champ.
   * Rien n'est enregistré ni envoyé : tout se calcule dans le navigateur.
   */
  import CalendrierPatient from './components/CalendrierPatient.svelte';
  import ChoixSchema from './components/ChoixSchema.svelte';
  import PagePatient from './components/PagePatient.svelte';
  import Comparateur from './components/Comparateur.svelte';
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
  import { SCHEMAS, type Schema } from './lib/schemas';
  import { EXEMPLES } from './lib/exemples';
  import { decoderPaliers, decoderPartage, encoderPaliers, encoderPartage } from './lib/share';
  import type { Palier } from './lib/types';

  // Page patient ouverte par le QR code du calendrier (#p=… compact ; #a=… ancien format).
  const patient = (() => {
    const p = decoderPaliers(location.hash);
    if (p) return p;
    const a = decoderPartage(location.hash, 'a');
    const r = a && analyser(a.texte);
    return a && r?.ok ? { paliers: r.paliers, debut: a.debut && estDateValide(a.debut) ? a.debut : aujourdhui() } : null;
  })();
  // Schéma reçu par un lien partagé (#s=…), sinon page vide.
  const partage = decoderPartage(location.hash);
  let texte = $state(partage?.texte ?? '');
  let debut = $state(partage?.debut && estDateValide(partage.debut) ? partage.debut : aujourdhui());
  let onglet = $state<'ecrire' | 'schemas' | 'comparer'>('ecrire');
  let joursParMois = $state(28);

  // Thème : clair par défaut ; « sombre » ou « comme l'appareil » au choix (mémorisé sur cet appareil).
  const lireTheme = () => {
    try {
      return localStorage.getItem('theme') ?? 'clair';
    } catch {
      return 'clair';
    }
  };
  let theme = $state(lireTheme());
  $effect(() => {
    const racine = document.documentElement;
    if (theme === 'auto') delete racine.dataset.theme;
    else racine.dataset.theme = theme === 'sombre' ? 'dark' : 'light';
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* stockage indisponible : réglage non mémorisé */
    }
  });
  let schemaChoisi = $state<Schema | null>(null);
  let maladie = $state<string | null>(null); // tuile ouverte dans l'onglet Schémas
  let compares = $state<{ cle: number; teinte: number }[]>([]); // schémas cochés dans « Comparer »
  let maladiesComparees = $state<string[]>([]);
  let lienCopie = $state(false);

  const resultat = $derived(analyser(texte, { joursParMois }));
  const dateOk = $derived(estDateValide(debut));
  const pret = $derived(resultat.ok && resultat.paliers.length > 0 && dateOk);
  const lignes = $derived(pret ? calendrier(resultat.paliers, debut) : []);
  const texteOrdonnance = $derived(ordonnance(lignes));
  const listeAlertes = $derived(alertes(lignes));
  /** Lien du QR code imprimé : page patient (dose du jour, rappels agenda). */
  const lienPatient = $derived(`${location.origin}${location.pathname}#${encoderPaliers(resultat.paliers, debut)}`);

  // Indication du schéma choisi : effacée avec le texte, « modifié » si le texte change.
  $effect(() => {
    if (!texte.trim()) schemaChoisi = null;
  });
  /** Précision du schéma (ce qui suit « — » dans le statut), avec majuscule. */
  const note = $derived.by(() => {
    const n = schemaChoisi?.statut.split(' — ').slice(1).join(' — ') ?? '';
    return n && n[0]!.toUpperCase() + n.slice(1);
  });
  /** Page d'accueil épurée (style moteur de recherche) tant que le champ est vide. */
  const accueil = $derived(onglet === 'ecrire' && !texte.trim());
  const schemaModifie = $derived(schemaChoisi !== null && texte !== schemaChoisi.texte);

  // Lien partagé ouvert alors que le site est déjà affiché : on le charge aussi.
  $effect(() => {
    const charger = () => {
      const p = decoderPartage(location.hash);
      if (!p) return;
      texte = p.texte;
      if (p.debut && estDateValide(p.debut)) debut = p.debut;
      onglet = 'ecrire';
    };
    window.addEventListener('hashchange', charger);
    return () => window.removeEventListener('hashchange', charger);
  });

  /** Logo : retour à la page d'accueil (champ vidé, adresse sans lien partagé). */
  function allerAccueil(e: MouseEvent) {
    e.preventDefault();
    texte = '';
    onglet = 'ecrire';
    history.replaceState(null, '', location.pathname);
    window.scrollTo({ top: 0 });
  }

  function choisir(s: Schema) {
    texte = s.texte;
    schemaChoisi = s;
    onglet = 'ecrire';
    window.scrollTo({ top: 0 });
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

{#if patient}
  <PagePatient paliers={patient.paliers} debut={patient.debut} />
{:else}
<div class="ecran wrap" class:accueil class:large={!accueil && (onglet !== 'ecrire' || pret)}>
  <header class="top">
    <h1>
      <a href="./" class="maison" onclick={allerAccueil}><img src="./icon.svg" alt="" width="22" height="22" /> CorticoPlan</a>
    </h1>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={onglet === 'ecrire'} onclick={() => (onglet = 'ecrire')}>Écrire</button>
      <button role="tab" aria-selected={onglet === 'schemas'} onclick={() => (onglet = 'schemas')}>
        Schémas <span class="n">{SCHEMAS.length}</span>
      </button>
      <button role="tab" aria-selected={onglet === 'comparer'} onclick={() => (onglet = 'comparer')}>Comparer</button>
    </div>
  </header>

  {#if onglet === 'schemas'}
    <ChoixSchema onchoix={choisir} bind:pathologie={maladie} />
  {:else if onglet === 'comparer'}
    <Comparateur
      texteSaisi={texte}
      bind:maladies={maladiesComparees}
      bind:choisis={compares}
      onutiliser={(s, t) => {
        texte = t;
        schemaChoisi = s;
        onglet = 'ecrire';
        window.scrollTo({ top: 0 });
      }}
    />
  {:else}
    <main class:deux={pret}>
      <div class="col gauche">
      {#if accueil}
        <p class="logo"><img src="./icon.svg" alt="" width="52" height="52" /> <span>CorticoPlan</span></p>
      {/if}
      <p class="accroche">Écrivez le schéma comme dans un courrier : l'ordonnance se rédige toute seule.</p>
      <Saisie bind:texte {accueil} />
      {#if accueil}
        <div class="boutons">
          <button type="button" onclick={() => (texte = EXEMPLES[Math.floor(Math.random() * EXEMPLES.length)]!)}>Essayer un exemple</button>
          <button type="button" onclick={() => (onglet = 'schemas')}>Parcourir les schémas</button>
        </div>
        <p class="discret dictee">🎙 Astuce : dictez le schéma avec la dictée vocale de votre téléphone, collez-le ici, et c'est prêt.</p>
      {/if}
      {#if schemaChoisi}
        <p class="discret source" class:pnds={/PNDS/.test(schemaChoisi.statut + schemaChoisi.source.document) && !schemaChoisi.statut.startsWith("issu d'un essai")}>
          {schemaModifie ? 'Modifié à partir de' : 'Schéma'} : {schemaChoisi.nom} —
          <strong>{schemaChoisi.valide ? 'vérifié' : 'à vérifier'}</strong><br />
          Source : <a href={schemaChoisi.source.url} target="_blank" rel="noopener">{schemaChoisi.source.document}</a>{schemaChoisi.source.page ? `, ${schemaChoisi.source.page}` : ''}
          ({schemaChoisi.source.annee}).
          {#if note}<br />{note}.{/if}
        </p>
      {/if}

      {#if !accueil}
        <label class="date">
          Début le
          <input type="date" bind:value={debut} required />
        </label>
      {/if}

      <Resultat {texte} {resultat} onappliquer={(t) => (texte = t)} />

      {#if pret}
        <section class="carte o-tableau">
          <h2>Tableau <span class="aide">· touchez une ligne pour la modifier</span></h2>
          <Tableau {lignes} onchange={modifier} />
          {#if listeAlertes.length}
            <ul class="alertes">
              {#each listeAlertes as a}<li>ⓘ {a.message} <span class="discret">({a.source})</span></li>{/each}
            </ul>
          {/if}
        </section>
      {/if}
      </div>

      {#if pret}
        <!-- Grand écran : colonne de droite qui reste visible ; téléphone : ordonnance juste sous le champ. -->
        <div class="col droite">
          <section class="carte o-ordonnance">
            <h2>Ordonnance</h2>
            <Ordonnance texte={texteOrdonnance} />
          </section>
          <div class="actions o-actions">
            <button type="button" class="lien-action" onclick={() => window.print()}>Imprimer le calendrier patient</button>
            <button type="button" class="lien-action" onclick={partager}>{lienCopie ? '✓ Lien copié' : 'Partager ce schéma'}</button>
          </div>
          <section class="carte o-courbe">
            <h2>Courbe</h2>
            <Courbe paliers={resultat.paliers} {debut} />
          </section>
        </div>
      {/if}
    </main>
  {/if}

  <footer>
    <p>
      Aide à la rédaction : ne remplace pas le jugement médical ; le schéma reste sous la responsabilité du
      prescripteur. Aucune donnée n'est enregistrée ni envoyée. Ne saisissez jamais de nom de patient.
    </p>
    <p class="createur">Créé par <strong>Quentin Astouati</strong></p>
    <details>
      <summary>Réglages</summary>
      <label>1 mois = <input type="number" min="28" max="31" bind:value={joursParMois} /> jours</label>
      <label
        >Affichage
        <select bind:value={theme}>
          <option value="clair">clair</option>
          <option value="sombre">sombre</option>
          <option value="auto">comme l'appareil</option>
        </select></label
      >
    </details>
  </footer>
</div>

{#if pret}
  <CalendrierPatient paliers={resultat.paliers} {debut} ordonnance={texteOrdonnance} lienPatient={lienPatient} />
{/if}
{/if}

<style>
  .wrap {
    max-width: 780px;
    margin: 0 auto;
    padding: 0 16px 48px;
  }
  /* Téléphone : une seule colonne, l'ordonnance juste sous le champ. */
  main.deux {
    display: flex;
    flex-direction: column;
  }
  main.deux .col {
    display: contents;
  }
  .o-ordonnance {
    order: 1;
  }
  .o-actions {
    order: 2;
  }
  .o-tableau {
    order: 3;
  }
  .o-courbe {
    order: 4;
  }
  /* Grand écran : plus large, deux colonnes ; à droite ordonnance + courbe restent visibles. */
  @media (min-width: 1100px) {
    .wrap.large {
      max-width: 1240px;
    }
    main.deux {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 0 28px;
      align-items: start;
    }
    main.deux .col {
      display: block;
    }
    main.deux .droite {
      position: sticky;
      top: 64px;
      max-height: calc(100vh - 72px);
      overflow-y: auto;
      padding-top: 12px;
    }
  }
  @media (min-width: 760px) {
    .top {
      display: flex;
      align-items: center;
      gap: 32px;
      padding-top: 6px;
    }
    .top h1 {
      margin: 0;
    }
    .accueil .tabs {
      margin-left: auto;
    }
  }
  .top {
    position: sticky;
    top: env(safe-area-inset-top, 0px);
    z-index: 5;
    background: var(--bg);
    margin: 0 -16px;
    padding: 14px 16px 0;
    border-bottom: 1px solid var(--line);
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    font: 600 1.3rem/1.2 'Plus Jakarta Sans', system-ui, sans-serif;
    letter-spacing: -0.01em;
  }
  .maison {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: inherit;
    text-decoration: none;
  }
  h1 img {
    border-radius: 5px;
  }
  .tabs {
    display: flex;
    gap: 22px;
  }
  .tabs button {
    border: 0;
    background: none;
    color: var(--muted);
    padding: 10px 0;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    font-weight: 500;
  }
  .tabs button[aria-selected='true'] {
    color: var(--accent);
    border-bottom-color: var(--accent);
    font-weight: 600;
  }
  .n {
    margin-left: 5px;
    color: var(--accent);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  .accroche {
    margin: 22px 0 10px;
    color: var(--muted);
  }
  .source {
    margin: 0.4rem 0 0;
    line-height: 1.45;
  }
  /* Accueil : logo au centre, champ arrondi, onglets discrets en haut à droite. */
  .accueil .top {
    position: static;
    border-bottom: 0;
    background: none;
  }
  .accueil .top h1 {
    display: none;
  }
  .accueil .tabs {
    justify-content: flex-end;
    gap: 16px;
  }
  .accueil .tabs button {
    font-size: 0.9rem;
  }
  .accueil .tabs button[aria-selected='true'] {
    display: none;
  }
  .accueil::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    background:
      radial-gradient(60% 45% at 20% 18%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%),
      radial-gradient(55% 40% at 85% 30%, color-mix(in srgb, var(--pnds) 13%, transparent), transparent 70%),
      radial-gradient(50% 40% at 50% 95%, color-mix(in srgb, var(--s2) 9%, transparent), transparent 70%);
  }
  .accueil main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 68vh;
    max-width: 620px;
    margin: 0 auto;
  }
  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 0 0 18px;
    font: 600 clamp(2.2rem, 9vw, 3.4rem) / 1 'Plus Jakarta Sans', system-ui, sans-serif;
    letter-spacing: -0.03em;
  }
  .logo span {
    background: linear-gradient(90deg, var(--accent), var(--pnds));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .logo img {
    width: clamp(40px, 10vw, 52px);
    height: auto;
    border-radius: 12px;
  }
  .accueil .accroche {
    margin: 0 0 16px;
    text-align: center;
  }
  .boutons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 20px;
  }
  .boutons button {
    min-height: 40px;
    padding: 0 18px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--card);
    color: var(--fg);
    font-size: 0.92rem;
    cursor: pointer;
  }
  .boutons button:hover {
    border-color: var(--line);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
  }
  .accueil .dictee {
    margin-top: 18px;
    text-align: center;
  }
  .accueil footer {
    text-align: center;
  }
  .dictee {
    margin: 0.4rem 0 0;
    font-size: 0.82rem;
  }
  .source a {
    color: var(--accent);
  }
  .source.pnds {
    padding: 8px 10px;
    border-left: 4px solid var(--pnds);
    border-radius: 6px;
    background: var(--pnds-fond);
  }
  .date {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.75rem;
    font-weight: 500;
    color: var(--muted);
  }
  .date input {
    min-height: 40px;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    color: var(--fg);
  }
  .aide {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
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
    gap: 6px 22px;
    padding: 1rem 0;
  }
  .lien-action {
    border: 0;
    background: none;
    padding: 6px 0;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }
  .lien-action:hover {
    text-decoration: underline;
  }
  footer {
    margin-top: 2rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .createur {
    margin: 0.4rem 0 0.6rem;
  }
  footer details label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  footer select {
    min-height: 34px;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    color: var(--fg);
  }
  footer input {
    width: 4.5rem;
    min-height: 34px;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    color: var(--fg);
  }
  summary {
    cursor: pointer;
    font-weight: 600;
  }
</style>

<script lang="ts">
  /**
   * Tableau daté. Toucher une ligne ouvre un petit formulaire pour modifier
   * la dose ou la durée ; la modification est renvoyée au parent, qui
   * réécrit le texte.
   */
  import { tick } from 'svelte';
  import { dateFr } from '../lib/dates';
  import { nombreFr } from '../lib/parser/normalize';
  import type { Ligne } from '../lib/schedule';
  import type { Palier } from '../lib/types';

  let { lignes, onchange }: { lignes: Ligne[]; onchange: (p: Palier[]) => void } = $props();

  let edition = $state<number | null>(null);
  let dose = $state('');
  let jours = $state('');
  let unSurDeux = $state(false);
  let erreur = $state('');

  const paliers = (): Palier[] => lignes.map((l) => ({ dose: l.dose, jours: l.jours }));
  const estDernier = (i: number) => i === lignes.length - 1;

  function ouvrir(i: number) {
    const l = lignes[i]!;
    edition = i;
    unSurDeux = typeof l.dose !== 'number';
    dose = nombreFr(typeof l.dose === 'number' ? l.dose : l.dose[0]);
    jours = l.jours === null ? '' : String(l.jours);
    erreur = '';
  }

  function valider() {
    const d = Number(dose.replace(',', '.'));
    const j = jours.trim() === '' ? null : Number(jours);
    if (!Number.isFinite(d) || d < 0) return (erreur = 'Dose invalide.');
    if (j !== null && (!Number.isInteger(j) || j < 1)) return (erreur = 'Durée invalide (nombre de jours).');
    if (j === null && !estDernier(edition!)) return (erreur = 'Durée obligatoire, sauf pour la dernière ligne.');
    const liste = paliers();
    liste[edition!] = { dose: d === 0 ? 0 : unSurDeux ? [d, 0] : d, jours: d === 0 ? null : j };
    edition = null;
    onchange(liste);
  }

  function supprimer() {
    const liste = paliers();
    liste.splice(edition!, 1);
    edition = null;
    onchange(liste);
  }

  /**
   * Ajoute un palier avant le dernier (le dernier reste « à poursuivre »).
   * Dose proposée : à mi-chemin entre ses voisins (une dose identique serait
   * fusionnée avec la ligne voisine) ; le formulaire s'ouvre pour l'ajuster.
   */
  async function ajouter() {
    const liste = paliers();
    const valeur = (p?: Palier) => (p ? (typeof p.dose === 'number' ? p.dose : p.dose[0]) : null);
    const apres = valeur(liste[liste.length - 1]) ?? 0;
    const avant = valeur(liste[liste.length - 2]) ?? apres + 10;
    const d = Math.round(avant + apres) / 2; // moyenne arrondie au 0,5 mg
    const position = Math.max(liste.length - 1, 0);
    liste.splice(position, 0, { dose: d === apres ? apres + 0.5 : d, jours: 7 });
    onchange(liste);
    await tick();
    ouvrir(position);
  }

  function libelleDose(l: Ligne): string {
    if (l.dose === 0) return 'Arrêt';
    if (typeof l.dose === 'number') return `${nombreFr(l.dose)} mg/j`;
    return `${nombreFr(l.dose[0])} mg un jour sur deux`;
  }
</script>

<table>
  <thead>
    <tr><th scope="col">Du</th><th scope="col">Au</th><th scope="col">Dose</th></tr>
  </thead>
  <tbody>
    {#each lignes as l, i (i)}
      <tr class:arret={l.dose === 0} class:active={edition === i} onclick={() => ouvrir(i)}>
        <td>{dateFr(l.debut)}</td>
        <td>{l.dose === 0 ? '—' : l.fin === null ? 'à poursuivre' : dateFr(l.fin)}</td>
        <td class="dose">
          <button type="button" class="lien" aria-label={`Modifier la ligne ${i + 1}`}>{libelleDose(l)}</button>
        </td>
      </tr>
      {#if edition === i}
        <tr class="editeur">
          <td colspan="3">
            <form onsubmit={(e) => (e.preventDefault(), valider())}>
              <label>Dose (mg/j)<input inputmode="decimal" bind:value={dose} /></label>
              <label>
                Durée (jours)
                <input inputmode="numeric" bind:value={jours} placeholder={estDernier(i) ? 'à poursuivre' : ''} />
              </label>
              <label class="case"><input type="checkbox" bind:checked={unSurDeux} /> Un jour sur deux</label>
              {#if erreur}<p class="erreur">{erreur}</p>{/if}
              <div class="actions">
                <button class="bouton principal" type="submit">Valider</button>
                <button class="bouton" type="button" onclick={() => (edition = null)}>Annuler</button>
                <button class="bouton" type="button" onclick={supprimer}>Supprimer</button>
              </div>
              <p class="discret">Dose 0 = arrêt. Laisser la durée vide sur la dernière ligne = à poursuivre.</p>
            </form>
          </td>
        </tr>
      {/if}
    {/each}
  </tbody>
</table>
<button type="button" class="bouton ajouter" onclick={ajouter}>+ Ajouter un palier</button>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th {
    text-align: left;
    font-size: 0.8rem;
    color: var(--texte-3);
    font-weight: 600;
    padding: 0 0.5rem 0.4rem;
  }
  td {
    padding: 0.7rem 0.5rem;
    border-top: 1px solid var(--bord);
  }
  tbody tr:not(.editeur) {
    cursor: pointer;
  }
  tbody tr:not(.editeur):hover,
  tr.active {
    background: var(--accent-doux);
  }
  .dose {
    font-weight: 700;
  }
  .lien {
    border: 0;
    background: none;
    padding: 0;
    font-weight: inherit;
    text-align: left;
  }
  .arret td {
    color: var(--texte-2);
  }
  .editeur td {
    background: var(--fond);
    border-top: 0;
  }
  form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.6rem;
    align-items: end;
  }
  label {
    display: grid;
    gap: 0.2rem;
    font-size: 0.85rem;
    font-weight: 600;
  }
  input:not([type='checkbox']) {
    min-height: 44px;
    padding: 0.4rem 0.6rem;
    border: 2px solid var(--bord);
    border-radius: var(--rayon);
    background: var(--fond);
    font-size: 1rem;
  }
  .case {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 44px;
  }
  .case input {
    width: 20px;
    height: 20px;
  }
  .actions {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .erreur {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--erreur);
    font-weight: 600;
  }
  form .discret {
    grid-column: 1 / -1;
    margin: 0;
  }
  .ajouter {
    margin-top: 0.6rem;
  }
</style>

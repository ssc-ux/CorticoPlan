/**
 * Fichier agenda (.ics) pour le patient : un rappel le jour de chaque
 * changement de dose (et le jour de l'arrêt), pas de rappel quotidien.
 * Généré dans le navigateur, rien n'est envoyé. Heure « flottante » (sans
 * fuseau) : le rappel sonne à l'heure locale du téléphone.
 */
import { calendrier } from './schedule';
import { dateFr } from './dates';
import { formatDose } from './format';
import type { Palier } from './types';

const compacte = (iso: string) => iso.replaceAll('-', '');

/** Plie les lignes (75 octets au plus, accents compris) comme l'exige le format iCalendar. */
function plier(ligne: string): string {
  const morceaux: string[] = [];
  for (let i = 0; i < ligne.length; i += 60) morceaux.push((i ? ' ' : '') + ligne.slice(i, i + 60));
  return morceaux.join('\r\n');
}

const echapper = (t: string) => t.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

export function versIcs(paliers: Palier[], debut: string, heure = '08:00', maintenant = new Date()): string {
  const [hh, mm] = heure.split(':');
  const tampon = maintenant.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CorticoPlan//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Prednisone'];
  calendrier(paliers, debut).forEach((l, n) => {
    const arret = l.dose === 0;
    const dose = arret ? '' : formatDose(l.dose).replace('mg/j', 'mg par jour');
    const resume = arret ? 'Prednisone : arrêt du traitement' : n === 0 ? `Prednisone : début, ${dose}` : `Prednisone : nouvelle dose, ${dose}`;
    const detail = arret
      ? "Fin du traitement : plus de prednisone à partir d'aujourd'hui."
      : `À partir d'aujourd'hui : ${dose}, le matin en une prise, ${l.fin ? `jusqu'au ${dateFr(l.fin)} inclus` : "jusqu'à nouvel avis médical"}.`;
    lignes.push(
      'BEGIN:VEVENT',
      `UID:corticoplan-${compacte(debut)}-${n}@corticoplan`,
      `DTSTAMP:${tampon}`,
      `DTSTART:${compacte(l.debut)}T${hh}${mm}00`,
      'DURATION:PT15M',
      `SUMMARY:${echapper(resume)}`,
      `DESCRIPTION:${echapper(detail + ' Ne jamais arrêter brutalement la cortisone sans avis médical.')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${echapper(resume)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lignes.push('END:VCALENDAR');
  return lignes.map(plier).join('\r\n') + '\r\n';
}

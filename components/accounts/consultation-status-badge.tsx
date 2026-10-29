import {consultationStatus} from '@/lib/consultation-status';
import type {Poll} from '@/lib/domain';

const labels = {open: 'Abierta', expired: 'Caduca', closed: 'Cerrada'};
const descriptions = {
  open: 'La consulta sigue abierta.',
  expired: 'El último horario propuesto ya pasó; los registros siguen abiertos hasta que cierres la consulta.',
  closed: 'Los registros están cerrados.',
};

export function ConsultationStatusBadge({poll, now}: {poll: Poll; now: Date}) {
  const status = consultationStatus(poll, now);
  const description = poll.closureOutcome === 'no_agreement' && status === 'closed'
    ? 'Consulta cerrada sin acuerdo de horario.' : descriptions[status];
  return <span className={`consultation-status consultation-status-${status}`} title={description} aria-label={`${labels[status]}. ${description}`}>
    <span className="consultation-status-dot" aria-hidden="true"/>{labels[status]}
  </span>;
}

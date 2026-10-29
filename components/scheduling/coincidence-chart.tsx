import {clock, slotLabel, type Poll, type Vote} from '@/lib/domain';
import {coincidenceChart, type Coincidence} from '@/lib/coincidence-chart';

type Props = {poll: Poll; votes: Vote[]; ranked: Coincidence[]; onInspect: (key: string) => void};

function ChartRows({rows, total, onInspect, dayOnly = false}: {
  rows: {label: string; row: Coincidence}[];
  total: number;
  onInspect: (key: string) => void;
  dayOnly?: boolean;
}) {
  return <ol className="coincidence-list">{rows.map(({label, row}) => {
    const yesWidth = 100 * row.yes / total;
    const maybeWidth = 100 * row.maybe / total;
    const detail = `${row.yes} de ${total} disponibles${row.maybe ? `; ${row.maybe} si hace falta` : ''}`;
    return <li key={row.key}>
      <button className="coincidence-row" type="button" onClick={() => onInspect(row.key)} aria-label={`${label}: ${detail}. Ver personas`}>
        <span className="coincidence-label">{label}{dayOnly && <small>Mejor franja: {clock(Number(row.key.split('@')[1]))}</small>}</span>
        <span className="coincidence-track" aria-hidden="true"><span className="coincidence-yes" style={{width: `${yesWidth}%`}}/><span className="coincidence-maybe" style={{width: `${maybeWidth}%`}}/></span>
        <span className="coincidence-value">{row.yes}/{total}<span className="sr-only"> disponibles</span></span>
      </button>
      {row.maybe > 0 && <span className="coincidence-extra">+{row.maybe} si hace falta</span>}
    </li>;
  })}</ol>;
}

export function CoincidenceChart({poll, votes, ranked, onInspect}: Props) {
  if (!poll.id || !votes.length || !ranked.length) return null;
  const {slots, days} = coincidenceChart(poll, ranked);
  return <section className="panel coincidence-chart" aria-labelledby="coincidence-chart-title">
    <div className="coincidence-heading"><div><p className="eyebrow">RESPUESTAS GUARDADAS</p><h2 id="coincidence-chart-title">Dónde hay más coincidencias</h2></div><p className="small muted">{votes.length} {votes.length === 1 ? 'respuesta' : 'respuestas'}</p></div>
    <p className="small muted coincidence-explainer">Cada barra muestra cuántas personas están disponibles para la reunión completa. El tramo claro indica «Si hace falta». Pulsa una opción para ver los nombres.</p>
    <div className="coincidence-columns">
      <div><h3>Mejores jornadas</h3><p className="small muted">La franja más coincidente de cada día.</p><ChartRows rows={days.map(({label, peak}) => ({label, row: peak}))} total={votes.length} onInspect={onInspect} dayOnly/></div>
      <div><h3>Mejores horarios</h3><p className="small muted">Opciones con más personas disponibles.</p><ChartRows rows={slots.map(row => ({label: slotLabel(poll, row.key, poll.duration || poll.step), row}))} total={votes.length} onInspect={onInspect}/></div>
    </div>
    <div className="coincidence-legend"><span><i className="coincidence-legend-yes"/>Disponible</span><span><i className="coincidence-legend-maybe"/>Si hace falta</span></div>
  </section>;
}

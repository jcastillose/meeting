import {
  slotLabel,
  statuses,
  type Poll,
  type Vote,
  type Status,
} from "@/lib/domain";
import type { Counts } from "@/lib/vote-index";
/** Mounted by Radix only while the tooltip is open. */
export function SlotPeople({
  poll,
  votes,
  slotKey: key,
  s,
  layer,
  mine,
}: {
  poll: Poll;
  votes: Vote[];
  slotKey: string;
  s: Counts;
  layer: string;
  mine?: Status;
}) {
  return (
    <>
      <div className="names-heading">
        <span>Preferencias del grupo</span>
        <strong>{slotLabel(poll, key)}</strong>
        <p>
          {s.yes + s.maybe} de {votes.length} personas pueden asistir
          {s.maybe > 0 ? " (incluye alternativas)" : ""}
        </p>
      </div>
      <div className="names-sections">
        {(["yes", "maybe", "no"] as const).map((status) => {
          const people = votes.filter((v) => v.slots[key] === status);
          return (
            people.length > 0 && (
              <section className="names-section" key={status}>
                <h4>
                  <span className={"names-dot context-" + status}>
                    {status === "yes" ? "✓" : status === "maybe" ? "?" : "×"}
                  </span>
                  {statuses[status]}
                  <span className="names-count">{people.length}</span>
                </h4>
                <ul>
                  {people.map((v) => (
                    <li key={v.id}>{v.name}</li>
                  ))}
                </ul>
              </section>
            )
          );
        })}
        {s.yes + s.maybe + s.no === 0 && (
          <p className="muted">Nadie ha marcado este horario.</p>
        )}
      </div>
      <div className="names-footer">
        <p>
          {votes.length - s.yes - s.maybe - s.no} sin respuesta en este horario
        </p>
        {layer === "mine" && (
          <p>
            <strong>Tu selección:</strong>{" "}
            {mine ? statuses[mine] : "Sin marcar"}
          </p>
        )}
      </div>
    </>
  );
}

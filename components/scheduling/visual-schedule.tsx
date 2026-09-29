"use client";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { add, clock, date, today, type DailyRange } from "@/lib/domain";
import {
  MAX_SCHEDULE_DAYS,
  MAX_SCHEDULE_RANGES,
  toggleBlock,
  usableRange,
  validDate,
} from "@/lib/schedule";
export function VisualSchedule({
  ranges,
  onChange,
  step,
  disabled = false,
}: {
  ranges: DailyRange[];
  onChange: (value: DailyRange[]) => void;
  step: number;
  disabled?: boolean;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState(
    () => ranges.find((r) => validDate(r.date))?.date || today(),
  );
  const [fullDay, setFullDay] = useState(false),
    [active, setActive] = useState(0),
    [message, setMessage] = useState("");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const first = add(anchor, -((date(anchor).getDay() + 6) % 7));
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => add(first, i)),
    [first],
  );
  const valid = ranges.every((r) => usableRange(r, step));
  const [bounds] = useState(() => ({
    from: Math.min(
      480,
      ...ranges.filter((r) => usableRange(r, step)).map((r) => r.from),
    ),
    to: Math.max(
      1200,
      ...ranges.filter((r) => usableRange(r, step)).map((r) => r.to),
    ),
  }));
  const from = fullDay ? 0 : bounds.from,
    to = fullDay ? 1440 : bounds.to;
  const minutes = Array.from(
    { length: (to - from) / step },
    (_, i) => from + i * step,
  );
  const selected = useMemo(() => {
    const keys = new Set<string>();
    for (const r of ranges)
      if (usableRange(r, step))
        for (let t = r.from; t < r.to; t += step) keys.add(r.date + "@" + t);
    return keys;
  }, [ranges, step]);
  function toggle(day: string, time: number) {
    const next = toggleBlock(ranges, day, time, step);
    const dates = next.map((r) => r.date).sort();
    if (
      next.length > MAX_SCHEDULE_RANGES ||
      (dates.length &&
        (+new Date(dates.at(-1)!) - +new Date(dates[0])) / 86400000 >=
          MAX_SCHEDULE_DAYS)
    ) {
      setMessage(
        "No se añadió el bloque: la propuesta debe abarcar como máximo 62 días y 256 tramos.",
      );
      return;
    }
    onChange(next);
    setMessage(
      `${date(day).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}, ${clock(time)}: ${selected.has(day + "@" + time) ? "bloque desmarcado" : "bloque añadido"}.`,
    );
  }
  function move(index: number, key: string) {
    const row = Math.floor(index / 7),
      col = index % 7;
    let next = index;
    if (key === "ArrowRight") next = row * 7 + Math.min(6, col + 1);
    else if (key === "ArrowLeft") next = row * 7 + Math.max(0, col - 1);
    else if (key === "ArrowDown")
      next = Math.min(minutes.length - 1, row + 1) * 7 + col;
    else if (key === "ArrowUp") next = Math.max(0, row - 1) * 7 + col;
    else if (key === "Home") next = row * 7;
    else if (key === "End") next = row * 7 + 6;
    else return false;
    setActive(next);
    buttons.current[next]?.focus();
    return true;
  }
  return (
    <div className="schedule-visual">
      <div className="schedule-actions">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label="Semana anterior"
          onClick={() => {
            setAnchor(add(anchor, -7));
            setActive(0);
          }}
        >
          ←
        </Button>
        <label className="schedule-field">
          Ir a la semana de
          <input
            type="date"
            value={anchor}
            disabled={disabled}
            onChange={(e) => {
              if (validDate(e.target.value)) {
                setAnchor(e.target.value);
                setActive(0);
              }
            }}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label="Semana siguiente"
          onClick={() => {
            setAnchor(add(anchor, 7));
            setActive(0);
          }}
        >
          →
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-pressed={fullDay}
          onClick={() => {
            setFullDay(!fullDay);
            setActive(0);
          }}
        >
          {fullDay ? "Ver horario diurno" : "Ver las 24 horas"}
        </Button>
      </div>
      <p id={id + "-help"} className="schedule-help">
        Selecciona bloques con clic o toque. Repite para desmarcar. Con teclado:
        usa las flechas para moverte y Espacio o Enter para seleccionar. ✓
        indica un bloque propuesto.
      </p>
      {!valid && (
        <p className="schedule-error" role="alert">
          Completa o corrige los campos escritos antes de usar el calendario.
        </p>
      )}
      <div className="schedule-grid-scroll">
        <table
          className="schedule-grid"
          role="grid"
          aria-label="Calendario de horarios propuestos"
          aria-describedby={id + "-help"}
        >
          <thead>
            <tr>
              <th scope="col">Hora</th>
              {days.map((day) => (
                <th scope="col" key={day}>
                  {date(day).toLocaleDateString("es-CL", { weekday: "short" })}
                  <strong>
                    {date(day).toLocaleDateString("es-CL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </strong>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {minutes.map((time, row) => (
              <tr key={time}>
                <th scope="row">{clock(time)}</th>
                {days.map((day, col) => {
                  const index = row * 7 + col,
                    marked = selected.has(day + "@" + time);
                  return (
                    <td role="gridcell" key={day} aria-selected={marked}>
                      <button
                        ref={(el) => {
                          buttons.current[index] = el;
                        }}
                        type="button"
                        disabled={disabled || !valid}
                        tabIndex={
                          index === Math.min(active, minutes.length * 7 - 1)
                            ? 0
                            : -1
                        }
                        aria-pressed={marked}
                        aria-label={`${date(day).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}, ${clock(time)}–${clock(time + step)}: ${marked ? "propuesto" : "sin seleccionar"}`}
                        onFocus={() => setActive(index)}
                        onKeyDown={(e) => {
                          if (move(index, e.key)) e.preventDefault();
                        }}
                        onClick={() => toggle(day, time)}
                      >
                        {marked ? "✓" : <span aria-hidden="true">·</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="schedule-status" role="status" aria-live="polite">
        {message ||
          `${selected.size} bloques propuestos. Las dos vistas se sincronizan automáticamente.`}
      </p>
    </div>
  );
}

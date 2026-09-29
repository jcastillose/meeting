"use client";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { add, today, type DailyRange } from "@/lib/domain";
import { MAX_SCHEDULE_RANGES, validDate } from "@/lib/schedule";
import { TimeField } from "./time-field";
export function WrittenRanges({
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
  // Stable row identity survives deletion without moving partially typed text to another row.
  const keys = useRef<string[]>([]);
  const serial = useRef(0);
  while (keys.current.length < ranges.length)
    keys.current.push("range-" + serial.current++);
  keys.current.length = ranges.length;
  const update = (i: number, patch: Partial<DailyRange>) =>
    onChange(ranges.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  return (
    <div className="schedule-written">
      <p className="schedule-help">
        Escribe horas en formato 24 h (HH:MM). Puedes repetir una fecha para
        añadir una pausa entre tramos.
      </p>
      {!ranges.length && (
        <p className="schedule-empty">
          Aún no has propuesto horarios. Añade un tramo para comenzar.
        </p>
      )}
      {ranges.map((r, i) => (
        <fieldset
          className="schedule-row"
          key={keys.current[i]}
          disabled={disabled}
        >
          <legend>Tramo {i + 1}</legend>
          <label className="schedule-field schedule-date">
            Fecha
            <input
              type="date"
              required
              value={r.date}
              aria-invalid={!validDate(r.date)}
              onChange={(e) => update(i, { date: e.target.value })}
            />
          </label>
          <TimeField
            label="Desde"
            value={r.from}
            step={step}
            onChange={(from) => update(i, { from })}
          />
          <TimeField
            label="Hasta"
            value={r.to}
            step={step}
            allowMidnight
            onChange={(to) => update(i, { to })}
          />
          <Button
            type="button"
            variant="outline"
            aria-label={`Quitar tramo ${i + 1}`}
            onClick={() => {
              keys.current.splice(i, 1);
              onChange(ranges.filter((_, n) => n !== i));
            }}
          >
            Quitar
          </Button>
        </fieldset>
      ))}
      <div className="schedule-actions">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || ranges.length >= MAX_SCHEDULE_RANGES}
          onClick={() => {
            const last = ranges.at(-1);
            onChange([
              ...ranges,
              {
                date:
                  last && validDate(last.date) ? add(last.date, 1) : today(),
                from: 540,
                to: 1080,
              },
            ]);
          }}
        >
          Añadir tramo
        </Button>
        <span className="schedule-help">Hasta 62 días de extensión.</span>
      </div>
    </div>
  );
}

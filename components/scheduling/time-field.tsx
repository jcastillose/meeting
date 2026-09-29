"use client";
import { useEffect, useId, useState } from "react";
import { clock } from "@/lib/domain";
import { parseTime } from "@/lib/schedule";
/** Keep partial input visible; NaN marks an incomplete value without saving it. */
export function TimeField({
  label,
  value,
  onChange,
  step,
  allowMidnight = false,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (minutes: number) => void;
  step: number;
  allowMidnight?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(
    Number.isFinite(value) ? clock(value) : "",
  );
  useEffect(() => {
    if (Number.isFinite(value)) setDraft(clock(value));
  }, [value]);
  const n = parseTime(draft),
    invalid =
      !Number.isFinite(n) || n % step !== 0 || (!allowMidnight && n === 1440);
  return (
    <label className="schedule-field" htmlFor={id}>
      {label}
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="09:00"
        maxLength={5}
        required
        disabled={disabled}
        value={draft}
        aria-invalid={invalid}
        aria-describedby={invalid ? id + "-error" : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseTime(e.target.value));
        }}
      />
      {invalid && (
        <span className="schedule-field-error" id={id + "-error"}>
          Usa HH:MM en bloques de {step} min
          {allowMidnight ? " (hasta 24:00)" : ""}.
        </span>
      )}
    </label>
  );
}

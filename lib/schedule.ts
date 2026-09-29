/** Pure scheduling rules shared by UI and API. Minutes are local wall-clock minutes. */
import type { DailyRange } from "./domain";
export const MAX_SCHEDULE_DAYS = 62;
export const MAX_SCHEDULE_RANGES = 256;
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
}
export function parseTime(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && value !== "24:00")
    return NaN;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function usableRange(r: DailyRange, step: number): boolean {
  return (
    validDate(r.date) &&
    Number.isInteger(r.from) &&
    Number.isInteger(r.to) &&
    r.from >= 0 &&
    r.to <= 1440 &&
    r.to > r.from &&
    r.from % step === 0 &&
    r.to % step === 0
  );
}
export function canonicalRanges(ranges: DailyRange[]): DailyRange[] {
  const out: DailyRange[] = [];
  for (const r of [...ranges].sort(
    (a, b) => a.date.localeCompare(b.date) || a.from - b.from,
  )) {
    const last = out.at(-1);
    if (last && last.date === r.date && r.from <= last.to)
      last.to = Math.max(last.to, r.to);
    else out.push({ ...r });
  }
  return out;
}
export function scheduleErrors(
  ranges: DailyRange[],
  step: number,
  duration = step,
): string[] {
  if (![30, 60].includes(step))
    return ["Selecciona bloques de 30 o 60 minutos."];
  if (!ranges.length)
    return [
      "Añade al menos un tramo escrito o selecciona bloques en el calendario.",
    ];
  if (ranges.length > MAX_SCHEDULE_RANGES)
    return [`Puedes proponer hasta ${MAX_SCHEDULE_RANGES} tramos.`];
  if (ranges.some((r) => !usableRange(r, step)))
    return [
      "Revisa las fechas y horas: usa HH:MM, inicio anterior al fin y horarios alineados a los bloques seleccionados.",
    ];
  const sorted = [...ranges].sort(
    (a, b) => a.date.localeCompare(b.date) || a.from - b.from,
  );
  const errors: string[] = [];
  if (
    (+new Date(sorted.at(-1)!.date) - +new Date(sorted[0].date)) / 86400000 >=
    MAX_SCHEDULE_DAYS
  )
    errors.push(
      `Las fechas deben estar dentro de un período de ${MAX_SCHEDULE_DAYS} días.`,
    );
  if (
    sorted.some(
      (r, i) =>
        i > 0 && r.date === sorted[i - 1].date && r.from < sorted[i - 1].to,
    )
  )
    errors.push(
      "Hay tramos superpuestos. Ajusta sus horas o elimina el duplicado.",
    );
  if (!Number.isInteger(duration) || duration < step || duration % step !== 0)
    errors.push("La duración debe ser un múltiplo del tamaño de bloque.");
  else if (canonicalRanges(sorted).some((r) => r.to - r.from < duration))
    errors.push(
      `Cada tramo continuo debe cubrir al menos ${duration} minutos. Puedes ampliar los bloques seleccionados.`,
    );
  return errors;
}
/** Toggle one block, preserving other days and splitting a range when a gap is made. */
export function toggleBlock(
  ranges: DailyRange[],
  day: string,
  minute: number,
  step: number,
): DailyRange[] {
  const selected = ranges.some(
    (r) => r.date === day && r.from <= minute && r.to >= minute + step,
  );
  if (!selected)
    return canonicalRanges([
      ...ranges,
      { date: day, from: minute, to: minute + step },
    ]);
  return canonicalRanges(
    ranges.flatMap((r) => {
      if (r.date !== day || r.to <= minute || r.from >= minute + step)
        return [r];
      return [
        ...(r.from < minute ? [{ ...r, to: minute }] : []),
        ...(r.to > minute + step ? [{ ...r, from: minute + step }] : []),
      ];
    }),
  );
}

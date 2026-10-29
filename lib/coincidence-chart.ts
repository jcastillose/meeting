import {dayLabel, type Poll, type rank} from './domain';

export type Coincidence = ReturnType<typeof rank>[number];

function compare(a: Coincidence, b: Coincidence) {
  return b.yes-a.yes || b.maybe-a.maybe || a.no-b.no || a.missing-b.missing || a.key.localeCompare(b.key);
}

export function coincidenceChart(poll: Poll, ranked: Coincidence[], limit = 5) {
  const slots = [...ranked].sort(compare).slice(0, limit);
  const peakByDay = new Map<string, Coincidence>();
  for (const row of ranked) {
    const day = row.key.split('@')[0];
    const previous = peakByDay.get(day);
    if (!previous || compare(row, previous) < 0) peakByDay.set(day, row);
  }
  const days = [...peakByDay].map(([day, peak]) => ({day, label: dayLabel(poll, day), peak}));
  days.sort((a, b) => compare(a.peak, b.peak));
  return {slots, days: days.slice(0, limit)};
}

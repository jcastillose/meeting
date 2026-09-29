import type { Vote } from "./domain";
export type Counts = { yes: number; maybe: number; no: number; total: number };
export const EMPTY_COUNTS: Readonly<Counts> = Object.freeze({
  yes: 0,
  maybe: 0,
  no: 0,
  total: 0,
});
/** O(recorded preferences) once per response update, O(1) per calendar cell. */
export function indexVotes(votes: Vote[]) {
  const result = new Map<string, Counts>();
  for (const vote of votes)
    for (const key in vote.slots) {
      const status = vote.slots[key];
      if (status !== "yes" && status !== "maybe" && status !== "no") continue;
      let counts = result.get(key);
      if (!counts) {
        counts = { yes: 0, maybe: 0, no: 0, total: 0 };
        result.set(key, counts);
      }
      counts[status]++;
      counts.total++;
    }
  return result;
}

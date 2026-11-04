import assert from "node:assert/strict";
import {
  scheduleErrors,
  toggleBlock,
  proposalSelection,
  toggleProposalWindow,
  canonicalRanges,
  parseTime,
} from "../lib/schedule.ts";
import { days, times, rank } from "../lib/domain.ts";
import { handle } from "../lib/api.ts";
const a = { date: "2026-09-29", from: 540, to: 720 },
  b = { date: "2026-09-29", from: 900, to: 1080 };
assert.deepEqual(scheduleErrors([a, b], 30, 60), []);
assert(
  scheduleErrors([a, { ...a, from: 600 }], 30, 60).some((e) =>
    e.includes("superpuestos"),
  ),
);
assert(scheduleErrors([{ ...a, from: NaN }], 30).length);
assert(scheduleErrors([], 30).length);
assert(Number.isNaN(parseTime("9:00")));
assert(Number.isNaN(parseTime("24:30")));
assert.equal(parseTime("24:00"), 1440);
let ranges = toggleBlock([a, b], a.date, 600, 30);
assert.equal(ranges.length, 3);
assert.equal(ranges[0].to, 600);
assert.equal(ranges[1].from, 630);
assert.deepEqual(ranges[2], b);
ranges = toggleBlock(ranges, a.date, 600, 30);
assert.deepEqual(ranges, [a, b]);
assert.deepEqual(toggleBlock([{ ...a, to: 570 }], a.date, 540, 30), []);
assert.deepEqual(
  canonicalRanges([
    { ...a, to: 600 },
    { ...a, from: 600 },
  ]),
  [a],
);
// A visual proposal uses the chosen meeting duration, while keeping 30-minute precision.
const day = a.date;
const ninety = { date: day, from: 540, to: 630 };
assert.deepEqual(toggleProposalWindow([], day, 540, 30, 90), [ninety]);
assert.deepEqual(toggleProposalWindow([ninety], day, 540, 30, 90), []);
assert.deepEqual(proposalSelection([ninety], day, 600, 30, 90), ninety,
  "Removing near the end stays inside the proposed range.");
assert.deepEqual(toggleProposalWindow([ninety, b], day, 600, 30, 90), [b],
  "Removing a meeting window never crosses a pause or changes another proposal.");
assert.equal(proposalSelection([], day, 1410, 30, 90), null);
assert.deepEqual(toggleProposalWindow([], day, 1410, 30, 90), [],
  "A proposal cannot cross midnight.");
assert.deepEqual(toggleProposalWindow([], day, 1350, 30, 90), [{ date: day, from: 1350, to: 1440 }]);
assert.equal(proposalSelection([], day, 540, 30, 45), null);
assert.equal(proposalSelection([], day, 540, 30, 1500), null);
const longRange = { date: day, from: 540, to: 780 };
const remainder = toggleProposalWindow([longRange], day, 630, 30, 90);
assert.deepEqual(remainder, [{ date: day, from: 540, to: 630 }, { date: day, from: 720, to: 780 }]);
assert(scheduleErrors(remainder, 30, 90).some(error => error.includes("90 minutos")),
  "Short remainders are retained as an invalid draft; never silently removed.");
assert.deepEqual(longRange, { date: day, from: 540, to: 780 }, "Selection must not mutate the draft.");
assert.deepEqual(scheduleErrors([{ date: day, from: 540, to: 660 }], 30, 90), [],
  "A 120-minute range can contain a 90-minute meeting; exact duration multiples are unnecessary.");
assert(scheduleErrors([ninety], 30, 120).some(error => error.includes("120 minutos")),
  "Increasing duration invalidates shorter proposals without extending them automatically.");
assert.deepEqual(toggleProposalWindow([{ date: day, from: 540, to: 570 }], day, 540, 30, 90), [],
  "An explicitly clicked short invalid draft may be removed.");
const poll = {
  id: "p_test",
  title: "Test",
  mode: "dates",
  start: a.date,
  end: a.date,
  from: 540,
  to: 1080,
  step: 30,
  duration: 60,
  timezone: "America/Santiago",
  created: "",
  dailyRanges: [a, b],
};
assert.deepEqual(days(poll), [a.date]);
assert.equal(times(poll, a.date).length, 12);
assert(!times(poll, a.date).includes(720));
const slots = Object.fromEntries(
  times(poll, a.date).map((t) => [a.date + "@" + t, "yes"]),
);
const matches = rank(poll, [{ id: "v", name: "v", comment: "", slots }]);
assert.equal(matches.length, 10);
assert(!matches.some((m) => m.key.endsWith("@690")));
let saved;
const store = { createPoll: async (p) => (saved = p) };
const input = { ...poll, creator: { name: "Test", email: "test@example.com" } };
const response = await handle(
  new Request("https://example.test/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }),
  store,
);
assert.equal(response.status, 201);
assert.deepEqual(saved.dailyRanges, [a, b]);
for (const step of [30, 60]) {
  let current = [];
  const selected = new Set();
  for (let i = 0; i < 300; i++) {
    const time = ((i * 17) % (1440 / step)) * step;
    assert.deepEqual(toggleProposalWindow(current, a.date, time, step, step), toggleBlock(current, a.date, time, step), "Single-block meetings preserve existing selection behavior.");
    current = toggleBlock(current, a.date, time, step);
    if (selected.has(time)) selected.delete(time);
    else selected.add(time);
    assert.deepEqual(
      times({ ...poll, step, dailyRanges: current }, a.date),
      [...selected].sort((a, b) => a - b),
    );
  }
}
console.log(
  "PASS: synchronized block/range conversion, split/merge, multiple ranges per date, keyboard-sized slots, midnight, invalid input, ranking across gaps and API persistence",
);

import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesNow, Scheduler } from "./scheduler.js";

// IST is UTC+5:30, so 07:00 IST == 01:30 UTC.
const AT_0700_IST = new Date("2026-01-15T01:30:00.000Z");
const ONE_MIN_BEFORE = new Date("2026-01-15T01:29:00.000Z");
const ONE_MIN_AFTER = new Date("2026-01-15T01:31:00.000Z");

test("matchesNow: DAILY 07:00 fires exactly at 07:00 IST, not a minute either side", () => {
  assert.equal(matchesNow({ type: "DAILY", time: "07:00" }, AT_0700_IST), true);
  assert.equal(matchesNow({ type: "DAILY", time: "07:00" }, ONE_MIN_BEFORE), false);
  assert.equal(matchesNow({ type: "DAILY", time: "07:00" }, ONE_MIN_AFTER), false);
});

test("matchesNow: MONTHLY only fires on the configured day-of-month", () => {
  const firstOfMonth0900 = new Date("2026-02-01T03:30:00.000Z"); // 09:00 IST
  const fifteenthOfMonth0900 = new Date("2026-02-15T03:30:00.000Z");
  assert.equal(matchesNow({ type: "MONTHLY", day: 1, time: "09:00" }, firstOfMonth0900), true);
  assert.equal(matchesNow({ type: "MONTHLY", day: 1, time: "09:00" }, fifteenthOfMonth0900), false);
});

test("Scheduler.tick: skip-missed/dedup — calling tick twice with the same instant fires the handler once", async () => {
  let calls = 0;
  const scheduler = new Scheduler();
  scheduler.register({
    id: "test-routine",
    label: "test",
    schedule: { type: "DAILY", time: "07:00" },
    handler: async () => {
      calls += 1;
    },
  });

  await scheduler.tick(AT_0700_IST);
  await scheduler.tick(AT_0700_IST);

  assert.equal(calls, 1);
});

test("Scheduler.tick: coalesce-if-active — a slow handler is not re-entered while still running", async () => {
  let starts = 0;
  let resolveHandler!: () => void;
  const scheduler = new Scheduler();
  scheduler.register({
    id: "slow-routine",
    label: "slow",
    schedule: { type: "DAILY", time: "07:00" },
    handler: () =>
      new Promise<void>((resolve) => {
        starts += 1;
        resolveHandler = resolve;
      }),
  });

  await scheduler.tick(AT_0700_IST);
  // Same matching minute, handler still in flight — must not start a second run.
  await scheduler.tick(AT_0700_IST);
  assert.equal(starts, 1);
  resolveHandler();
});

test("Scheduler.tick: a non-matching time never fires the handler", async () => {
  let calls = 0;
  const scheduler = new Scheduler();
  scheduler.register({
    id: "test-routine",
    label: "test",
    schedule: { type: "DAILY", time: "07:00" },
    handler: async () => {
      calls += 1;
    },
  });

  await scheduler.tick(ONE_MIN_BEFORE);
  assert.equal(calls, 0);
});

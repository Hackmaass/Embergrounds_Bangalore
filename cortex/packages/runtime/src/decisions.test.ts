import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { stableStringify } from "./decisions.js";

function sha(s: string): string {
  return crypto.createHmac("sha256", "test-secret").update(s).digest("hex");
}

/** Simulates exactly what a JSONB column does to a payload: strip to plain
 * JSON (Dates become ISO strings, key insertion order is not guaranteed to
 * survive). This is the round-trip that broke the decision signature twice
 * during development — once on key order, once on Date serialization —
 * neither of which `pnpm -r typecheck` or an HTTP-level test can catch. */
function jsonbRoundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

test("stableStringify: signature survives a JSONB round-trip with nested object, array, number, and Date", () => {
  const payload = {
    zField: "z",
    aField: { nested: [1, 2, { deep: true }] },
    stockoutAt: new Date("2026-01-15T12:15:00.000Z"),
    amount: 305,
  };

  const signedAtStage = sha(stableStringify(payload));
  const readBackFromDb = jsonbRoundTrip(payload);
  const signedOnVerify = sha(stableStringify(readBackFromDb));

  assert.equal(signedOnVerify, signedAtStage);
});

test("stableStringify: key order does not affect the signature", () => {
  const a = { one: 1, two: 2, nested: { x: 1, y: 2 } };
  const b = { two: 2, nested: { y: 2, x: 1 }, one: 1 };
  assert.equal(stableStringify(a), stableStringify(b));
});

test("stableStringify: a mutated payload produces a different signature", () => {
  const original = { amount: 305, sku: "Ghee (tin)" };
  const tampered = { amount: 9999, sku: "Ghee (tin)" };
  assert.notEqual(sha(stableStringify(original)), sha(stableStringify(tampered)));
});

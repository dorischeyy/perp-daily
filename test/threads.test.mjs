import { test } from "node:test";
import assert from "node:assert/strict";
import { run, tmpJson } from "./_helpers.mjs";

const TODAY = "2026-06-23";
const validThread = (over = {}) => ({
  id: "t1", title: "Collateral adoption", score: 92, tier: "S", status: "active",
  first_seen: "2026-06-19", last_update: "2026-06-21", cadence_days: 3, next_check: "2026-06-24",
  thesis: "Collateral reuse may increase demand.", why_us: "Changes affect margin design.", watch_for: "Track deposits after launch.",
  log: [{ date: "2026-06-19", point: "The venue published its collateral list.", url: "https://x.com/p" }],
  ...over,
});
const th = (threads) => run(["lib/threads.mjs", TODAY, tmpJson({ threads })]);

test("Accepts a valid story ledger", () => {
  assert.equal(th([validThread()]).code, 0);
});

test("Requires the thesis field", () => {
  assert.equal(th([validThread({ thesis: "" })]).code, 1);
});

test("Validates the review date", () => {
  assert.equal(th([validThread({ next_check: "soon" })]).code, 1);
});

test("Rejects unknown statuses", () => {
  assert.equal(th([validThread({ status: "frozen" })]).code, 1);
});

test("Rejects duplicate IDs", () => {
  assert.equal(th([validThread(), validThread()]).code, 1);
});

test("Requires a URL for each log entry", () => {
  assert.equal(th([validThread({ log: [{ date: "2026-06-19", point: "x" }] })]).code, 1);
});

test("Reports a due review", () => {
  const r = run(["lib/threads.mjs", "2026-06-25", tmpJson({ threads: [validThread()] })]);
  assert.equal(r.code, 0);
  assert.match(r.out, /due/);
});

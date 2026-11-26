import { test } from "node:test";
import assert from "node:assert/strict";
import { run, tmpJson } from "./_helpers.mjs";

const preflight = (today, latest, market) =>
  run(["lib/check-run-state.mjs", today, tmpJson(latest), tmpJson(market)]);

test("Skips an edition already published today", () => {
  const result = preflight("2026-07-18", { date: "2026-07-18" }, { fetched_at: "2026-07-18T00:00:00Z" });
  assert.equal(result.code, 10);
  assert.match(result.out, /ALREADY_PUBLISHED/);
});

test("Allows a new edition with current market data", () => {
  const result = preflight("2026-07-18", { date: "2026-07-17" }, { fetched_at: "2026-07-17T16:30:00Z" });
  assert.equal(result.code, 0);
  assert.match(result.out, /Market data is current: 2026-07-18/);
  assert.match(result.out, /READY/);
});

test("Allows publication without stale market data", () => {
  const result = preflight("2026-07-18", { date: "2026-07-17" }, { fetched_at: "2026-07-17T00:30:00Z" });
  assert.equal(result.code, 0);
  assert.match(result.out, /Market data is stale/);
});

test("Rejects backdated publication", () => {
  const result = preflight("2026-07-18", { date: "2026-07-19" }, { fetched_at: "2026-07-18T00:00:00Z" });
  assert.equal(result.code, 1);
  assert.match(result.out, /refusing to backdate/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { run, tmpJson } from "./_helpers.mjs";

const preflight = (today, latest, market) =>
  run(["lib/check-run-state.mjs", today, tmpJson(latest), tmpJson(market)]);

test("今天已发布时退出 10，阻止重复研究", () => {
  const result = preflight("2026-07-18", { date: "2026-07-18" }, { fetched_at: "2026-07-18T00:00:00Z" });
  assert.equal(result.code, 10);
  assert.match(result.out, /ALREADY_PUBLISHED/);
});

test("未发布且北京时间行情新鲜时可继续", () => {
  const result = preflight("2026-07-18", { date: "2026-07-17" }, { fetched_at: "2026-07-17T16:30:00Z" });
  assert.equal(result.code, 0);
  assert.match(result.out, /行情快照可用：2026-07-18/);
  assert.match(result.out, /READY/);
});

test("行情陈旧只警告，不阻止无行情日报", () => {
  const result = preflight("2026-07-18", { date: "2026-07-17" }, { fetched_at: "2026-07-17T00:30:00Z" });
  assert.equal(result.code, 0);
  assert.match(result.out, /不可用或陈旧/);
});

test("latest 日期晚于今天时阻断", () => {
  const result = preflight("2026-07-18", { date: "2026-07-19" }, { fetched_at: "2026-07-18T00:00:00Z" });
  assert.equal(result.code, 1);
  assert.match(result.out, /拒绝倒退生成/);
});

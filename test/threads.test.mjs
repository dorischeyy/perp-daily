import { test } from "node:test";
import assert from "node:assert/strict";
import { run, tmpJson } from "./_helpers.mjs";

const TODAY = "2026-06-23";
const validThread = (over = {}) => ({
  id: "t1", title: "线", score: 92, tier: "S", status: "active",
  first_seen: "2026-06-19", last_update: "2026-06-21", cadence_days: 3, next_check: "2026-06-24",
  thesis: "论点", why_us: "对我们", watch_for: "盯什么",
  log: [{ date: "2026-06-19", point: "进展", url: "https://x.com/p" }],
  ...over,
});
const th = (threads) => run(["lib/threads.mjs", TODAY, tmpJson({ threads })]);

test("合法台账 → 通过(exit 0)", () => {
  assert.equal(th([validThread()]).code, 0);
});

test("缺必填字段(thesis) → 阻断(exit 1)", () => {
  assert.equal(th([validThread({ thesis: "" })]).code, 1);
});

test("日期格式错(next_check) → 阻断", () => {
  assert.equal(th([validThread({ next_check: "soon" })]).code, 1);
});

test("status 非法 → 阻断", () => {
  assert.equal(th([validThread({ status: "frozen" })]).code, 1);
});

test("id 重复 → 阻断", () => {
  assert.equal(th([validThread(), validThread()]).code, 1);
});

test("log 条目缺 url → 阻断", () => {
  assert.equal(th([validThread({ log: [{ date: "2026-06-19", point: "x" }] })]).code, 1);
});

test("next_check 到期 → 输出『到期需复盘』提醒", () => {
  const r = run(["lib/threads.mjs", "2026-06-25", tmpJson({ threads: [validThread()] })]);
  assert.equal(r.code, 0);
  assert.match(r.out, /到期/);
});

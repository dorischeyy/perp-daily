import { test } from "node:test";
import assert from "node:assert/strict";
import { run, tmpJson, baseContent } from "./_helpers.mjs";

const TODAY = "2026-06-23";
const cf = (content) => run(["lib/check-freshness.mjs", tmpJson(content), TODAY]);

test("新闻 ≤72h → 通过(exit 0)", () => {
  const c = baseContent();
  c.sections[0].items[0].date = "2026-06-21"; // 2天
  assert.equal(cf(c).code, 0);
});

test("新闻 >72h 且非本周主线 → 阻断(exit 1)", () => {
  const c = baseContent();
  c.sections[0].items[0].date = "2026-06-15"; // 8天
  assert.equal(cf(c).code, 1);
});

test("本周主线 ≤7天 → 通过", () => {
  const c = baseContent();
  c.sections[0].items[0].headline = "本周主线 ｜ 趋势综述";
  c.sections[0].items[0].date = "2026-06-18"; // 5天
  assert.equal(cf(c).code, 0);
});

test("本周主线 >7天 → 阻断", () => {
  const c = baseContent();
  c.sections[0].items[0].headline = "本周主线 ｜ 太旧";
  c.sections[0].items[0].date = "2026-06-10"; // 13天
  assert.equal(cf(c).code, 1);
});

test("URL 内嵌日期与 date 字段差 >2 天 → 判造假阻断", () => {
  const c = baseContent();
  c.sections[0].items[0].url = "https://x.com/blog/2026/01/29/post";
  c.sections[0].items[0].date = "2026-06-23"; // 与 url 的 01-29 差很多
  assert.equal(cf(c).code, 1);
});

test("机会与打法栏(hertzflow)豁免时效但仍查 url 造假", () => {
  const c = baseContent();
  c.sections = [
    { id: "hertzflow", title: "机会与打法", items: [
      { headline: "老来源洞察", body: ["x"], url: "https://x.com/p", date: "2026-05-01" },
    ] },
  ];
  assert.equal(cf(c).code, 0); // 机会与打法栏老日期豁免
});

test("补充来源可较旧，但 URL 日期必须与自身 date 一致", () => {
  const c = baseContent();
  c.sections[0].items[0].references = [
    { source: "背景", url: "https://example.com/2026/06/01/context", date: "2026-06-01" },
  ];
  assert.equal(cf(c).code, 0);

  c.sections[0].items[0].references[0].date = "2026-06-20";
  assert.equal(cf(c).code, 1);
});

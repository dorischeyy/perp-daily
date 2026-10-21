import { test } from "node:test";
import assert from "node:assert/strict";
import { run, tmpJson, baseContent } from "./_helpers.mjs";
import { researchContent } from "./_research-fixture.mjs";

const TODAY = "2026-06-23";
const cf = (content) => run(["lib/check-freshness.mjs", tmpJson(content), TODAY]);

test("纯新闻报告也必须与核验日期一致，不能将前一天内容装入今天归档", () => {
  const content = researchContent({ date: "2026-06-22" });
  content.sections = content.sections.filter((section) => section.id === "ai");
  const result = cf(content);
  assert.equal(result.code, 1);
  assert.match(result.out, /报告 date=2026-06-22 必须等于本次核验日期 2026-06-23/);

  const future = baseContent({ date: "2026-06-24" });
  assert.equal(cf(future).code, 1);
});

test("历史报告显式传入对应核验日期仍可通过", () => {
  const content = researchContent({ date: "2026-06-22" });
  content.sections = content.sections.filter((section) => section.id === "ai");
  assert.equal(run(["lib/check-freshness.mjs", tmpJson(content), "2026-06-22"]).code, 0);
  assert.equal(run(["lib/check-freshness.mjs", tmpJson(baseContent()), TODAY]).code, 0);
});

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

test("旧产品判断栏不再豁免时效", () => {
  const c = baseContent();
  c.sections = [
    { id: "hertzflow", title: "产品判断", items: [
      { headline: "老来源洞察", body: ["x"], url: "https://x.com/p", date: "2026-05-01" },
    ] },
  ];
  assert.equal(cf(c).code, 1);
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

test("今日进展必须是近 72h 的新事实", () => {
  const c = baseContent({
    threads: [{
      title: "新进展",
      since: "2026-06-01",
      date: "2026-06-21",
      source: "S",
      url: "https://example.com/thread",
      update: "出现新变化。",
      watch: "下一步。",
    }],
  });
  assert.equal(cf(c).code, 0);
  c.threads[0].date = "2026-06-18";
  assert.equal(cf(c).code, 1);
});

test("今日进展的 URL 日期与 date 不一致会被阻断", () => {
  const c = baseContent({
    threads: [{
      title: "日期不一致",
      since: "2026-06-01",
      date: "2026-06-23",
      source: "S",
      url: "https://example.com/2026/01/29/thread",
      update: "出现新变化。",
      watch: "下一步。",
    }],
  });
  assert.equal(cf(c).code, 1);
});

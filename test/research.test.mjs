import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateContent } from "../lib/validate-content.mjs";
import { validateResearchItem, isIsoDate, visibleCharCount } from "../lib/research.mjs";
import { run, tmpJson, baseContent } from "./_helpers.mjs";
import { researchContent, researchItem } from "./_research-fixture.mjs";

const TODAY = "2026-06-23";
const freshness = (content, today = TODAY) => run(["lib/check-freshness.mjs", tmpJson(content), today]);
const item = (content) => content.sections[0].items[0];
const errors = (content) => validateContent(content).errors;

test("Accepts older and undated research sources", () => {
  const content = researchContent();
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  delete item(content).date;
  item(content).references[0] = { source: "Undated protocol documentation", url: "https://example.org/docs", date: null, checked_at: TODAY };
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
});

test("Requires v2 from its effective date", () => {
  assert.deepEqual(errors(baseContent({ date: "2026-10-20" })), []);
  assert.ok(errors(baseContent({ date: "2026-10-21" })).some((error) => /editorial_version/.test(error)));
  assert.ok(errors(baseContent({ date: "2026-10-22", editorial_version: 1 })).some((error) => /editorial_version/.test(error)));
  assert.deepEqual(errors(researchContent({ date: "2026-10-21" })), []);
});

test("Supports dynamic non-AI sections", () => {
  const content = researchContent();
  const ai = content.sections.find((section) => section.id === "ai");
  content.sections = [{ id: "wallet-distribution", title: "Wallet distribution", items: [content.sections[0].items[2]] }, ai];
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  content.sections[0].items = [];
  assert.ok(errors(content).some((error) => /items must not be empty/.test(error)));
});

test("Checks each research item's domain and relevance", () => {
  for (const category of ["spot-infrastructure", "prediction-market", "other"]) {
    const content = researchContent();
    content.sections[0].items[1].research.category = category;
    assert.deepEqual(errors(content), []);
  }
  const content = researchContent();
  item(content).domain = "finance";
  item(content).relevance = "Related";
  assert.ok(errors(content).some((error) => /domain/.test(error)));
  assert.ok(errors(content).some((error) => /relevance/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("Rejects unknown item kinds", () => {
  for (const kind of ["analysis", "Research", null]) {
    const content = baseContent();
    item(content).kind = kind;
    assert.ok(errors(content).some((error) => /kind/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("Validates legacy research evidence", () => {
  const content = baseContent();
  item(content).kind = "research";
  item(content).date = "2026-01-01";
  assert.ok(errors(content).some((error) => /research must be an object/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("Maintains evidence requirements across formats", () => {
  for (const field of ["why_now", "mechanism", "gtm", "product", "implication", "unknowns"]) {
    const content = researchContent();
    item(content).research[field] = "TBD";
    assert.ok(errors(content).some((error) => error.includes(`research.${field}`)));
    assert.equal(freshness(content).code, 1);
  }
  const content = researchContent();
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  const legacy = baseContent();
  legacy.sections[0].items[0] = researchItem({ body: "First sentence. Second sentence. Third sentence." });
  assert.ok(errors(legacy).some((error) => /1–2 sentences/.test(error)));
});

test("Validates section IDs and titles", () => {
  const content = researchContent();
  content.sections[1].id = content.sections[0].id;
  assert.ok(errors(content).some((error) => /duplicate id/.test(error)));
  content.sections[1].id = "<script>";
  content.sections[1].title = "  ";
  assert.ok(errors(content).some((error) => /slug/.test(error)));
  assert.ok(errors(content).some((error) => /missing title/.test(error)));
});

test("Counts English words in a single paragraph", () => {
  const content = researchContent();
  for (const length of [29, 101]) {
    item(content).body = "word ".repeat(length).trim();
    assert.ok(errors(content).some((error) => /30–100/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  for (const length of [30, 100]) {
    item(content).body = "word ".repeat(length).trim();
    assert.deepEqual(errors(content), []);
  }
  item(content).body = ["word".repeat(80)];
  assert.ok(errors(content).some((error) => /single string/.test(error)));
  assert.equal(visibleCharCount("**AB** A 1.😀"), 6);
  const literalLink = "[A](https://example.com)";
  assert.equal(visibleCharCount(literalLink), Array.from(literalLink).length);
  item(content).body = `**${"word ".repeat(30).trim()}** 😀`;
  assert.deepEqual(errors(content), []);
});

test("Disallows labeled subheadings and context cards", () => {
  for (const prefix of ["Mechanism:", "**Impact**:", "[Event]", "### Background\n"]) {
    const content = researchContent();
    item(content).body = `${prefix}${" Annotations".repeat(40)}`;
    assert.ok(errors(content).some((error) => /labeled subheadings/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  const content = researchContent();
  item(content).context = { label: "Measurement limits", text: "The coverage excludes users who access the venue through external wallets." };
  assert.ok(errors(content).some((error) => /context is retired/.test(error)));
});

test("Disallows line breaks and list markers", () => {
  for (const separator of ["\n", "\r\n", "\u2028", "\u2029"]) {
    const content = researchContent();
    item(content).body = `${"Ace".repeat(40)}${separator}${"B".repeat(40)}`;
    assert.ok(errors(content).some((error) => /single paragraph/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  for (const marker of ["• ", "- ", "+ ", "* ", "1. "]) {
    const content = researchContent();
    item(content).body = `${marker}${" Annotations".repeat(40)}`;
    assert.ok(errors(content).some((error) => /bullets/.test(error)));
  }
});

test("Requires an event date in each news headline", () => {
  const content = researchContent();
  const news = content.sections[0].items[2];
  delete news.event_date;
  assert.ok(errors(content).some((error) => /event_date/.test(error)));
  news.event_date = "2026-06-22";
  assert.ok(errors(content).some((error) => /headline must include/.test(error)));
  news.headline = "June 22 Example Protocol opens wallet integration to applicants";
  assert.deepEqual(errors(content), []);
  news.headline = "2026-06-22 Example Protocol opens wallet integration to applicants";
  assert.deepEqual(errors(content), []);
  news.event_date = "2026-06-24";
  news.headline = "June 24 Example Protocol opens wallet integration to applicants";
  assert.ok(errors(content).some((error) => /cannot be later/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("Accepts undated mechanism headlines", () => {
  const content = researchContent();
  item(content).headline = "Example Protocol shares order book depth while isolating collateral risk by pool";
  assert.equal(item(content).checked_at, TODAY);
  assert.equal(item(content).event_date, undefined);
  assert.equal(item(content).snapshot_date, undefined);
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
});

test("Rejects verification-date framing", () => {
  for (const headline of [
    "June 23 research on Example Protocol order books and wallet distribution",
    "As of June 23 Example Protocol has not reported wallet user retention",
    "As of 2026-06-23 Example Protocol has not reported wallet user retention",
    "As of 2026/06/23 Example Protocol has not reported wallet user retention",
    "June 23 Example Protocol opens wallet integration to applicants",
  ]) {
    const content = researchContent();
    item(content).headline = headline;
    assert.ok(errors(content).some((error) => /checked_at is not an event/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("Rejects relative and abbreviated verification dates", () => {
  for (const headline of [
    "As of today Example Protocol has not disclosed retention",
    "Today research into wallet distribution continues",
    "Today verification of wallet distribution continues",
    "10-21 research on wallet distribution continues",
    "10/21 research on wallet distribution continues",
    "As of 10-21 the wallet has not disclosed retention",
  ]) {
    const content = researchContent();
    item(content).headline = headline;
    assert.ok(errors(content).some((error) => /checked_at is not an event/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("Distinguishes genuine market terms and numeric ranges", () => {
  for (const headline of [
    "Example Protocol allows shares bought today to transfer before settlement",
    "Example Protocol isolates collateral across 10-21 separate pools",
  ]) {
    const content = researchContent();
    item(content).headline = headline;
    item(content).body = "Example Protocol reuses a spot order book for leveraged trades and isolates collateral and debt by pool. Trading applications still need to handle borrowing, price feeds and liquidation alerts. The protocol publishes the current parameters for each pool.";
    assert.deepEqual(errors(content), []);
    assert.equal(freshness(content).code, 0);
  }
});

test("Requires event research headlines to match the event date", () => {
  const content = researchContent();
  item(content).event_date = "2026-06-20";
  item(content).headline = "June 20 Example Protocol opens wallet integration to applicants";
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  item(content).headline = "2026-06-20 Example Protocol opens wallet integration to applicants";
  assert.deepEqual(errors(content), []);
  item(content).headline = "June 21 Example Protocol opens wallet integration to applicants";
  assert.ok(errors(content).some((error) => /headline must include/.test(error)));
  assert.equal(freshness(content).code, 1);
  item(content).event_date = "2026-06-24";
  item(content).headline = "June 24 Example Protocol opens wallet integration to applicants";
  assert.ok(errors(content).some((error) => /event_date cannot be later/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("Validates a dated research snapshot", () => {
  for (const [snapshot_date, headline] of [
    [TODAY, "As of June 23 Example Protocol has not disclosed trader retention data"],
    ["2026-06-20", "As of 2026-06-20 Example Protocol has not disclosed trader retention data"],
  ]) {
    const content = researchContent();
    Object.assign(item(content), { snapshot_date, headline });
    assert.equal(item(content).checked_at, TODAY);
    assert.deepEqual(errors(content), []);
    assert.equal(freshness(content).code, 0);
  }
});

test("Rejects invalid or conflicting snapshot dates", () => {
  for (const snapshot_date of ["2026-06-24", "2026-02-30", "Yesterday", "", null]) {
    const content = researchContent();
    Object.assign(item(content), { snapshot_date, headline: "As of June 24 Example Protocol has not disclosed trader retention data" });
    assert.ok(errors(content).some((error) => /snapshot_date/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  const content = researchContent();
  Object.assign(item(content), { event_date: TODAY, snapshot_date: TODAY, headline: "As of June 23 Example Protocol has not disclosed trader retention data" });
  assert.ok(errors(content).some((error) => /snapshot_date and event_date are mutually exclusive/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("Matches the snapshot date in its headline", () => {
  for (const headline of [
    "As of June 22 Example Protocol has not disclosed trader retention data",
    "June 23 research on Example Protocol trade samples and retention",
    "As of this verification Example Protocol has not disclosed trader retention data",
  ]) {
    const content = researchContent();
    Object.assign(item(content), { snapshot_date: TODAY, headline });
    assert.ok(errors(content).some((error) => /headline must say As of/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("Restricts snapshot dates to research", () => {
  for (const hasEventDate of [true, false]) {
    const content = researchContent();
    const news = content.sections[0].items[2];
    news.snapshot_date = TODAY;
    news.headline = "As of June 23 Example Protocol has not disclosed trader retention data";
    if (!hasEventDate) delete news.event_date;
    assert.ok(errors(content).some((error) => /snapshot_date is restricted to research/.test(error)));
    if (!hasEventDate) assert.ok(errors(content).some((error) => /event_date must be a real/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("Applies freshness windows to news events", () => {
  const content = researchContent();
  const news = content.sections[0].items[2];
  news.event_date = "2026-06-19";
  news.headline = "June 19 Example Protocol opens wallet integration to applicants";
  assert.equal(news.date, TODAY);
  assert.match(freshness(content).out, /event_date=2026-06-19/);
  assert.equal(freshness(content).code, 1);
  news.event_date = "2026-06-20";
  news.headline = "June 20 Example Protocol opens wallet integration to applicants";
  assert.equal(freshness(content).code, 0);
  news.event_date = "2026-06-16";
  news.headline = "Weekly trend | June 16 Example Protocol opens its wallet to a new group of traders";
  assert.equal(freshness(content).code, 0);
  news.event_date = "2026-06-15";
  news.headline = "Weekly trend | June 15 Example Protocol opens its wallet to a new group of traders";
  assert.equal(freshness(content).code, 1);
  content.sections[0].items.pop();
  item(content).event_date = "2026-01-01";
  item(content).headline = "2026-01-01 Example Protocol studies distribution after adding wallet integration";
  assert.equal(freshness(content).code, 0);
});

test("Preserves unsupported markup in visible length checks", () => {
  const content = researchContent();
  item(content).body = "verified ".repeat(100) + `[details](https://example.com/${"a".repeat(120)})`;
  assert.ok(errors(content).some((error) => /body must contain 30/.test(error)));
});

test("Disallows a separate v2 thread snapshot", () => {
  const content = researchContent();
  content.threads = [];
  assert.ok(errors(content).some((error) => /v2 must not include a threads/.test(error)));
});

test("Checks every source on the edition date", () => {
  for (const target of ["primary", "reference"]) {
    const content = researchContent();
    const source = target === "primary" ? item(content) : item(content).references[0];
    source.checked_at = "2026-06-22";
    assert.ok(errors(content).some((error) => /checked_at/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  assert.equal(freshness(researchContent(), "2026-06-24").code, 1);
});

test("Requires two distinct URLs", () => {
  const content = researchContent();
  item(content).references[0].url = item(content).url;
  assert.ok(errors(content).some((error) => /duplicates|two distinct/.test(error)));
  item(content).references = [];
  assert.equal(freshness(content).code, 1);
  const invalid = researchItem();
  invalid.source = "";
  invalid.references[0].url = "javascript:alert(1)";
  const result = validateResearchItem(invalid, TODAY);
  assert.ok(result.some((error) => /source/.test(error)));
  assert.ok(result.some((error) => /url/.test(error)));
});

test("Validates source publication dates", () => {
  for (const [date, url] of [
    ["2026-06-24", "https://example.com/docs"],
    ["2026-06-23", "https://example.com/2026/06/22/post"],
    [null, "https://example.com/2026/06/22/post"],
    ["2026-02-30", "https://example.com/docs"],
  ]) {
    for (const reference of [false, true]) {
      const content = researchContent();
      Object.assign(reference ? item(content).references[0] : item(content), { date, url });
      assert.ok(errors(content).length > 0);
      assert.equal(freshness(content).code, 1);
    }
  }
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2028-02-29"), true);
});

test("Checks attribution and discussion freshness", () => {
  const content = researchContent();
  const discussion = { speaker: "Researcher", affiliation: "independent", summary: "The researcher compared acquisition costs with the incentives offered to wallet partners.", url: "https://example.net/comment", date: "2026-05-24" };
  item(content).research.discussions = [discussion];
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  for (const date of ["2026-05-23", "2026-06-24", "Yesterday"]) {
    discussion.date = date;
    assert.ok(errors(content).some((error) => /discussions.*date/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  discussion.date = TODAY;
  discussion.affiliation = "influencer";
  assert.ok(errors(content).some((error) => /affiliation/.test(error)));
  discussion.affiliation = "unknown";
  delete discussion.speaker;
  assert.ok(errors(content).some((error) => /speaker/.test(error)));
});

test("Requires an explanation for missing discussion evidence", () => {
  const content = researchContent();
  item(content).research.discussion_gap = "None";
  assert.ok(errors(content).some((error) => /discussion_gap/.test(error)));
  assert.equal(freshness(content).code, 1);
  item(content).research.discussions = "Not found";
  assert.ok(errors(content).some((error) => /discussions/.test(error)));
});

test("Rejects future news and reference dates", () => {
  const content = baseContent();
  item(content).date = "2026-06-24";
  assert.equal(freshness(content).code, 1);
  item(content).date = TODAY;
  item(content).references = [{ source: "Source", url: "https://example.com/future", date: "2026-06-24" }];
  assert.equal(freshness(content).code, 1);
});

test("Checks dates independently of the AI score", () => {
  const content = researchContent();
  const ai = content.sections.find((section) => section.id === "ai").items[0];
  ai.importance_score = 100;
  ai.date = "2026-06-19";
  assert.equal(freshness(content).code, 1);
  ai.date = TODAY;
  ai.event_date = "2026-06-19";
  ai.headline = "June 19 Example AI releases a developer model and opens applications";
  assert.equal(freshness(content).code, 1);
});

const render = (content) => {
  const path = join(mkdtempSync(join(tmpdir(), "research-render-")), "research.html");
  assert.equal(run(["lib/build-html.mjs", tmpJson(content), path]).code, 0);
  return readFileSync(path, "utf8");
};

test("Renders compact research with numbered sources", () => {
  const html = render(researchContent());
  for (const label of ["Verified 2026-06-23", "publication date unavailable", "Published 2026-05-01"]) {
    assert.ok(html.includes(label), label);
  }
  for (const label of ["Project research · Perpetual futures protocol", "Project research · Trading frontend", "Selection rationale", "GTM strategy", "Product strategy", "Evidence gap", "Interpretation", "Not confirmed"]) {
    assert.ok(!html.includes(label), label);
  }
  assert.ok(!html.includes('<dl class="research-details">'));
  assert.ok(!html.includes("Published 2026-06-23 · Verified 2026-06-23"));
});

test("Escapes discussion content and hides research notes", () => {
  const content = researchContent();
  const research = item(content).research;
  research.mechanism = '<img src=x onerror="alert(1)">';
  research.project = '<script>alert(1)</script>';
  research.discussions = [
    { speaker: '<b>Researcher</b>', affiliation: "sponsored", summary: '<script>alert(2)</script>', url: "https://example.net/comment", date: TODAY },
    { speaker: "Unsafe source", affiliation: "unknown", summary: "Internal note", url: "javascript:alert(3)", date: TODAY },
  ];
  item(content).references[0].source = `https://example.com/${"long".repeat(80)}`;
  const html = render(content);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;b&gt;Researcher&lt;/b&gt;'));
  assert.ok(html.includes('(Sponsored)'));
  assert.match(html, /overflow-wrap:anywhere/);
  assert.ok(!html.includes('Unsafe source'));
  assert.ok(!html.includes('&lt;script&gt;alert(2)&lt;/script&gt;'));
});

test("checks Chinese character limits, bullets, snapshot dates and weekly windows", () => {
  const content = researchContent();
  const research = item(content);
  research.body = "甲".repeat(70);
  research.snapshot_date = TODAY;
  research.headline = "截至6月23日钱包订单簿已支持十个合约";
  assert.deepEqual(errors(content), []);
  research.body = "甲".repeat(151);
  assert.ok(errors(content).some(error => /70–150 visible characters/.test(error)));
  research.body = "机制：" + "甲".repeat(70);
  assert.ok(errors(content).some(error => /labeled subheadings/.test(error)));
  research.body = "1、 " + "甲".repeat(70);
  assert.ok(errors(content).some(error => /bullets/.test(error)));
  research.body = "甲".repeat(70);
  research.headline = "截至2025年6月23日钱包订单簿已支持十个合约";
  assert.ok(errors(content).some(error => /match snapshot_date/.test(error)));
  delete research.snapshot_date;
  assert.ok(errors(content).some(error => /must be undated/.test(error)));
  research.headline = "钱包订单簿为交易者提供多种合约";

  const news = content.sections[0].items[2];
  news.headline = "本周主线：6月16日交易平台调整部分持仓限制";
  news.event_date = "2026-06-16";
  assert.equal(freshness(content).code, 0);
  news.headline = "6月16日交易平台调整部分持仓限制";
  assert.equal(freshness(content).code, 1);
});

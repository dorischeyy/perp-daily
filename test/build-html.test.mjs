import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run, baseContent } from "./_helpers.mjs";

const dir = mkdtempSync(join(tmpdir(), "bh-"));
let n = 0;
function render(content) {
  const inP = join(dir, `c${n}.json`);
  const outP = join(dir, `o${n++}.html`);
  writeFileSync(inP, JSON.stringify(content));
  const r = run(["lib/build-html.mjs", inP, outP]);
  let html = "";
  try { html = readFileSync(outP, "utf8"); } catch {}
  return { code: r.code, html, out: r.out };
}

test("Renders a valid edition", () => {
  const { code, html } = render(baseContent());
  assert.equal(code, 0);
  assert.match(html, /Headline/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<div class="mast-sub">June 23, 2026 · Tuesday<\/div>/);
  assert.match(html, /Built and maintained by Doris/);
});

test("Escapes HTML in headlines", () => {
  const c = baseContent();
  c.sections[0].items[0].headline = '<script>alert(1)</script>';
  const { html } = render(c);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("Rejects non-HTTP source links", () => {
  const c = baseContent();
  c.sections[0].items[0].url = "javascript:alert(1)";
  const { html } = render(c);
  assert.ok(!/href="javascript:/i.test(html));
});

test("Displays dates in archived product sections", () => {
  const c = baseContent();
  c.sections = [{ id: "old-column", title: "Product assessment", items: [
    { decision_area: "Strategic priorities", headline: "Insight", body: ["x"], url: "https://x.com/p", date: "2026-05-01" },
  ] }];
  const { html } = render(c);
  const seg = (html.match(/<section class="sec sec-legacy-product-view">[\s\S]*?<\/section>/) || [""])[0];
  assert.ok(seg.includes("Product observations"));
  assert.ok(!seg.includes("Product assessment"));
  assert.ok(seg.includes("item-date"));
  assert.ok(seg.includes("2026-05-01"));
  assert.ok(!seg.includes("decision-area"));
});

test("Omits the retired lead card", () => {
  const c = baseContent({
    product_view: {
      area: "Strategic priorities",
      judgment: "The old judgment should no longer be shown.",
      change: "The retired update should be hidden.",
      confidence: "Medium",
      falsifier: "Withdraw the judgment if volumes decline.",
    },
  });
  const { html } = render(c);
  assert.match(html, /Perpetual futures venues are competing for sustained order flow/);
  assert.ok(!html.includes("product-view"));
  assert.ok(!html.includes("The old judgment should no longer be shown"));
  assert.ok(!html.includes("Withdraw the judgment"));
});

test("Uses one heading per section", () => {
  const c = baseContent();
  c.sections[0].kicker = "Repeated headline";
  const { html } = render(c);
  assert.ok(!html.includes("Repeated headline"));
  assert.ok(!html.includes("sec-kicker"));
});

test("Escapes metric context", () => {
  const c = baseContent();
  c.sections[0].items[0].context = { label: "Scale", text: "About <10% of reported volume came from this venue." };
  const { html } = render(c);
  assert.match(html, /<p class="item-context">/);
  assert.match(html, /Scale/);
  assert.match(html, /About &lt;10%/);
});

test("Links to additional sources", () => {
  const c = baseContent();
  c.sections[0].items[0].references = [
    { source: "Independent confirmation", url: "https://example.com/b", date: "2026-06-22" },
  ];
  const { html } = render(c);
  assert.match(html, /Additional source: Independent confirmation · 06-22 ↗/);
  assert.match(html, /href="https:\/\/example\.com\/b"/);
});

test("Rejects malformed JSON", () => {
  const inP = join(dir, "bad.json");
  writeFileSync(inP, "{ not json");
  const r = run(["lib/build-html.mjs", inP, join(dir, "x.html")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /Rendering failed/);
});

test("Handles missing sections", () => {
  const c = baseContent(); delete c.sections;
  const { code } = render(c);
  assert.equal(code, 0);
});

test("Includes a date and source for each development", () => {
  const c = baseContent({
    threads: [{
      title: "New wallet distribution routes",
      since: "2026-06-01",
      day_n: 23,
      tier: "A",
      status: "active",
      date: "2026-06-23",
      source: "Official announcement",
      url: "https://example.com/thread",
      update: "The wallet introduced a derivatives trading interface.",
      watch: "Monitor the resulting order flow.",
    }],
  });
  const { html } = render(c);
  assert.match(html, />Latest developments</);
  assert.ok(!html.includes(">Continuous tracking<"));
  assert.match(html, /Official announcement ↗/);
  assert.match(html, /2026-06-23/);
});

test("Preserves section order and single-paragraph bodies in v2", () => {
  const item = baseContent().sections[0].items[0];
  const headline = "Trasia connects Asian trading communities to Hyperliquid through its mobile app";
  const c = baseContent({
    editorial_version: 2,
    sections: [
      { id: "distribution", title: "Trading access and user growth", items: [{ ...item, headline, body: ["The venue draws liquidity from a shared order book.", "Traders place orders through the mobile app."] }] },
      { id: "ai", title: "Trading tools", items: [{ ...item, headline: "Tool launch", body: "A new tool entered public beta." }] },
      { id: "perpdex", title: "Market structure", items: [{ ...item, headline: "Market update", body: "The venue revised its margin rules." }] },
    ],
  });
  const { code, html } = render(c);
  assert.equal(code, 0);
  assert.ok(html.indexOf('sec-distribution"') < html.indexOf('sec-ai"'));
  assert.ok(html.indexOf('sec-ai"') < html.indexOf('sec-perpdex"'));
  assert.ok(html.includes(`<h3 class="item-h">${headline}</h3>`));
  assert.ok(html.includes('<p class="item-b">The venue draws liquidity from a shared order book. Traders place orders through the mobile app.</p>'));
  assert.equal((html.match(/<p class="item-b">/g) || []).length, 3);
  assert.ok(!html.includes('<span class="source-date">'));
  assert.ok(!html.includes('<span class="item-date">'));
  assert.match(html, /title="S · Published 2026-06-23"/);
});

test("Hides internal research and context", () => {
  const c = baseContent({
    editorial_version: 2,
    threads: [{ title: "Internal thread title", update: "Internal account update", watch: "Internal review reminder" }],
  });
  Object.assign(c.sections[0].items[0], {
    kind: "research",
    body: "Each position draws collateral from a dedicated margin account.",
    date: null,
    checked_at: "2026-06-23",
    context: { label: "Scope", text: "Recorded internal context" },
    research: {
      project: "Internal project name", category: "perp-protocol",
      why_now: "Internal selection rationale", mechanism: "Internal mechanism evidence", gtm: "Internal distribution evidence",
      product: "Internal product evidence", implication: "Internal inference", unknowns: "Unresolved internal question",
      discussions: [], discussion_gap: "Original discussion was unavailable",
    },
  });
  const { html } = render(c);
  for (const value of ["Internal thread title", "Internal account update", "Internal review reminder", "Recorded internal context", "Internal project name", "Internal selection rationale", "Internal mechanism evidence", "Internal distribution evidence", "Internal product evidence", "Internal inference", "Unresolved internal question", "Original discussion was unavailable"]) {
    assert.ok(!html.includes(value), value);
  }
  assert.ok(!html.includes('<section class="threads">'));
  assert.ok(!html.includes('<p class="item-context">'));
  assert.ok(!html.includes('<dl class="research-details">'));
  assert.ok(!html.includes('<div class="research-meta">'));
  assert.ok(html.includes("publication date unavailable · Verified 2026-06-23"));
});

test("Deduplicates discussion links", () => {
  const c = baseContent({ editorial_version: 2 });
  c.sections = [{ id: "distribution", title: "Trading access", items: [{
    ...c.sections[0].items[0],
    references: [{ source: "Project interviews", url: "https://example.com/shared", date: "2026-06-22" }],
    research: { discussions: [
      { speaker: "Project spokesperson", affiliation: "official", summary: "Internal interview summary", url: "https://example.com/shared", date: "2026-06-22" },
      { speaker: "Independent author<Ace>", affiliation: "independent", summary: "Internal independent assessment", url: "https://example.net/discussion", date: "2026-06-23" },
      { speaker: "Invalid source", affiliation: "unknown", summary: "Invalid source summary", url: "javascript:alert(1)", date: "2026-06-23" },
    ] },
  }] }];
  const { html } = render(c);
  assert.equal((html.match(/href="https:\/\/example\.com\/shared"/g) || []).length, 1);
  assert.ok(html.includes('href="https://example.net/discussion"'));
  assert.ok(html.includes("Independent author&lt;Ace&gt; (Independent analysis) · Published 2026-06-23"));
  assert.ok(html.includes("Project interviews · Published 2026-06-22; Project spokesperson (Official) · Published 2026-06-22"));
  assert.ok(!html.includes("Internal interview summary"));
  assert.ok(!html.includes("Internal independent assessment"));
  assert.ok(!html.includes('href="javascript:'));
});

test("Preserves accessible details on eight numbered sources", () => {
  const c = baseContent({ editorial_version: 2 });
  const longName = 'Official source with "quotes" and <brackets>'.repeat(4);
  c.sections = [{ id: "distribution", title: "Trading access", items: [{
    ...c.sections[0].items[0], kind: "research", source: longName, date: null, checked_at: "2026-06-23",
    references: Array.from({ length: 3 }, (_, index) => ({
      source: `Reference ${index + 1}`, url: `https://example.com/reference-${index + 1}`,
      date: "2026-05-01", checked_at: "2026-06-23",
    })),
    research: { discussions: Array.from({ length: 4 }, (_, index) => ({
      speaker: `Author ${index + 1}`, affiliation: index === 0 ? "sponsored" : "independent",
      summary: "Internal discussion notes", url: `https://example.net/discussion-${index + 1}`, date: "2026-06-22",
    })) },
  }] }];
  const { html } = render(c);
  const row = html.match(/<div class="item-meta compact-sources">([\s\S]*?)<\/div>/)?.[1] || "";
  const links = [...row.matchAll(/<a class="source-number"[^>]*href="([^"]+)"[^>]*>(\d+)<\/a>/g)];
  assert.deepEqual(links.map((match) => match[2]), ["1", "2", "3", "4", "5", "6", "7", "8"]);
  assert.deepEqual(links.map((match) => match[1]), [
    "https://example.com/a",
    ...Array.from({ length: 3 }, (_, index) => `https://example.com/reference-${index + 1}`),
    ...Array.from({ length: 4 }, (_, index) => `https://example.net/discussion-${index + 1}`),
  ]);
  assert.equal(row.replace(/<[^>]+>/g, "").replace(/\s+/g, ""), "Sources12345678");
  assert.match(row, /title="Official source with &quot;quotes&quot; and &lt;brackets&gt;/);
  assert.match(row, /aria-label="Source 1:[^"]+publication date unavailable · Verified 2026-06-23"/);
  assert.match(row, /aria-label="Source 2: Reference 1 · Published 2026-05-01 · Verified 2026-06-23"/);
  assert.match(row, /aria-label="Source 5: Author 1 \(Sponsored\) · Published 2026-06-22"/);
  assert.match(html, /\.item-meta\.compact-sources\{display:inline-flex; flex-wrap:nowrap; gap:8px;/);
  assert.match(html, /white-space:nowrap;/);
});

test("Keeps the legacy section order", () => {
  const c = baseContent();
  c.sections.reverse();
  const { html } = render(c);
  assert.ok(html.indexOf('sec-perpdex"') < html.indexOf('sec-launchpad"'));
  assert.ok(html.indexOf('sec-launchpad"') < html.indexOf('sec-crypto"'));
  assert.ok(html.indexOf('sec-crypto"') < html.indexOf('sec-ai"'));
});

test("renders the Chinese edition with a localized masthead, attribution and accessible sources", () => {
  const c = baseContent({ editorial_version: 2, lead: "两家交易所公布新的保证金规则。", edition: 144 });
  c.sections[0].items[0].source = "官方公告";
  const { code, html } = render(c);
  assert.equal(code, 0);
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>Perp DEX 日报 · 2026-06-23<\/title>/);
  assert.match(html, /第 144 期/);
  assert.match(html, /2026年6月23日 · 星期二/);
  assert.match(html, /aria-label="来源 1：官方公告 · 发布 2026-06-23"/);
  assert.match(html, /Doris 开发与维护/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run, baseContent } from "./_helpers.mjs";

const dir = mkdtempSync(join(tmpdir(), "bh-"));
let n = 0;
// 渲染并返回 {code, html}
function render(content) {
  const inP = join(dir, `c${n}.json`);
  const outP = join(dir, `o${n++}.html`);
  writeFileSync(inP, JSON.stringify(content));
  const r = run(["lib/build-html.mjs", inP, outP]);
  let html = "";
  try { html = readFileSync(outP, "utf8"); } catch {}
  return { code: r.code, html, out: r.out };
}

test("合法 content 渲染成功且含标题", () => {
  const { code, html } = render(baseContent());
  assert.equal(code, 0);
  assert.match(html, /标题/);
});

test("HTML 特殊字符被转义（防 XSS）", () => {
  const c = baseContent();
  c.sections[0].items[0].headline = '<script>alert(1)</script>';
  const { html } = render(c);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("javascript: 链接不被渲染进 href", () => {
  const c = baseContent();
  c.sections[0].items[0].url = "javascript:alert(1)";
  const { html } = render(c);
  assert.ok(!/href="javascript:/i.test(html));
});

test("渲染器不再为旧产品判断栏隐藏日期", () => {
  const c = baseContent();
  c.sections = [{ id: "hertzflow", title: "产品判断", items: [
    { decision_area: "战略优先级", headline: "洞察", body: ["x"], url: "https://x.com/p", date: "2026-05-01" },
  ] }];
  const { html } = render(c);
  const seg = (html.match(/<section class="sec sec-hertzflow">[\s\S]*?<\/section>/) || [""])[0];
  assert.ok(seg.includes("item-date"));
  assert.ok(seg.includes("2026-05-01"));
  assert.ok(!seg.includes("decision-area"));
});

test("顶部只渲染一句市场概括，不渲染 product_view 卡片", () => {
  const c = baseContent({
    product_view: {
      area: "战略优先级",
      judgment: "旧判断不应再显示。",
      change: "旧变化不应再显示。",
      confidence: "中",
      falsifier: "旧证伪条件不应再显示。",
    },
  });
  const { html } = render(c);
  assert.match(html, /近期永续市场的竞争正在从扩充标的数量/);
  assert.ok(!html.includes("product-view"));
  assert.ok(!html.includes("旧判断不应再显示"));
  assert.ok(!html.includes("证伪条件："));
});

test("栏目只渲染一级标题，不渲染 kicker", () => {
  const c = baseContent();
  c.sections[0].kicker = "重复副标题";
  const { html } = render(c);
  assert.ok(!html.includes("重复副标题"));
  assert.ok(!html.includes("sec-kicker"));
});

test("数字量级说明渲染为次级提示且会转义", () => {
  const c = baseContent();
  c.sections[0].items[0].context = { label: "量级参照", text: "约占 <10%，不应被解读成行业格局反转。" };
  const { html } = render(c);
  assert.match(html, /<p class="item-context">/);
  assert.match(html, /量级参照/);
  assert.match(html, /约占 &lt;10%/);
});

test("补充来源渲染为独立可核查链接", () => {
  const c = baseContent();
  c.sections[0].items[0].references = [
    { source: "交叉验证", url: "https://example.com/b", date: "2026-06-22" },
  ];
  const { html } = render(c);
  assert.match(html, /补充：交叉验证 · 06-22 ↗/);
  assert.match(html, /href="https:\/\/example\.com\/b"/);
});

test("损坏 JSON → 干净报错退出 1（不崩栈）", () => {
  const inP = join(dir, "bad.json");
  writeFileSync(inP, "{ not json");
  const r = run(["lib/build-html.mjs", inP, join(dir, "x.html")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /渲染失败/);
});

test("缺 sections → 不崩溃（兜底渲染）", () => {
  const c = baseContent(); delete c.sections;
  const { code } = render(c);
  assert.equal(code, 0);
});

test("今日进展展示新 delta 的日期与来源，不再使用持续追踪标题", () => {
  const c = baseContent({
    threads: [{
      title: "钱包分发出现新变化",
      since: "2026-06-01",
      day_n: 23,
      tier: "A",
      status: "active",
      date: "2026-06-23",
      source: "官方公告",
      url: "https://example.com/thread",
      update: "钱包新增嵌入式衍生品入口。",
      watch: "观察订单流归属。",
    }],
  });
  const { html } = render(c);
  assert.match(html, />今日进展</);
  assert.ok(!html.includes(">持续追踪<"));
  assert.match(html, /官方公告 ↗/);
  assert.match(html, /2026-06-23/);
});

test("v2 动态栏目遵循输入顺序，完整标题与正文只渲染一段", () => {
  const item = baseContent().sections[0].items[0];
  const headline = "Trasia 通过亚洲交易员社区与移动端引导新用户使用 Hyperliquid 的现有流动性";
  const c = baseContent({
    editorial_version: 2,
    sections: [
      { id: "distribution", title: "交易入口与用户增长", items: [{ ...item, headline, body: ["第一句说明现有流动性的来源。", "第二句说明新增用户路径。"] }] },
      { id: "ai", title: "交易工具", items: [{ ...item, headline: "工具标题", body: "工具正文。" }] },
      { id: "perpdex", title: "市场机制", items: [{ ...item, headline: "市场标题", body: "市场正文。" }] },
    ],
  });
  const { code, html } = render(c);
  assert.equal(code, 0);
  assert.ok(html.indexOf('sec-distribution"') < html.indexOf('sec-ai"'));
  assert.ok(html.indexOf('sec-ai"') < html.indexOf('sec-perpdex"'));
  assert.ok(html.includes(`<h3 class="item-h">${headline}</h3>`));
  assert.ok(html.includes('<p class="item-b">第一句说明现有流动性的来源。 第二句说明新增用户路径。</p>'));
  assert.equal((html.match(/<p class="item-b">/g) || []).length, 3);
  assert.ok(!html.includes('<span class="source-date">'));
  assert.ok(!html.includes('<span class="item-date">'));
  assert.match(html, /title="S · 发布 2026-06-23"/);
});

test("v2 隐藏内部研究结构、context 和重复的今日进展", () => {
  const c = baseContent({
    editorial_version: 2,
    threads: [{ title: "内部台账标题", update: "内部台账增量", watch: "内部台账待查" }],
  });
  Object.assign(c.sections[0].items[0], {
    kind: "research",
    body: "这段正文已经包含读者需要的产品事实和分析。",
    date: null,
    checked_at: "2026-06-23",
    context: { label: "影响范围", text: "内部context内容不能另起小块" },
    research: {
      project: "内部重复项目名", category: "perp-protocol",
      why_now: "内部选题理由", mechanism: "内部机制证据", gtm: "内部增长证据",
      product: "内部产品证据", implication: "内部推断", unknowns: "内部未知项",
      discussions: [], discussion_gap: "内部讨论访问缺口",
    },
  });
  const { html } = render(c);
  for (const value of ["内部台账标题", "内部台账增量", "内部台账待查", "内部context内容", "内部重复项目名", "内部选题理由", "内部机制证据", "内部增长证据", "内部产品证据", "内部推断", "内部未知项", "内部讨论访问缺口"]) {
    assert.ok(!html.includes(value), value);
  }
  assert.ok(!html.includes('<section class="threads">'));
  assert.ok(!html.includes('<p class="item-context">'));
  assert.ok(!html.includes('<dl class="research-details">'));
  assert.ok(!html.includes('<div class="research-meta">'));
  assert.ok(html.includes("未标发布日期 · 核验 2026-06-23"));
});

test("v2 讨论原文保留为去重的来源链接，不显示内部讨论摘要", () => {
  const c = baseContent({ editorial_version: 2 });
  c.sections = [{ id: "distribution", title: "交易入口", items: [{
    ...c.sections[0].items[0],
    references: [{ source: "项目访谈", url: "https://example.com/shared", date: "2026-06-22" }],
    research: { discussions: [
      { speaker: "已列访谈作者", affiliation: "official", summary: "这段内部摘要不应出现在页面", url: "https://example.com/shared", date: "2026-06-22" },
      { speaker: "独立作者<甲>", affiliation: "independent", summary: "另一段内部讨论摘要也不显示", url: "https://example.net/discussion", date: "2026-06-23" },
      { speaker: "无效来源", affiliation: "unknown", summary: "不可信", url: "javascript:alert(1)", date: "2026-06-23" },
    ] },
  }] }];
  const { html } = render(c);
  assert.equal((html.match(/href="https:\/\/example\.com\/shared"/g) || []).length, 1);
  assert.ok(html.includes('href="https://example.net/discussion"'));
  assert.ok(html.includes("独立作者&lt;甲&gt;（独立讨论） · 发布 2026-06-23"));
  assert.ok(html.includes("项目访谈 · 发布 2026-06-22；已列访谈作者（官方） · 发布 2026-06-22"));
  assert.ok(!html.includes("内部摘要"));
  assert.ok(!html.includes("内部讨论摘要"));
  assert.ok(!html.includes('href="javascript:'));
});

test("v2 八个来源完整编号一行展示，长名称与核验信息只放可访问属性", () => {
  const c = baseContent({ editorial_version: 2 });
  const longName = '很长的官方来源名称"包含引号"与<特殊字符>'.repeat(4);
  c.sections = [{ id: "distribution", title: "交易入口", items: [{
    ...c.sections[0].items[0], kind: "research", source: longName, date: null, checked_at: "2026-06-23",
    references: Array.from({ length: 3 }, (_, index) => ({
      source: `补充来源${index + 1}`, url: `https://example.com/reference-${index + 1}`,
      date: "2026-05-01", checked_at: "2026-06-23",
    })),
    research: { discussions: Array.from({ length: 4 }, (_, index) => ({
      speaker: `作者${index + 1}`, affiliation: index === 0 ? "sponsored" : "independent",
      summary: "内部讨论证据不作为正文展开", url: `https://example.net/discussion-${index + 1}`, date: "2026-06-22",
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
  assert.equal(row.replace(/<[^>]+>/g, "").replace(/\s+/g, ""), "来源12345678");
  assert.match(row, /title="很长的官方来源名称&quot;包含引号&quot;与&lt;特殊字符&gt;/);
  assert.match(row, /aria-label="来源 1：[^"]+未标发布日期 · 核验 2026-06-23"/);
  assert.match(row, /aria-label="来源 2：补充来源1 · 发布 2026-05-01 · 核验 2026-06-23"/);
  assert.match(row, /aria-label="来源 5：作者1（赞助内容） · 发布 2026-06-22"/);
  assert.match(html, /\.item-meta\.compact-sources\{display:inline-flex; flex-wrap:nowrap; gap:8px;/);
  assert.match(html, /white-space:nowrap;/);
});

test("v1 归档继续使用既有栏目顺序", () => {
  const c = baseContent();
  c.sections.reverse();
  const { html } = render(c);
  assert.ok(html.indexOf('sec-perpdex"') < html.indexOf('sec-launchpad"'));
  assert.ok(html.indexOf('sec-launchpad"') < html.indexOf('sec-crypto"'));
  assert.ok(html.indexOf('sec-crypto"') < html.indexOf('sec-ai"'));
});

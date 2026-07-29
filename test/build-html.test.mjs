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

test("产品判断栏(hertzflow)不渲染日期", () => {
  const c = baseContent();
  c.sections = [{ id: "hertzflow", title: "产品判断", items: [
    { decision_area: "战略优先级", headline: "洞察", body: ["x"], url: "https://x.com/p", date: "2026-05-01" },
  ] }];
  const { html } = render(c);
  const seg = (html.match(/<section class="sec sec-hertzflow">[\s\S]*?<\/section>/) || [""])[0];
  assert.ok(!seg.includes("item-date"));
  assert.ok(!seg.includes("2026-05-01"));
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

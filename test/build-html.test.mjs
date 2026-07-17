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

test("启发栏(hertzflow)不渲染日期", () => {
  const c = baseContent();
  c.sections = [{ id: "hertzflow", title: "启发", items: [
    { headline: "洞察", body: ["x"], url: "https://x.com/p", date: "2026-05-01" },
  ] }];
  const { html } = render(c);
  const seg = (html.match(/<section class="sec sec-hertzflow">[\s\S]*?<\/section>/) || [""])[0];
  assert.ok(!seg.includes("item-date"));
  assert.ok(!seg.includes("2026-05-01"));
});

test("数字量级说明渲染为次级提示且会转义", () => {
  const c = baseContent();
  c.sections[0].items[0].context = { label: "量级参照", text: "约占 <10%，不应被解读成行业格局反转。" };
  const { html } = render(c);
  assert.match(html, /<p class="item-context">/);
  assert.match(html, /量级参照/);
  assert.match(html, /约占 &lt;10%/);
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

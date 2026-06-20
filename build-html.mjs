#!/usr/bin/env node
// build-html.mjs — 把日报内容 JSON 渲染成极简杂志风格的单文件 HTML
// 用法: node build-html.mjs <content.json> [out.html]
// 无外部依赖（Node 18+ 内置）。

import { readFileSync, writeFileSync } from "node:fs";

const inPath = process.argv[2] || "content.json";
const data = JSON.parse(readFileSync(inPath, "utf8"));
const outPath = process.argv[3] || `out/perp-daily-${data.date}.html`;

const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// 栏目顺序：Perp DEX 第一，再 Launchpad、Crypto、AI，最后「对 Hertzflow 的启发」(CEO 视角收尾)
const order = { perpdex: 0, launchpad: 1, crypto: 2, ai: 3, hertzflow: 4 };
const sections = [...data.sections].sort(
  (a, b) => (order[a.id] ?? 9) - (order[b.id] ?? 9)
);

const renderItem = (it) => `
        <article class="item">
          <h3 class="item-h">${esc(it.headline)}</h3>
          <p class="item-b">${esc(it.body)}</p>
          <div class="item-meta">
            ${it.date ? `<span class="item-date">${esc(it.date)}</span>` : ""}
            ${
              it.url
                ? `<a class="item-src" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.source || "来源")} ↗</a>`
                : it.source
                ? `<span class="item-src">${esc(it.source)}</span>`
                : ""
            }
          </div>
        </article>`;

const renderSection = (s, idx) => `
      <section class="sec sec-${esc(s.id)}">
        <div class="sec-head">
          <span class="sec-no">${String(idx + 1).padStart(2, "0")}</span>
          <div>
            ${s.kicker ? `<div class="sec-kicker">${esc(s.kicker)}</div>` : ""}
            <h2 class="sec-title">${esc(s.title)}</h2>
          </div>
        </div>
        <div class="sec-body">
          ${(s.items || []).map(renderItem).join("")}
        </div>
      </section>`;

const dateCN = (() => {
  const d = new Date(data.date + "T00:00:00");
  const wd = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${wd}`;
})();

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Perp DEX 日报 · ${esc(data.date)}</title>
<style>
  :root{ --ink:#16140f; --paper:#fbfaf6; --muted:#a3987f; }
  *{box-sizing:border-box; margin:0; padding:0;}
  body{
    background:#f4f1ea; color:#16140f;
    font-family:"Songti SC","Noto Serif SC",Georgia,"Times New Roman",serif;
    line-height:1.7; padding:48px 16px; -webkit-font-smoothing:antialiased;
  }
  .mag{max-width:720px; margin:0 auto; background:#fbfaf6;
    border:1px solid #e4ded0; padding:56px 56px 64px; }
  /* 报头 */
  .masthead{border-bottom:3px double #16140f; padding-bottom:20px; margin-bottom:8px;}
  .mast-row{display:flex; justify-content:space-between; align-items:baseline;
    font-family:-apple-system,"PingFang SC",sans-serif; font-size:12px;
    letter-spacing:.08em; color:#6b6655; text-transform:uppercase;}
  .mast-title{font-size:44px; font-weight:800; letter-spacing:-.01em;
    margin:14px 0 6px; line-height:1.05;}
  .mast-sub{font-family:-apple-system,"PingFang SC",sans-serif; font-size:13px;
    color:#6b6655; letter-spacing:.03em;}
  /* 导语 */
  .lead{font-size:18px; line-height:1.85; color:#2c2820;
    padding:28px 0 8px; border-bottom:1px solid #e4ded0; margin-bottom:8px;}
  .lead::first-letter{font-size:30px; font-weight:700;}
  /* 章节 */
  .sec{padding:34px 0; border-bottom:1px solid #ece6d8;}
  .sec:last-child{border-bottom:none; padding-bottom:8px;}
  .sec-head{display:flex; gap:18px; align-items:flex-start; margin-bottom:18px;}
  .sec-no{font-family:-apple-system,"PingFang SC",sans-serif; font-size:13px;
    font-weight:700; color:#b03a2e; border:1.5px solid #b03a2e; border-radius:50%;
    width:30px; height:30px; display:flex; align-items:center; justify-content:center;
    flex:0 0 30px; margin-top:4px;}
  .sec-kicker{font-family:-apple-system,"PingFang SC",sans-serif; font-size:11px;
    letter-spacing:.14em; text-transform:uppercase; color:#a3987f;}
  .sec-title{font-size:27px; font-weight:800; letter-spacing:-.01em; line-height:1.2;}
  .sec-perpdex .sec-title{color:#b03a2e;}
  .sec-launchpad .sec-title{color:#1f7a5a;}
  /* 「对 Hertzflow 的启发」做成醒目的主编批注卡片 */
  .sec-hertzflow{background:#faf7ef; border:1px solid #ecdfbf; border-radius:8px;
    padding:24px 28px 16px; margin-top:36px; border-bottom:1px solid #ecdfbf;}
  .sec-hertzflow .sec-title{color:#9a7b1f;}
  .sec-hertzflow .sec-no{color:#9a7b1f; border-color:#9a7b1f;}
  .sec-hertzflow .item-b{color:#3a3322;}
  .item{padding:14px 0 16px; border-bottom:1px dotted #ddd6c6;}
  .item:last-child{border-bottom:none;}
  .item-h{font-size:19px; font-weight:700; line-height:1.45; margin-bottom:6px;}
  .item-b{font-size:15.5px; color:#403a2e; line-height:1.8;}
  .item-meta{margin-top:9px; display:flex; align-items:center; flex-wrap:wrap; gap:8px;
    font-family:-apple-system,"PingFang SC",sans-serif; font-size:12px; letter-spacing:.03em;}
  .item-date{color:#b03a2e; font-weight:600; font-variant-numeric:tabular-nums;
    border:1px solid #e8d6d2; border-radius:3px; padding:1px 6px;}
  .item-src{color:#8a7f66; text-decoration:none;}
  a.item-src:hover{color:#b03a2e;}
  .foot{margin-top:40px; padding-top:18px; border-top:3px double #16140f;
    font-family:-apple-system,"PingFang SC",sans-serif; font-size:11px;
    letter-spacing:.06em; color:#a3987f; text-align:center;}
  @media(max-width:560px){ .mag{padding:32px 22px 40px;} .mast-title{font-size:32px;} }
</style>
</head>
<body>
  <main class="mag">
    <header class="masthead">
      <div class="mast-row">
        <span>每日链上观察</span><span>第 ${esc(String(data.edition || 1))} 期</span>
      </div>
      <h1 class="mast-title">PERP DEX 日报</h1>
      <div class="mast-sub">${dateCN}</div>
    </header>
    ${data.lead ? `<p class="lead">${esc(data.lead)}</p>` : ""}
    ${sections.map(renderSection).join("")}
    <footer class="foot">PERP DEX DAILY · 自动生成 · 仅供参考，非投资建议</footer>
  </main>
</body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log(outPath);

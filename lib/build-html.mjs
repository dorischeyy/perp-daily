#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { publicSectionId } from "./legacy-section.mjs";
import { reportCopy } from "./edition-copy.mjs";
import { isHttpUrl, isIsoDate } from "./research.mjs";

const inPath = process.argv[2] || "content.json";
let data;
try {
  data = JSON.parse(readFileSync(inPath, "utf8"));
} catch (e) {
  console.error(`Rendering failed for ${inPath}: ${e.message}`);
  process.exit(1);
}

if (!data || typeof data !== "object") { console.error("Edition content must be an object."); process.exit(1); }
if (!Array.isArray(data.sections)) data.sections = [];
if (!isIsoDate(data.date)) {
  data.date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}
const outPath = process.argv[3] || `out/perp-daily-${data.date}.html`;
const compactEdition = data.editorial_version === 2;
const copy = reportCopy(data);

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const safeUrl = (u) => (isHttpUrl(u) ? u : "");

const mdInline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
const renderBody = (body) => {
  const parts = Array.isArray(body) ? body : String(body || "").split(/\n+/);
  const paragraphs = parts.map((p) => String(p).trim()).filter(Boolean);

  if (compactEdition) return paragraphs.length ? `<p class="item-b">${mdInline(paragraphs.join(" "))}</p>` : "";
  return paragraphs
    .map((p) => `<p class="item-b">${mdInline(p)}</p>`)
    .join("");
};

const renderContext = (context) => {
  if (!context || typeof context !== "object" || typeof context.text !== "string" || !context.text.trim()) return "";
  const label = typeof context.label === "string" && context.label.trim() ? context.label.trim() : copy.scale;
  return `<p class="item-context"><span class="item-context-label">${esc(label)}</span>${mdInline(context.text.trim())}</p>`;
};

const renderCompactSources = (it) => {
  const sources = new Map();
  const addSource = (source, name) => {
    const url = safeUrl(source?.url);
    if (!url) return;
    const details = [
      name || copy.source,
      source.date ? `${copy.published} ${source.date}` : copy.undated,
      ...(source.checked_at ? [`${copy.verified} ${source.checked_at}`] : []),
    ].join(" · ");
    if (!sources.has(url)) sources.set(url, new Set());
    sources.get(url).add(details);
  };
  addSource(it, it.source);
  for (const ref of Array.isArray(it.references) ? it.references : []) addSource(ref, ref?.source);
  for (const discussion of Array.isArray(it.research?.discussions) ? it.research.discussions : []) {
    const affiliation = copy.affiliations[discussion?.affiliation] || copy.affiliations.unknown;
    addSource(discussion, copy.byline(discussion?.speaker || copy.discussionSource, affiliation));
  }
  if (!sources.size) return "";
  return `<span class="source-label">${copy.sources}</span>${[...sources].map(([url, descriptions], index) => {
    const details = [...descriptions].join(copy.separator);
    return `<a class="source-number" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(details)}" aria-label="${esc(copy.sourceLabel(index + 1, details))}">${index + 1}</a>`;
  }).join("")}`;
};

const renderSources = (it) => {
  if (compactEdition) return renderCompactSources(it);
  const links = [];
  const primary = safeUrl(it.url);
  const researchDates = (source) => ` · ${source.date ? `${copy.published} ${source.date}` : copy.undated} · ${copy.verified} ${source.checked_at || copy.unrecorded}`;
  const primaryDates = it.kind === "research" ? researchDates(it) : "";
  if (primary) links.push(`<a class="item-src" href="${esc(primary)}" target="_blank" rel="noopener">${esc(it.source || copy.source)}${esc(primaryDates)} ↗</a>`);
  else if (it.source) links.push(`<span class="item-src">${esc(it.source)}</span>`);
  for (const ref of Array.isArray(it.references) ? it.references : []) {
    const url = safeUrl(ref?.url);
    const date = it.kind === "research" ? researchDates(ref || {}) : (typeof ref?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ref.date) ? ` · ${ref.date.slice(5)}` : "");
    if (url) links.push(`<a class="item-src item-ref" href="${esc(url)}" target="_blank" rel="noopener">${copy.additionalSource}${esc(ref.source || copy.source)}${esc(date)} ↗</a>`);
  }
  return links.join("");
};

const renderResearch = (it) => {
  const research = it.research || {};
  const details = [
    [copy.selection, research.why_now],
    [copy.mechanism, research.mechanism],
    [copy.gtm, research.gtm],
    [copy.product, research.product],
  ].map(([label, value]) => `<div class="research-row"><dt>${esc(label)}</dt><dd>${mdInline(value || copy.unrecorded)}</dd></div>`).join("");
  const discussions = Array.isArray(research.discussions) ? research.discussions : [];
  const discussion = discussions.length
    ? `<div class="research-row"><dt>${copy.discussion}</dt><dd><ul class="research-discussions">${discussions.map((entry) => {
      const url = safeUrl(entry?.url);
      const speaker = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(entry?.speaker || copy.unrecorded)}</a>` : esc(entry?.speaker || copy.unrecorded);
      return `<li><span class="discussion-meta">${speaker} · ${esc(copy.affiliations[entry?.affiliation] || copy.affiliations.unknown)} · ${esc(entry?.date || copy.undated)}</span><p>${mdInline(entry?.summary || "")}</p></li>`;
    }).join("")}</ul></dd></div>`
    : `<div class="research-row"><dt>${copy.gap}</dt><dd>${mdInline(research.discussion_gap || copy.unrecorded)}</dd></div>`;
  return `<div class="research-meta">${copy.research} · ${esc(copy.categories[research.category] || copy.unclassified)} · ${copy.verifiedOn} ${esc(it.checked_at || copy.unrecorded)}</div>
          <p class="research-project">${esc(research.project || "")}</p>
          <dl class="research-details">${details}${discussion}<div class="research-row research-inference"><dt>${copy.interpretation}</dt><dd>${mdInline(research.implication || copy.unrecorded)}</dd></div><div class="research-row"><dt>${copy.unconfirmed}</dt><dd>${mdInline(research.unknowns || copy.unrecorded)}</dd></div></dl>`;
};

const renderThreads = (threads) => {
  if (!Array.isArray(threads) || !threads.length) return "";
  const row = (t) => {
    const url = safeUrl(t.url);
    const source = t.source
      ? (url
          ? `<a class="thread-src" href="${esc(url)}" target="_blank" rel="noopener">${esc(t.source)} ↗</a>`
          : `<span class="thread-src">${esc(t.source)}</span>`)
      : "";
    return `
        <div class="thread">
          <div class="thread-t">${esc(t.title)}</div>
          <div class="thread-meta">${copy.since} ${esc(t.since || "")}${t.day_n ? ` · ${esc(copy.day(t.day_n))}` : ""}${t.tier ? ` · ${esc(copy.tier(t.tier))}` : ""}${t.status && t.status !== "active" ? ` · ${esc(t.status)}` : ""}</div>
          ${t.update ? `<div class="thread-u">${mdInline(t.update)}</div>` : ""}
          ${(t.date || source) ? `<div class="thread-source">${t.date ? esc(t.date) : ""}${t.date && source ? " · " : ""}${source}</div>` : ""}
          ${t.watch ? `<div class="thread-w"><b>${copy.next}</b> ${esc(t.watch)}</div>` : ""}
        </div>`;
  };
  return `
    <section class="threads">
      <div class="threads-h">${copy.developments}</div>
      ${threads.map(row).join("")}
    </section>`;
};

const order = { perpdex: 0, launchpad: 1, crypto: 2, ai: 3 };
const sections = compactEdition
  ? [...data.sections]
  : [...data.sections].sort((a, b) => (order[a.id] ?? 9) - (order[b.id] ?? 9));

const renderItem = (it) => `
        <article class="item${!compactEdition && it.kind === "research" ? " item-research" : ""}">
          <h3 class="item-h">${esc(it.headline)}</h3>
          ${renderBody(it.body)}
          ${!compactEdition && it.kind === "research" ? renderResearch(it) : ""}
          ${compactEdition ? "" : renderContext(it.context)}
          <div class="item-meta${compactEdition ? " compact-sources" : ""}">
            ${!compactEdition && it.date && it.kind !== "research" ? `<span class="item-date">${esc(it.date)}</span>` : ""}
            ${renderSources(it)}
          </div>
        </article>`;

const renderSection = (s, idx) => {
  const sectionId = publicSectionId(s, data.editorial_version);
  const title = sectionId === "legacy-product-view" ? copy.productObservations : s.title;
  return `
      <section class="sec sec-${esc(sectionId)}">
        <div class="sec-head">
          <span class="sec-no">${String(idx + 1).padStart(2, "0")}</span>
          <div>
            <h2 class="sec-title">${esc(title)}</h2>
          </div>
        </div>
        <div class="sec-body">
          ${(s.items || []).map((it) => renderItem(it)).join("")}
        </div>
      </section>`;
};

const date = new Date(`${data.date}T00:00:00Z`);
const editionDate = date.toLocaleDateString(copy.locale, { dateStyle: "long", timeZone: "UTC" });
const weekday = date.toLocaleDateString(copy.locale, { weekday: "long", timeZone: "UTC" });

const html = `<!doctype html>
<html lang="${copy.lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="${esc(copy.description)}" />
<title>${copy.name} · ${esc(data.date)}</title>
<style>
  :root{ --ink:#16140f; --paper:#fbfaf6; --muted:#a3987f; }
  *{box-sizing:border-box; margin:0; padding:0;}
  body{
    background:#f4f1ea; color:#16140f;
    font-family:${copy.lang === "zh-CN" ? '"Songti SC","Noto Serif SC",' : ""}Georgia,"Times New Roman",serif;
    line-height:1.7; padding:48px 16px; -webkit-font-smoothing:antialiased;
  }
  .mag{max-width:720px; margin:0 auto; background:#fbfaf6;
    border:1px solid #e4ded0; padding:56px 56px 64px; }

  .masthead{border-bottom:3px double #16140f; padding-bottom:20px; margin-bottom:8px;}
  .mast-row{display:flex; justify-content:space-between; align-items:baseline;
    font-family:-apple-system,sans-serif; font-size:12px;
    letter-spacing:.08em; color:#6b6655; text-transform:uppercase;}
  .mast-title{font-size:44px; font-weight:800; letter-spacing:-.01em;
    margin:14px 0 6px; line-height:1.05;}
  .mast-sub{font-family:-apple-system,sans-serif; font-size:13px;
    color:#6b6655; letter-spacing:.03em;}

  .lead{font-size:18px; line-height:1.85; color:#2c2820;
    padding:28px 0 8px; border-bottom:1px solid #e4ded0; margin-bottom:8px;}
  .lead::first-letter{font-size:30px; font-weight:700;}

  .threads{margin:22px 0 6px; padding:18px 22px 8px; background:#f7f4ec;
    border:1px solid #e4ded0; border-left:3px solid #b03a2e; border-radius:6px;}
  .threads-h{font-family:-apple-system,sans-serif; font-size:11px;
    letter-spacing:.16em; text-transform:uppercase; color:#b03a2e; font-weight:700; margin-bottom:12px;}
  .thread{padding:9px 0 11px; border-bottom:1px dotted #ddd6c6;}
  .thread:last-child{border-bottom:none;}
  .thread-t{font-size:16px; font-weight:700; color:#16140f; line-height:1.4;}
  .thread-meta{font-family:-apple-system,sans-serif; font-size:11px;
    color:#a3987f; letter-spacing:.04em; margin:2px 0 5px;}
  .thread-u{font-size:14.5px; color:#403a2e; line-height:1.72;}
  .thread-source{font-family:-apple-system,sans-serif; font-size:11px;
    color:#a3987f; margin-top:4px;}
  .thread-src{color:#8a7f66; text-decoration:none;}
  .thread-src:hover{color:#b03a2e;}
  .thread-w{font-family:-apple-system,sans-serif; font-size:12px;
    color:#8a7f66; margin-top:4px;}
  .thread-w b{color:#6b6655; font-weight:600;}

  .sec{padding:34px 0; border-bottom:1px solid #ece6d8;}
  .sec:last-child{border-bottom:none; padding-bottom:8px;}
  .sec-head{display:flex; gap:18px; align-items:flex-start; margin-bottom:18px;}
  .sec-no{font-family:-apple-system,sans-serif; font-size:13px;
    font-weight:700; color:#b03a2e; border:1.5px solid #b03a2e; border-radius:50%;
    width:30px; height:30px; display:flex; align-items:center; justify-content:center;
    flex:0 0 30px; margin-top:4px;}
  .sec-title{font-size:27px; font-weight:800; letter-spacing:-.01em; line-height:1.2;}
  .sec-perpdex .sec-title{color:#b03a2e;}
  .sec-launchpad .sec-title{color:#1f7a5a;}
  .item{padding:14px 0 16px; border-bottom:1px dotted #ddd6c6; min-width:0; overflow-wrap:anywhere;}
  .item:last-child{border-bottom:none;}
  .item-h{font-size:19px; font-weight:700; line-height:1.45; margin-bottom:6px;}
  .item-b{font-size:15.5px; color:#403a2e; line-height:1.8;}
  .item-b + .item-b{margin-top:7px;}
  .item-b strong{color:#16140f; font-weight:700;}
  .item-context{margin-top:9px; padding:7px 10px; background:#f7f4ec; border-left:2px solid #b03a2e;
    color:#6b6655; font-family:-apple-system,sans-serif; font-size:12.5px; line-height:1.65;}
  .item-context-label{color:#b03a2e; font-weight:700; margin-right:6px;}
  .item-meta{margin-top:9px; display:flex; align-items:center; flex-wrap:wrap; gap:8px;
    font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.03em;}
  .item-date{color:#b03a2e; font-weight:600; font-variant-numeric:tabular-nums;
    border:1px solid #e8d6d2; border-radius:3px; padding:1px 6px;}
  .item-meta.compact-sources{display:inline-flex; flex-wrap:nowrap; gap:8px; max-width:100%;
    white-space:nowrap; letter-spacing:0; line-height:1.5;}
  .source-label{color:#a3987f; flex:none;}
  .source-number{color:#8a7f66; text-decoration:underline; text-underline-offset:2px;
    min-width:14px; padding:2px 0; text-align:center; flex:none; font-variant-numeric:tabular-nums;}
  .source-number:hover,.source-number:focus-visible{color:#b03a2e;}
  .item-src{color:#8a7f66; text-decoration:none; min-width:0; overflow-wrap:anywhere;}
  .item-ref{color:#a3987f;}
  a.item-src:hover{color:#b03a2e;}
  .research-meta{font-family:-apple-system,sans-serif; font-size:11px; color:#b03a2e; margin-top:12px;}
  .research-project{font-size:15px; font-weight:700; margin:4px 0 8px;}
  .research-details{border-top:1px solid #e4ded0; font-size:14px; line-height:1.75;}
  .research-row{padding:8px 0; display:grid; grid-template-columns:104px minmax(0,1fr); gap:12px;}
  .research-row + .research-row{border-top:1px dotted #e4ded0;}
  .research-row dt{font-family:-apple-system,sans-serif; font-size:12px; font-weight:600; color:#6b6655;}
  .research-row dd{min-width:0; color:#403a2e;}
  .research-inference{background:#f7f4ec; padding:10px;}
  .research-discussions{list-style:none;}
  .research-discussions li + li{margin-top:8px;}
  .discussion-meta{font-family:-apple-system,sans-serif; font-size:11px; color:#8a7f66;}
  .discussion-meta a{color:#8a7f66; text-decoration:underline; overflow-wrap:anywhere;}
  .foot{margin-top:40px; padding-top:18px; border-top:3px double #16140f;
    font-family:-apple-system,sans-serif; font-size:11px;
    letter-spacing:.06em; color:#6b6655; text-align:center; line-height:1.8;}
  .foot a{color:inherit; text-underline-offset:.16em;}
  @media(max-width:560px){ .mag{padding:32px 22px 40px;} .mast-title{font-size:32px;} .research-row{grid-template-columns:minmax(0,1fr); gap:3px;} }
</style>
</head>
<body>
  <main class="mag">
    <header class="masthead">
      <div class="mast-row">
        <span>${copy.subject}</span><span>${esc(copy.issue(data.edition || 1))}</span>
      </div>
      <h1 class="mast-title">${copy.masthead}</h1>
      <div class="mast-sub">${editionDate} · ${weekday}</div>
    </header>
    ${data.lead ? `<p class="lead">${esc(data.lead)}</p>` : ""}
    ${compactEdition ? "" : renderThreads(data.threads)}
    ${sections.map(renderSection).join("")}
    <footer class="foot"><a href="https://github.com/dorischeyy/perp-daily">${copy.credit}</a> · ${copy.footer}</footer>
  </main>
</body>
</html>`.replace(/[ \t]+$/gm, "");

writeFileSync(outPath, html, "utf8");
console.log(outPath);

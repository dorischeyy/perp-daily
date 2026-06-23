#!/usr/bin/env node
// check-feeds.mjs — RSS 源健康检查。抓 config/sources.json 的 feeds.rss，
// 判断每个源是否「可达 + 有近 N 天的内容」，失活/陈旧/不可达 → 退出码 2（供 Action 触发告警）。
// 防止源像 DL News(已关停)/Blockworks(停更) 那样静默失活、日报悄悄少一路。
// 用法: node lib/check-feeds.mjs [staleDays=10]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STALE_DAYS_DEFAULT = 10;

// 从 feed XML 抽出「最新一条」的日期（RSS pubDate / Atom updated|published / dc:date），取最大值。导出供单测。
export function latestFeedDate(xml) {
  if (typeof xml !== "string" || !xml) return null;
  const re = /<(?:pubDate|updated|published|dc:date)[^>]*>([^<]+)<\/(?:pubDate|updated|published|dc:date)>/gi;
  let m, best = null;
  while ((m = re.exec(xml))) {
    const d = new Date(m[1].trim());
    if (!isNaN(d) && (best === null || d > best)) best = d;
  }
  return best;
}

// 分类一个源的健康状态。导出供单测。
// 入参 {status(HTTP码), xml, now(Date), staleDays}
export function classifyFeed({ status, xml, now = new Date(), staleDays = STALE_DAYS_DEFAULT }) {
  if (!(status >= 200 && status < 300)) return { state: "unreachable", detail: `HTTP ${status}` };
  if (typeof xml !== "string" || !/<(rss|feed|rdf)/i.test(xml)) return { state: "not-feed", detail: "非 RSS/Atom" };
  const d = latestFeedDate(xml);
  if (!d) return { state: "no-date", detail: "解析不到日期" };
  const ageDays = Math.floor((now - d) / 86400000);
  if (ageDays > staleDays) return { state: "stale", detail: `最新 ${ageDays} 天前(${d.toISOString().slice(0, 10)})`, ageDays };
  return { state: "ok", detail: `最新 ${ageDays} 天前`, ageDays };
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const staleDays = parseInt(process.argv[2], 10) || STALE_DAYS_DEFAULT;
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const cfg = JSON.parse(readFileSync(join(root, "config", "sources.json"), "utf8"));
  const feeds = (cfg.feeds && cfg.feeds.rss) || [];
  const now = new Date();
  const bad = [];

  const sleepSync = (s) => { try { execFileSync("sleep", [String(s)]); } catch {} };
  const fetchFeed = (url) => {
    try {
      const raw = execFileSync(
        "curl",
        ["-sL", "-w", "\n%{http_code}", "--max-time", "25", "-A", "Mozilla/5.0 perp-daily-health", url],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
      );
      const nl = raw.lastIndexOf("\n");
      return { xml: nl >= 0 ? raw.slice(0, nl) : raw, status: parseInt((nl >= 0 ? raw.slice(nl + 1) : "").trim(), 10) || 0 };
    } catch { return { xml: "", status: 0 }; }
  };

  console.log(`RSS 源健康检查 · ${feeds.length} 个 · 陈旧阈值 ${staleDays} 天`);
  for (const f of feeds) {
    // 抗抖动：首次非 ok 就重试 1 次（间隔 2s），避免 Cloudflare 偶发挑战误报
    let { status, xml } = fetchFeed(f.url);
    let r = classifyFeed({ status, xml, now, staleDays });
    if (r.state !== "ok") { sleepSync(2); ({ status, xml } = fetchFeed(f.url)); r = classifyFeed({ status, xml, now, staleDays }); }
    const icon = r.state === "ok" ? "✅" : (r.state === "no-date" ? "⚠️" : "❌");
    console.log(`  ${icon} ${(f.name || f.url).padEnd(16)} ${r.state}  ${r.detail}`);
    if (r.state !== "ok" && r.state !== "no-date") bad.push(`${f.name}（${r.detail}）`);
  }

  if (bad.length) {
    console.error(`\n⚠️ ${bad.length} 个源失活/陈旧/不可达：${bad.join("；")}。请在 config/sources.json 更换。`);
    process.exit(2);
  }
  console.log("\n✅ 所有 RSS 源健康。");
}

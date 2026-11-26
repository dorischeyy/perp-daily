#!/usr/bin/env node
// Check availability and recent entries in the RSS registry (config/sources.json).
// Exit 2 when at least one feed is stale, unavailable, or invalid.
// The weekly workflow reports failures through GitHub.
// Usage: node lib/check-feeds.mjs [staleDays=10]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STALE_DAYS_DEFAULT = 10;

// Return the newest RSS pubDate, Atom updated/published, or dc:date in the feed.
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

// Classify feed health for the CLI and unit tests.
// Input: HTTP status, feed XML, current date, and stale threshold in days.
export function classifyFeed({ status, xml, now = new Date(), staleDays = STALE_DAYS_DEFAULT }) {
  if (!(status >= 200 && status < 300)) return { state: "unreachable", detail: `HTTP ${status}` };
  if (typeof xml !== "string" || !/<(rss|feed|rdf)/i.test(xml)) return { state: "not-feed", detail: "Not an RSS or Atom feed" };
  const d = latestFeedDate(xml);
  if (!d) return { state: "no-date", detail: "No entry date could be parsed" };
  const ageDays = Math.floor((now - d) / 86400000);
  if (ageDays > staleDays) return { state: "stale", detail: `Latest entry was ${ageDays} days ago (${d.toISOString().slice(0, 10)})`, ageDays };
  return { state: "ok", detail: `Latest entry was ${ageDays} days ago`, ageDays };
}

// CLI entry point.
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

  console.log(`Checking ${feeds.length} RSS feeds (stale after ${staleDays} days).`);
  for (const f of feeds) {
    // Retry once after two seconds to tolerate a transient challenge or connection failure.
    let { status, xml } = fetchFeed(f.url);
    let r = classifyFeed({ status, xml, now, staleDays });
    if (r.state !== "ok") { sleepSync(2); ({ status, xml } = fetchFeed(f.url)); r = classifyFeed({ status, xml, now, staleDays }); }
    const icon = r.state === "ok" ? "✅" : (r.state === "no-date" ? "⚠️" : "❌");
    console.log(`  ${icon} ${(f.name || f.url).padEnd(16)} ${r.state}  ${r.detail}`);
    if (r.state !== "ok" && r.state !== "no-date") bad.push(`${f.name} (${r.detail})`);
  }

  if (bad.length) {
    console.error(`\n${bad.length} unhealthy feeds: ${bad.join("; ")}. Review their entries in config/sources.json.`);
    process.exit(2);
  }
  console.log("\nAll RSS feeds are healthy.");
}

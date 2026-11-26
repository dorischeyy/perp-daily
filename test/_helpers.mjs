import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function run(args) {
  try {
    const out = execFileSync("node", args, { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

const dir = mkdtempSync(join(tmpdir(), "perp-daily-test-"));
let n = 0;
export function tmpJson(obj) {
  const p = join(dir, `t${n++}.json`);
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

export function baseContent(overrides = {}) {
  const newsSection = (id, title) => ({
    id,
    title,
    items: Array.from({ length: 3 }, (_, i) => ({
      headline: id === "perpdex" && i === 0 ? "Headline" : `${title} example ${i + 1}`,
      body: [id === "perpdex" ? `**Event**: ${title} example ${i + 1}` : `This item describes ${title} development ${i + 1}.`],
      source: "S",
      url: id === "perpdex" && i === 0 ? "https://example.com/a" : `https://example.com/${id}-${i + 1}`,
      date: "2026-06-23",
    })),
  });
  return {
    date: "2026-06-23",
    edition: 1,
    lead: "Perpetual futures venues are competing for sustained order flow as their market listings expand.",
    sections: [
      newsSection("perpdex", "Perp DEX"),
      newsSection("launchpad", "Launchpad"),
      newsSection("crypto", "Crypto"),
      newsSection("ai", "AI"),
    ],
    ...overrides,
  };
}

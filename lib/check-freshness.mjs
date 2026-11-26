#!/usr/bin/env node

// News has a three-day window, extended to seven days for weekly themes.
// Research may cite older or undated material if its evidence was checked on the edition date.
// Usage: node lib/check-freshness.mjs [content.json] [YYYY-MM-DD]

import fs from "node:fs";
import { extractUrlDate, isIsoDate, validateResearchItem, validateV2Item } from "./research.mjs";

const file = process.argv[2] || "content.json";
const todayStr =
  process.argv[3] ||
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD

const today = new Date(todayStr + "T00:00:00Z");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const NEWS_MAX = 3;
const TREND_MAX = 7;

const diffDays = (d) => Math.round((today - d) / 86400000);
const isTrend = (h) => /^\s*Weekly (?:theme|trend)\b/i.test(h || "");

const violations = [];
const ok = [];
if (!isIsoDate(data.date) || data.date !== todayStr) {
  violations.push({ sec: "report", h: "Edition date", reason: `report date ${data.date} differs from ${todayStr}` });
}

for (const [index, thread] of (data.threads || []).entries()) {
  const ds = thread.date;
  const d = ds ? new Date(ds + "T00:00:00Z") : null;
  if (!isIsoDate(ds)) {
    violations.push({ sec: "threads", h: thread.title, reason: `threads[${index}].date is invalid: ${ds}` });
    continue;
  }
  const ud = extractUrlDate(thread.url);
  if (ud && ud.iso > todayStr) {
    violations.push({ sec: "threads", h: thread.title, reason: `URL date ${ud.iso} is later than ${todayStr}` });
    continue;
  }
  if (ud && Math.abs(diffDays(d) - diffDays(ud.d)) > 2) {
    violations.push({
      sec: "threads",
      h: thread.title,
      reason: `source date ${ds} conflicts with URL date ${ud.iso}`,
    });
    continue;
  }
  const age = diffDays(d);
  if (age < 0 || age > NEWS_MAX) {
    violations.push({
      sec: "threads",
      h: thread.title,
      reason: `thread update ${ds} falls outside the ${NEWS_MAX}-day window`,
    });
  } else {
    ok.push({ sec: "threads", h: thread.title, age, tag: "Latest developments" });
  }
}

for (const sec of data.sections || []) {
  for (const it of sec.items || []) {
    if (it.kind !== undefined && it.kind !== "news" && it.kind !== "research") {
      violations.push({ sec: sec.id, h: it.headline, reason: `unknown kind: ${it.kind}` });
      continue;
    }
    if (data.editorial_version === 2) {
      const errors = validateV2Item(it, data.date);
      if (isIsoDate(it.event_date) && it.event_date > todayStr) errors.push("event_date cannot be later than the review date");
      if (errors.length) {
        for (const reason of errors) violations.push({ sec: sec.id, h: it.headline, reason });
        continue;
      }
    }
    if (it.kind === "research") {
      const errors = validateResearchItem(it, todayStr, "research", data.editorial_version);
      if (errors.length) {
        for (const reason of errors) violations.push({ sec: sec.id, h: it.headline, reason });
      } else {
        ok.push({ sec: sec.id, h: it.headline, age: 0, tag: "Research verified today" });
      }
      continue;
    }
    const ds = it.date;
    const d = ds ? new Date(ds + "T00:00:00Z") : null;
    if (!isIsoDate(ds)) {
      violations.push({ sec: sec.id, h: it.headline, reason: `date is missing or invalid: ${ds}` });
      continue;
    }

    const ud = extractUrlDate(it.url);
    if (ds > todayStr || (ud && ud.iso > todayStr)) {
      violations.push({ sec: sec.id, h: it.headline, reason: `source or URL date is later than ${todayStr}` });
      continue;
    }
    if (ud && Math.abs(diffDays(d) - diffDays(ud.d)) > 2) {
      violations.push({
        sec: sec.id,
        h: it.headline,
        reason: `source date ${ds} conflicts with URL date ${ud.iso}`,
      });
      continue;
    }

    // Additional sources may predate the event. Verify each source against its own publication date.
    let badReference = false;
    for (const [index, ref] of (it.references || []).entries()) {
      const rd = ref.date ? new Date(ref.date + "T00:00:00Z") : null;
      if (!isIsoDate(ref.date)) {
        violations.push({ sec: sec.id, h: it.headline, reason: `references[${index}].date is invalid: ${ref.date}` });
        badReference = true;
        continue;
      }
      const rud = extractUrlDate(ref.url);
      if (ref.date > todayStr || (rud && rud.iso > todayStr)) {
        violations.push({ sec: sec.id, h: it.headline, reason: `references[${index}].date is in the future` });
        badReference = true;
      }
      if (rud && Math.abs(diffDays(rd) - diffDays(rud.d)) > 2) {
        violations.push({
          sec: sec.id,
          h: it.headline,
          reason: `reference date ${ref.date} conflicts with URL date ${rud.iso}`,
        });
        badReference = true;
      }
    }
    if (badReference) continue;

    const age = diffDays(d);
    const limit = isTrend(it.headline) ? TREND_MAX : NEWS_MAX;
    const tag = isTrend(it.headline) ? "Weekly theme" : "News";
    if (data.editorial_version === 2) {
      const eventAge = diffDays(new Date(`${it.event_date}T00:00:00Z`));
      if (eventAge < 0 || eventAge > limit) {
        violations.push({
          sec: sec.id,
          h: it.headline,
          reason: `${tag} event_date=${it.event_date} is outside the ${limit}-day window`,
        });
        continue;
      }
    }
    if (age < 0 || age > limit) {
      violations.push({
        sec: sec.id,
        h: it.headline,
        reason: `${tag} dated ${ds} is ${age} days old; maximum ${limit}`,
      });
    } else {
      ok.push({ sec: sec.id, h: it.headline, age, tag });
    }
  }
}

console.log(`Freshness audit for ${todayStr}: ${ok.length + violations.length} items`);
for (const o of ok) console.log(`  [${o.sec}] ${o.age}d (${o.tag}) ${o.h}`);
for (const v of violations) console.log(`  ❌ [${v.sec}] ${v.reason} | ${v.h}`);

if (violations.length) {
  console.error(
    `Freshness audit failed: ${violations.length} violations`
  );
  process.exit(1);
}
console.log("Freshness audit passed.");

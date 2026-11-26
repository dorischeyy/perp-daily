#!/usr/bin/env node

// Validate the story ledger and list active threads due for review.
// An invalid ledger blocks publication. Due and overdue reviews are reminders.
// Usage: node lib/threads.mjs [YYYY-MM-DD] [threads.json]

import fs from "node:fs";

const today =
  process.argv[2] ||
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const file = process.argv[3] || "threads.json";

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const dayspan = (a, b) =>
  Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 86400000);

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`Cannot read threads.json: ${e.message}`);
  process.exit(1);
}

const STATUS = new Set(["active", "dormant", "closed"]);
const TIER = new Set(["S", "A"]);
const errs = [];
const threads = Array.isArray(data.threads) ? data.threads : null;
if (!threads) errs.push("threads must be an array");

const ids = new Set();
for (const [i, t] of (threads || []).entries()) {
  const tag = `threads[${i}]${t && t.id ? `(${t.id})` : ""}`;
  if (!t || typeof t !== "object") { errs.push(`${tag} must be an object`); continue; }
  for (const f of ["id", "title", "status", "first_seen", "last_update", "next_check", "thesis", "why_us"])
    if (!t[f]) errs.push(`${tag} missing field ${f}`);
  if (t.id) { if (ids.has(t.id)) errs.push(`${tag} duplicate id`); ids.add(t.id); }
  if (t.status && !STATUS.has(t.status)) errs.push(`${tag} invalid status: ${t.status}`);
  if (t.tier && !TIER.has(t.tier)) errs.push(`${tag} invalid tier: ${t.tier}`);
  if (typeof t.score === "number" && (t.score < 0 || t.score > 100)) errs.push(`${tag} score is outside 0–100`);
  for (const f of ["first_seen", "last_update", "next_check"])
    if (t[f] && !isDate(t[f])) errs.push(`${tag}.${f} invalid date: ${t[f]}`);
  if (!Array.isArray(t.log)) errs.push(`${tag}.log must be an array`);
  else for (const [j, e] of t.log.entries()) {
    if (!e || !isDate(e.date) || !e.point || !e.url) errs.push(`${tag}.log[${j}] requires date, point and url`);
  }
}

if (errs.length) {
  console.error("Story ledger validation failed:");
  for (const e of errs) console.error("  - " + e);
  process.exit(1);
}

const active = threads.filter((t) => t.status === "active");
const due = active.filter((t) => !t.next_check || dayspan(today, t.next_check) >= 0);
const stale = active.filter((t) => {
  const cad = t.cadence_days || 5;
  return dayspan(today, t.last_update) > cad * 2;
});

console.log(`Story ledger: ${today}, ${active.length} active threads`);
for (const t of active) {
  const age = dayspan(today, t.first_seen);
  const flagDue = !t.next_check || dayspan(today, t.next_check) >= 0 ? " (review due)" : "";
  console.log(`  [${t.tier}|${t.score}] ${t.id}: ${age} days since ${t.first_seen}, next review ${t.next_check}${flagDue}`);
}
if (due.length) {
  console.log("Threads due for review:");
  for (const t of due) console.log(`  ${t.title}: ${t.watch_for || "No indicator recorded"}`);
}
if (stale.length) {
  console.log("Consider moving these threads to dormant status:");
  for (const t of stale) console.log(`  → ${t.title} (last_update=${t.last_update})`);
}
if (!due.length && !stale.length) console.log("No reviews due.");

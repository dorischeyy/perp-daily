#!/usr/bin/env node
// threads.mjs — 故事线台账的机械 QA。两个职责：
//   1) 校验 threads.json 结构合法（坏台账 → 退出码1 阻断发布，防把状态写烂）
//   2) 按今天日期，打印「该复盘/recall 的活跃线」「该转 dormant 的线」，供 generate.md 当天串联用
// 用法: node threads.mjs [today=YYYY-MM-DD] [threads.json]
// 默认只在结构错误时 exit 1；提醒类信息 exit 0（串联是质量动作，靠 generate.md 落实，不硬卡）。
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
  console.error(`⛔ threads.json 读取/解析失败: ${e.message}`);
  process.exit(1);
}

const STATUS = new Set(["active", "dormant", "closed"]);
const TIER = new Set(["S", "A"]);
const errs = [];
const threads = Array.isArray(data.threads) ? data.threads : null;
if (!threads) errs.push("threads 必须是数组");

const ids = new Set();
for (const [i, t] of (threads || []).entries()) {
  const tag = `threads[${i}]${t && t.id ? `(${t.id})` : ""}`;
  if (!t || typeof t !== "object") { errs.push(`${tag} 不是对象`); continue; }
  for (const f of ["id", "title", "status", "first_seen", "last_update", "next_check", "thesis", "why_us"])
    if (!t[f]) errs.push(`${tag} 缺字段 ${f}`);
  if (t.id) { if (ids.has(t.id)) errs.push(`${tag} id 重复`); ids.add(t.id); }
  if (t.status && !STATUS.has(t.status)) errs.push(`${tag} status 非法: ${t.status}`);
  if (t.tier && !TIER.has(t.tier)) errs.push(`${tag} tier 非法: ${t.tier}`);
  if (typeof t.score === "number" && (t.score < 0 || t.score > 100)) errs.push(`${tag} score 越界: ${t.score}`);
  for (const f of ["first_seen", "last_update", "next_check"])
    if (t[f] && !isDate(t[f])) errs.push(`${tag} ${f} 日期格式错: ${t[f]}`);
  if (!Array.isArray(t.log)) errs.push(`${tag} log 必须是数组`);
  else for (const [j, e] of t.log.entries()) {
    if (!e || !isDate(e.date) || !e.point || !e.url) errs.push(`${tag} log[${j}] 需含合法 date/point/url`);
  }
}

if (errs.length) {
  console.error("⛔ threads.json 结构校验未通过：");
  for (const e of errs) console.error("  - " + e);
  process.exit(1);
}

// ---- 提醒：今天该复盘 / 该转 dormant ----
const active = threads.filter((t) => t.status === "active");
const due = active.filter((t) => !t.next_check || dayspan(today, t.next_check) >= 0);
const stale = active.filter((t) => {
  const cad = t.cadence_days || 5;
  return dayspan(today, t.last_update) > cad * 2; // 超过两个节奏没进展
});

console.log(`故事线台账 · 今天=${today} · 活跃线 ${active.length} 条`);
for (const t of active) {
  const age = dayspan(today, t.first_seen);
  const flagDue = !t.next_check || dayspan(today, t.next_check) >= 0 ? " ⏰到期需复盘" : "";
  console.log(`  • [${t.tier || "-"}|${t.score ?? "-"}] ${t.id} 自${t.first_seen}(第${age}天) next_check=${t.next_check}${flagDue}`);
}
if (due.length) {
  console.log(`\n⏰ 今天必须处理的线（next_check 已到）：`);
  for (const t of due) console.log(`  → ${t.title}：核实有无新进展；有则 append 进 log+推进 next_check，无则给一句有信息量的状态(临界点/反常缺席)或转 dormant。关注：${t.watch_for || "—"}`);
}
if (stale.length) {
  console.log(`\n💤 建议转 dormant（超两个节奏无进展）：`);
  for (const t of stale) console.log(`  → ${t.title}（last_update=${t.last_update}）`);
}
if (!due.length && !stale.length) console.log("（今天没有到期必须复盘的线）");

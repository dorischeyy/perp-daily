#!/usr/bin/env node
// check-freshness.mjs — 发布前机械化时效关卡（不靠 agent 自觉）。
// 规则：
//   - 新闻条目（perpdex/launchpad/crypto/ai）：date 距今 ≤ 3 天（72h）。
//   - headline 以「本周主线」开头的趋势条目：放宽到 ≤ 7 天。
//   - 末栏机会与打法（hertzflow）：豁免（是研判综述，不显示日期）。
//   - 任何条目 date 缺失或无法解析 → 失败。
//   - 命中违规 → 退出码 1，阻断 publish.sh，逼回去砍。
// 用法：node check-freshness.mjs content.json [今天YYYY-MM-DD]
import fs from "node:fs";

const file = process.argv[2] || "content.json";
const todayStr =
  process.argv[3] ||
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD

const today = new Date(todayStr + "T00:00:00Z");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const NEWS_MAX = 3; // 天，72h
const TREND_MAX = 7; // 天，本周主线
const EXEMPT = new Set(["hertzflow"]); // 机会与打法栏豁免

const diffDays = (d) => Math.round((today - d) / 86400000);
const isTrend = (h) => /^\s*本周主线/.test(h || "");

// 从 url 里抽内嵌日期（/2026/01/29/、/2026-01-29-、_2026_01_29 等），用于反「改日期骗关卡」。
// 很多新闻站 url 自带发布日，agent 即便把 date 字段改新，url 也藏不住真日期。
const extractUrlDate = (url = "") => {
  const m = url.match(/\b(20\d{2})[\/\-_](0[1-9]|1[0-2])[\/\-_](0[1-9]|[12]\d|3[01])\b/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(d) ? null : { iso, d };
};

const violations = [];
const ok = [];

for (const sec of data.sections || []) {
  // 机会与打法栏豁免「时效」，但仍做 url 日期一致性校验（防止挂一篇旧文却标新日期误导）
  const exemptFreshness = EXEMPT.has(sec.id);
  for (const it of sec.items || []) {
    const ds = it.date;
    const d = ds ? new Date(ds + "T00:00:00Z") : null;
    if (!d || isNaN(d)) {
      violations.push({ sec: sec.id, h: it.headline, reason: `date 缺失/无法解析: ${ds}` });
      continue;
    }

    // 防造假：url 内嵌日期与 date 字段差 >2 天 → 判为「改日期」，无条件拦（含机会与打法栏）
    const ud = extractUrlDate(it.url);
    if (ud && Math.abs(diffDays(d) - diffDays(ud.d)) > 2) {
      violations.push({
        sec: sec.id,
        h: it.headline,
        reason: `🚩date 造假嫌疑：标注 date=${ds}，但 url 内嵌日期=${ud.iso}（相差 ${Math.abs(
          diffDays(d) - diffDays(ud.d)
        )} 天）。date 必须取来源真实发布日。`,
      });
      continue;
    }

    // 补充来源可以比新闻旧，只校验它自己的真实日期，不拿它冒充当日主来源。
    let badReference = false;
    for (const [index, ref] of (it.references || []).entries()) {
      const rd = ref.date ? new Date(ref.date + "T00:00:00Z") : null;
      if (!rd || isNaN(rd)) {
        violations.push({ sec: sec.id, h: it.headline, reason: `补充来源 references[${index}] date 缺失/无法解析: ${ref.date}` });
        badReference = true;
        continue;
      }
      const rud = extractUrlDate(ref.url);
      if (rud && Math.abs(diffDays(rd) - diffDays(rud.d)) > 2) {
        violations.push({
          sec: sec.id,
          h: it.headline,
          reason: `🚩补充来源 date 造假嫌疑：标注 date=${ref.date}，但 url 内嵌日期=${rud.iso}`,
        });
        badReference = true;
      }
    }
    if (badReference) continue;

    if (exemptFreshness) continue; // 机会与打法栏过了 url 校验即放行，不查 72h

    const age = diffDays(d);
    const limit = isTrend(it.headline) ? TREND_MAX : NEWS_MAX;
    const tag = isTrend(it.headline) ? "本周主线" : "新闻";
    if (age > limit) {
      violations.push({
        sec: sec.id,
        h: it.headline,
        reason: `${tag}条目 date=${ds} 距今 ${age} 天 > ${limit} 天上限`,
      });
    } else {
      ok.push({ sec: sec.id, h: it.headline, age, tag });
    }
  }
}

console.log(`时效关卡 · 今天=${todayStr} · 共 ${ok.length + violations.length} 条`);
for (const o of ok) console.log(`  ✅ [${o.sec}] ${o.age}天 (${o.tag}) ${o.h}`);
for (const v of violations) console.log(`  ❌ [${v.sec}] ${v.reason} | ${v.h}`);

if (violations.length) {
  console.error(
    `\n⛔ 时效关卡未通过：${violations.length} 条违规。请砍掉或降级为「(背景，MM-DD)」内联，或改写为「本周主线」(≤7天且为趋势综述)。发布已阻断。`
  );
  process.exit(1);
}
console.log("\n✅ 时效关卡通过。");

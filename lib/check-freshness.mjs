#!/usr/bin/env node
// check-freshness.mjs — 发布前机械化时效关卡（不靠 agent 自觉）。
// 规则：
//   - 新闻条目（perpdex/launchpad/crypto/ai）：date 距今 ≤ 3 天（72h）。
//   - headline 以「本周主线」开头的趋势条目：放宽到 ≤ 7 天。
//   - 项目研究允许旧来源或无日期文档，但必须当天核验并完整记录机制、策略和讨论证据。
//   - 新闻 date 缺失、未来或无法解析 → 失败。
//   - 命中违规 → 退出码 1，阻断 publish.sh，逼回去砍。
// 用法：node check-freshness.mjs content.json [今天YYYY-MM-DD]
import fs from "node:fs";
import { extractUrlDate, isIsoDate, validateResearchItem, validateV2Item } from "./research.mjs";

const file = process.argv[2] || "content.json";
const todayStr =
  process.argv[3] ||
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD

const today = new Date(todayStr + "T00:00:00Z");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const NEWS_MAX = 3; // 天，72h
const TREND_MAX = 7; // 天，本周主线

const diffDays = (d) => Math.round((today - d) / 86400000);
const isTrend = (h) => /^\s*本周主线/.test(h || "");

const violations = [];
const ok = [];
if (!isIsoDate(data.date) || data.date !== todayStr) {
  violations.push({ sec: "report", h: "报告日期", reason: `报告 date=${data.date} 必须等于本次核验日期 ${todayStr}` });
}

// 顶部「今日进展」同样是公开内容，必须是近 72h 的新 delta，不能拿旧故事或未来预告占位。
for (const [index, thread] of (data.threads || []).entries()) {
  const ds = thread.date;
  const d = ds ? new Date(ds + "T00:00:00Z") : null;
  if (!isIsoDate(ds)) {
    violations.push({ sec: "threads", h: thread.title, reason: `threads[${index}] date 缺失/无法解析: ${ds}` });
    continue;
  }
  const ud = extractUrlDate(thread.url);
  if (ud && ud.iso > todayStr) {
    violations.push({ sec: "threads", h: thread.title, reason: `URL 内嵌日期=${ud.iso} 晚于今天 ${todayStr}` });
    continue;
  }
  if (ud && Math.abs(diffDays(d) - diffDays(ud.d)) > 2) {
    violations.push({
      sec: "threads",
      h: thread.title,
      reason: `🚩date 造假嫌疑：标注 date=${ds}，但 url 内嵌日期=${ud.iso}`,
    });
    continue;
  }
  const age = diffDays(d);
  if (age < 0 || age > NEWS_MAX) {
    violations.push({
      sec: "threads",
      h: thread.title,
      reason: `今日进展 date=${ds} 距今 ${age} 天，不在 0–${NEWS_MAX} 天范围`,
    });
  } else {
    ok.push({ sec: "threads", h: thread.title, age, tag: "今日进展" });
  }
}

for (const sec of data.sections || []) {
  for (const it of sec.items || []) {
    if (it.kind !== undefined && it.kind !== "news" && it.kind !== "research") {
      violations.push({ sec: sec.id, h: it.headline, reason: `未知 kind=${JSON.stringify(it.kind)}` });
      continue;
    }
    if (data.editorial_version === 2) {
      const errors = validateV2Item(it, data.date);
      if (isIsoDate(it.event_date) && it.event_date > todayStr) errors.push("event_date 不能晚于本次核验日期");
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
        ok.push({ sec: sec.id, h: it.headline, age: 0, tag: "项目研究，当天核验" });
      }
      continue;
    }
    const ds = it.date;
    const d = ds ? new Date(ds + "T00:00:00Z") : null;
    if (!isIsoDate(ds)) {
      violations.push({ sec: sec.id, h: it.headline, reason: `date 缺失/无法解析: ${ds}` });
      continue;
    }

    // 防造假：url 内嵌日期与 date 字段差 >2 天 → 判为「改日期」，无条件拦
    const ud = extractUrlDate(it.url);
    if (ds > todayStr || (ud && ud.iso > todayStr)) {
      violations.push({ sec: sec.id, h: it.headline, reason: `date=${ds} 或 URL 内嵌日期晚于今天 ${todayStr}` });
      continue;
    }
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
      if (!isIsoDate(ref.date)) {
        violations.push({ sec: sec.id, h: it.headline, reason: `补充来源 references[${index}] date 缺失/无法解析: ${ref.date}` });
        badReference = true;
        continue;
      }
      const rud = extractUrlDate(ref.url);
      if (ref.date > todayStr || (rud && rud.iso > todayStr)) {
        violations.push({ sec: sec.id, h: it.headline, reason: `补充来源 references[${index}] 日期不能晚于今天` });
        badReference = true;
      }
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

    const age = diffDays(d);
    const limit = isTrend(it.headline) ? TREND_MAX : NEWS_MAX;
    const tag = isTrend(it.headline) ? "本周主线" : "新闻";
    if (data.editorial_version === 2) {
      const eventAge = diffDays(new Date(`${it.event_date}T00:00:00Z`));
      if (eventAge < 0 || eventAge > limit) {
        violations.push({
          sec: sec.id,
          h: it.headline,
          reason: `${tag} event_date=${it.event_date} 距今 ${eventAge} 天，不在 0–${limit} 天范围；新文章不能将旧事件改作新闻`,
        });
        continue;
      }
    }
    if (age < 0 || age > limit) {
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
    `\n⛔ 时效关卡未通过：${violations.length} 条违规。新闻须满足真实日期与时效；研究须补齐证据、当天核验日期及讨论边界。发布已阻断。`
  );
  process.exit(1);
}
console.log("\n✅ 时效关卡通过。");

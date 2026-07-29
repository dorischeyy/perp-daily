#!/usr/bin/env node
// check-editorial.mjs — 发布前编辑关卡：阻断视觉/语义重复与空泛产品判断。
// 用法: node lib/check-editorial.mjs [content.json]
import { readFileSync } from "node:fs";

const normalized = (value) =>
  String(value || "")
    .replace(/\*\*/g, "")
    .replace(/[\s，。！？；：、,.!?;:（）()「」『』《》“”'"·｜|/\\\-—–_]/g, "")
    .toLowerCase();

const bigrams = (value) => {
  const text = normalized(value);
  const out = [];
  for (let i = 0; i < text.length - 1; i += 1) out.push(text.slice(i, i + 2));
  return out;
};

const dice = (a, b) => {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (!aa.length || !bb.length) return 0;
  const counts = new Map();
  for (const token of aa) counts.set(token, (counts.get(token) || 0) + 1);
  let overlap = 0;
  for (const token of bb) {
    const left = counts.get(token) || 0;
    if (left > 0) {
      overlap += 1;
      counts.set(token, left - 1);
    }
  }
  return (2 * overlap) / (aa.length + bb.length);
};

const bodyParts = (item) => (Array.isArray(item.body) ? item.body : [item.body]).filter(Boolean);

export function auditEditorial(data) {
  const errors = [];
  const warnings = [];
  const E = (message) => errors.push(message);
  const W = (message) => warnings.push(message);
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const news = sections.filter((section) => section.id !== "hertzflow").flatMap((section) => section.items || []);
  const newsUrls = new Set(news.map((item) => item.url).filter(Boolean));
  const threads = Array.isArray(data?.threads) ? data.threads : [];
  const seen = new Map();

  const register = (value, label) => {
    const key = normalized(value);
    if (key.length < 14) return;
    const previous = seen.get(key);
    if (previous) E(`${label} 与 ${previous} 完全重复`);
    else seen.set(key, label);
  };

  if (data?.lead) register(data.lead, "lead");

  for (const [index, thread] of threads.entries()) {
    const tag = `threads[${index}]`;
    register(thread.title, `${tag}.title`);
    register(thread.update, `${tag}.update`);
    if (newsUrls.has(thread.url)) E(`${tag}.url 已由当期新闻正文承载，不应在今日进展重复出现`);
    if (/(?:尚未|暂无|未发现|仍无|没有新|等待|继续关注|变化尚未发生|待观察)/.test(String(thread.update || ""))) {
      E(`${tag}.update 看起来只是“无变化/等待”状态；今日进展只允许可核验的新 delta`);
    }
  }

  for (const section of sections) {
    for (const [index, item] of (section.items || []).entries()) {
      const tag = `${section.id}.items[${index}]`;
      register(item.headline, `${tag}.headline`);
      for (const [p, paragraph] of bodyParts(item).entries()) register(paragraph, `${tag}.body[${p}]`);
      if (item.context?.text) register(item.context.text, `${tag}.context`);

      if (data?.lead && normalized(data.lead).length >= 16) {
        const comparison = `${item.headline || ""}${bodyParts(item)[0] || ""}`;
        if (dice(data.lead, comparison) >= 0.82) E(`lead 与 ${tag} 的标题/首段近似复述`);
      }
      if (item.context?.text) {
        const main = `${item.headline || ""}${bodyParts(item).join("")}`;
        const context = normalized(item.context.text);
        if (context.length >= 14 && (normalized(main).includes(context) || dice(item.context.text, main) >= 0.88)) {
          E(`${tag}.context 近似复述 headline/body，应只补参照或边界`);
        }
      }
    }
  }

  const decisionSection = sections.find((section) => section.id === "hertzflow");
  if (decisionSection) {
    const items = decisionSection.items || [];
    if (items.length > 2) E("产品判断最多保留 2 条，超过即失去决策优先级");
    for (const [index, item] of items.entries()) {
      const tag = `hertzflow.items[${index}]`;
      const parts = bodyParts(item);
      const prefixes = ["**判断变化**：", "**证据与边界**：", "**对 HertzFlow**："];
      if (parts.length !== 3 || prefixes.some((prefix, i) => !String(parts[i] || "").startsWith(prefix))) {
        E(`${tag} 必须严格使用“判断变化 / 证据与边界 / 对 HertzFlow”三段格式`);
      }
      if (item.context != null) E(`${tag} 不应设置 context，避免把判断再摘要一次`);
      if (!newsUrls.has(item.url)) E(`${tag}.url 必须对应当期一条新闻来源，避免无关建议混入`);
    }
  }

  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] || "content.json";
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`⛔ 编辑关卡读取/解析失败: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings } = auditEditorial(data);
  for (const warning of warnings) console.warn(`  ⚠️ ${warning}`);
  if (errors.length) {
    console.error(`⛔ 编辑关卡未通过（${errors.length} 项）：`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`✅ 编辑去重与产品判断关卡通过${warnings.length ? `（${warnings.length} 条提醒）` : ""}`);
}

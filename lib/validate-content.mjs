#!/usr/bin/env node
// validate-content.mjs — content.json 整体结构校验（发布前关卡）。
// 补上 check-freshness(只查日期) / threads(只查台账) 之外的空白：确保 agent 产出的
// content.json 结构合法、字段齐全、URL 与日期格式正确，否则退出码 1 阻断，给清晰报错。
// 用法: node lib/validate-content.mjs [content.json]
import { readFileSync } from "node:fs";

const file = process.argv[2] || "content.json";
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00Z"));
const isHttpUrl = (s) => typeof s === "string" && /^https?:\/\/\S+$/i.test(s);
const KNOWN_SECTIONS = new Set(["perpdex", "launchpad", "crypto", "ai", "hertzflow"]);
const CONTEXT_LABELS = new Set(["量级参照", "影响范围", "落地程度", "口径限制"]);

// 只做“数字值得解释”的提醒，不把所有日期、编号或无关计数误判为错误。
// 这是编辑关卡：模型仍需依照 generate.md 判断这项数字是否真的会影响读者的理解。
const hasMaterialMetric = (item) => {
  const body = Array.isArray(item.body) ? item.body.join(" ") : String(item.body || "");
  const text = `${item.headline || ""} ${body}`;
  return /(?:[$￥¥]\s?\d[\d,.]*\s*(?:[BMK]|亿|万|万亿)?|\b\d[\d,.]*\s*(?:亿美元|亿(?:美元)?|万(?:美元)?|万亿|%|bps|倍|个(?:市场|交易对)|[BMK]\s*(?:USD|USDT|BTC|ETH))|\b(?:TVL|OI|成交量|交易量|费用|收入|清算|解锁).{0,12}\d)/i.test(text);
};

// 纯函数：返回 {errors:[], warnings:[]}，便于单测复用
export function validateContent(data) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  if (!data || typeof data !== "object") return { errors: ["content 不是对象"], warnings };

  if (!isDate(data.date)) E(`date 缺失或格式错（应 YYYY-MM-DD）: ${JSON.stringify(data.date)}`);
  if (data.edition != null && typeof data.edition !== "number") E(`edition 应为数字: ${JSON.stringify(data.edition)}`);
  if (data.lead != null && typeof data.lead !== "string") E("lead 应为字符串");

  // threads 展示快照（可选）
  if (data.threads != null) {
    if (!Array.isArray(data.threads)) E("threads 应为数组");
    else data.threads.forEach((t, i) => {
      if (!t || typeof t !== "object") return E(`threads[${i}] 不是对象`);
      if (!t.title || typeof t.title !== "string") E(`threads[${i}].title 缺失`);
      if (t.since != null && !isDate(t.since)) E(`threads[${i}].since 日期格式错: ${t.since}`);
    });
  }

  // sections（必需，非空）
  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    E("sections 必须是非空数组");
    return { errors, warnings };
  }
  const seenIds = new Set();
  data.sections.forEach((s, i) => {
    const tag = `sections[${i}]${s && s.id ? `(${s.id})` : ""}`;
    if (!s || typeof s !== "object") return E(`${tag} 不是对象`);
    if (!s.id || typeof s.id !== "string") E(`${tag} 缺 id`);
    else {
      if (seenIds.has(s.id)) E(`${tag} id 重复`);
      seenIds.add(s.id);
      if (!KNOWN_SECTIONS.has(s.id)) W(`${tag} id 非已知栏目（perpdex/launchpad/crypto/ai/hertzflow），渲染顺序会落到最后`);
    }
    if (!s.title || typeof s.title !== "string") E(`${tag} 缺 title`);
    if (typeof s.kicker === "string" && s.kicker.trim()) E(`${tag} 不应设置 kicker，栏目只保留一级标题`);
    if (s.id === "hertzflow") {
      if (s.title !== "机会与打法") E(`${tag} title 必须固定为“机会与打法”`);
    }
    if (!Array.isArray(s.items)) return E(`${tag} items 应为数组`);
    if (s.items.length === 0) W(`${tag} items 为空（该栏目不应保留，应整栏省略）`);

    s.items.forEach((it, j) => {
      const itag = `${tag}.items[${j}]`;
      if (!it || typeof it !== "object") return E(`${itag} 不是对象`);
      if (!it.headline || typeof it.headline !== "string") E(`${itag} 缺 headline`);
      const bodyOk = typeof it.body === "string"
        ? it.body.trim().length > 0
        : Array.isArray(it.body) && it.body.length > 0 && it.body.every((p) => typeof p === "string");
      if (!bodyOk) E(`${itag} body 应为非空字符串或非空字符串数组`);
      if (!isHttpUrl(it.url)) E(`${itag} url 缺失或非 http(s): ${JSON.stringify(it.url)}`);
      if (!isDate(it.date)) E(`${itag} date 缺失或格式错: ${JSON.stringify(it.date)}`);
      if (it.source != null && typeof it.source !== "string") E(`${itag} source 应为字符串`);
      if (it.references != null) {
        if (!Array.isArray(it.references) || it.references.length === 0 || it.references.length > 3) {
          E(`${itag} references 应为 1–3 条补充来源数组`);
        } else {
          const urls = new Set([it.url]);
          it.references.forEach((ref, k) => {
            const rtag = `${itag}.references[${k}]`;
            if (!ref || typeof ref !== "object" || Array.isArray(ref)) return E(`${rtag} 应为对象`);
            if (!ref.source || typeof ref.source !== "string") E(`${rtag}.source 缺失`);
            if (!isHttpUrl(ref.url)) E(`${rtag}.url 缺失或非 http(s): ${JSON.stringify(ref.url)}`);
            else if (urls.has(ref.url)) E(`${rtag}.url 与主来源或其他补充来源重复`);
            else urls.add(ref.url);
            if (!isDate(ref.date)) E(`${rtag}.date 缺失或格式错: ${JSON.stringify(ref.date)}`);
          });
        }
      } else if (typeof it.source === "string" && /\s[\/／]\s|、/.test(it.source)) {
        W(`${itag} source 看起来包含多个来源，但没有 references 可核查链接`);
      }
      if (it.context != null) {
        if (!it.context || typeof it.context !== "object" || Array.isArray(it.context)) {
          E(`${itag} context 应为对象`);
        } else {
          if (!CONTEXT_LABELS.has(it.context.label)) {
            E(`${itag} context.label 应为：${[...CONTEXT_LABELS].join(" / ")}`);
          }
          if (typeof it.context.text !== "string" || it.context.text.trim().length < 8 || it.context.text.trim().length > 160) {
            E(`${itag} context.text 应为 8–160 字的说明`);
          }
        }
      } else if (hasMaterialMetric(it)) {
        W(`${itag} 含可能影响判断的数字，但未提供 context 量级说明`);
      }
    });
  });

  return { errors, warnings };
}

// CLI 入口（被 import 时不执行）
if (import.meta.url === `file://${process.argv[1]}`) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`⛔ content.json 读取/解析失败: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings } = validateContent(data);
  for (const w of warnings) console.warn(`  ⚠️ ${w}`);
  if (errors.length) {
    console.error(`⛔ content.json 结构校验未通过（${errors.length} 项）：`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✅ content.json 结构校验通过${warnings.length ? `（${warnings.length} 条提醒）` : ""}`);
}

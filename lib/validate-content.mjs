#!/usr/bin/env node
// validate-content.mjs — content.json 整体结构校验（发布前关卡）。
// 补上 check-freshness(只查日期) / threads(只查台账) 之外的空白：确保 agent 产出的
// content.json 结构合法、字段齐全、URL 与日期格式正确，否则退出码 1 阻断，给清晰报错。
// 用法: node lib/validate-content.mjs [content.json]
import { readFileSync } from "node:fs";
import { isIsoDate as isDate, isHttpUrl, validateResearchItem, validateV2Item } from "./research.mjs";

const file = process.argv[2] || "content.json";
const KNOWN_SECTIONS = new Set(["perpdex", "launchpad", "crypto", "ai"]);
const NEWS_SECTION_IDS = ["perpdex", "launchpad", "crypto", "ai"];
const NEWS_ITEM_MIN = 3;
const NEWS_ITEM_MAX = 5;
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
  const compact = data.editorial_version === 2;

  if (!isDate(data.date)) E(`date 缺失或格式错（应 YYYY-MM-DD）: ${JSON.stringify(data.date)}`);
  if (isDate(data.date) && data.date >= "2026-10-21" && data.editorial_version !== 2) {
    E("2026-10-21 起的日报必须设置 editorial_version: 2，按动态栏目输出简洁正文");
  }
  if (data.edition != null && typeof data.edition !== "number") E(`edition 应为数字: ${JSON.stringify(data.edition)}`);
  const leadLength = compact
    ? Array.from(String(data.lead || "").replace(/\s/g, "")).length
    : String(data.lead || "").trim().length;
  if (typeof data.lead !== "string" || leadLength < 20 || leadLength > (compact ? 120 : 180)) {
    E(compact ? "lead 应为 20–120 字，直接说明具体发现、分析结论及必要边界" : "lead 应为 20–180 字的一句话近期市场概括");
  }
  if (typeof data.lead === "string") {
    const sentences = data.lead.trim().split(/[。！？!?]+/).filter((s) => s.trim());
    if (sentences.length > (compact ? 2 : 1)) E(compact ? "lead 只保留1至2个短句，不拼接多条新闻目录" : "lead 只保留一句近期市场概括");
    if (compact && sentences.some((s) => Array.from(s.replace(/\s/g, "")).length > 70)) {
      E("lead 单句不超过70字，请拆开长句并突出主重点");
    }
  }
  if (data.product_view != null) E("product_view 已停用，请删除；用lead说明本期主重点");

  // threads 是「今日进展」快照（可选）：只能放有来源的新 delta，不能成为旧故事占位区。
  if (data.threads != null) {
    if (data.editorial_version === 2) E("v2 不应生成 threads 展示快照，请维护独立的 threads.json 台账");
    if (!Array.isArray(data.threads)) E("threads 应为数组");
    else {
      if (data.threads.length === 0) E("threads 为空时应整个省略该字段");
      if (data.threads.length > 4) E("threads 今日进展最多 4 条");
      const threadTitles = new Set();
      const threadUrls = new Set();
      data.threads.forEach((t, i) => {
        const tag = `threads[${i}]`;
        if (!t || typeof t !== "object") return E(`${tag} 不是对象`);
        if (!t.title || typeof t.title !== "string") E(`${tag}.title 缺失`);
        else if (threadTitles.has(t.title)) E(`${tag}.title 与其他今日进展重复`);
        else threadTitles.add(t.title);
        if (!isDate(t.since)) E(`${tag}.since 日期格式错: ${t.since}`);
        if (!isDate(t.date)) E(`${tag}.date 缺失或格式错: ${t.date}`);
        if (!t.source || typeof t.source !== "string") E(`${tag}.source 缺失`);
        if (!isHttpUrl(t.url)) E(`${tag}.url 缺失或非 http(s): ${JSON.stringify(t.url)}`);
        else if (threadUrls.has(t.url)) E(`${tag}.url 与其他今日进展重复`);
        else threadUrls.add(t.url);
        if (!t.update || typeof t.update !== "string") E(`${tag}.update 缺失`);
        if (!t.watch || typeof t.watch !== "string") E(`${tag}.watch 缺失`);
        if (t.status != null && t.status !== "active") E(`${tag}.status 只能是 active`);
      });
    }
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
      if (compact && !/^[a-z][a-z0-9-]{0,63}$/.test(s.id)) E(`${tag} id 应为字母开头的英文 slug，可含数字和连字符，最多 64 字符`);
      if (!compact && s.id === "hertzflow") E(`${tag} 产品判断栏已取消，请删除整个栏目`);
      else if (!compact && !KNOWN_SECTIONS.has(s.id)) W(`${tag} id 非已知栏目（perpdex/launchpad/crypto/ai），渲染顺序会落到最后`);
    }
    if (!s.title || typeof s.title !== "string" || !s.title.trim()) E(`${tag} 缺 title`);
    if (typeof s.kicker === "string" && s.kicker.trim()) E(`${tag} 不应设置 kicker，栏目只保留一级标题`);
    if (!Array.isArray(s.items)) return E(`${tag} items 应为数组`);
    if (compact && s.items.length === 0) E(`${tag} items 不能为空，无内容的栏目应省略`);
    if (compact && s.id === "ai" && s.items.length !== 3) {
      E(`${tag} AI 栏必须恰好 3 条高权重新闻；不足时继续调研，不得用研究或低权重内容填充`);
    }
    if (!compact && s.items.length === 0 && !NEWS_SECTION_IDS.includes(s.id)) W(`${tag} items 为空（该栏目不应保留，应整栏省略）`);
    if (!compact && NEWS_SECTION_IDS.includes(s.id) && (s.items.length < NEWS_ITEM_MIN || s.items.length > NEWS_ITEM_MAX)) {
      E(`${tag} 新闻条目必须为 ${NEWS_ITEM_MIN}–${NEWS_ITEM_MAX} 条，当前 ${s.items.length} 条`);
    }

    s.items.forEach((it, j) => {
      const itag = `${tag}.items[${j}]`;
      if (!it || typeof it !== "object") return E(`${itag} 不是对象`);
      if (it.kind !== undefined && it.kind !== "news" && it.kind !== "research") E(`${itag}.kind 只能为 news 或 research`);
      const research = it.kind === "research";
      if (compact) errors.push(...validateV2Item(it, data.date, itag));
      if (compact && s.id === "ai") {
        if (!["ai", "crypto-ai"].includes(it.domain)) E(`${itag}.domain AI 栏只接受 ai 或 crypto-ai`);
        if (it.kind !== undefined && it.kind !== "news") E(`${itag}.kind AI 栏只接受 news，不能用研究填充`);
        if (!Number.isInteger(it.importance_score) || it.importance_score < 75 || it.importance_score > 100) {
          E(`${itag}.importance_score 应为 75–100 的整数，表示五维百分制筛选分值`);
        }
        const previousScore = s.items[j - 1]?.importance_score;
        if (j > 0 && Number.isInteger(previousScore) && Number.isInteger(it.importance_score) && it.importance_score > previousScore) {
          E(`${itag}.importance_score AI 新闻须按分数降序排列`);
        }
      } else if (compact && ["ai", "crypto-ai"].includes(it.domain)) {
        E(`${itag}.domain 所有 ai 或 crypto-ai 条目只能放在 ai 栏`);
      }
      if (research) errors.push(...validateResearchItem(it, data.date, itag, data.editorial_version));
      if (!it.headline || typeof it.headline !== "string") E(`${itag} 缺 headline`);
      const bodyOk = typeof it.body === "string"
        ? it.body.trim().length > 0
        : Array.isArray(it.body) && it.body.length > 0 && it.body.every((p) => typeof p === "string");
      if (!bodyOk) E(`${itag} body 应为非空字符串或非空字符串数组`);
      if (bodyOk) {
        const parts = Array.isArray(it.body) ? it.body : [it.body];
        if (parts.some((part) => /\*\*二阶效应\*\*/.test(part))) E(`${itag} 二阶效应段已取消，请删除或把必要事实并入事件、机制或 context`);
      }
      if (!isHttpUrl(it.url)) E(`${itag} url 缺失或非 http(s): ${JSON.stringify(it.url)}`);
      if (!research && !isDate(it.date)) E(`${itag} date 缺失或格式错: ${JSON.stringify(it.date)}`);
      if (it.source != null && typeof it.source !== "string") E(`${itag} source 应为字符串`);
      if (!research && it.references != null) {
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
      } else if (!research && typeof it.source === "string" && /\s[\/／]\s|、/.test(it.source)) {
        W(`${itag} source 看起来包含多个来源，但没有 references 可核查链接`);
      }
      if (!compact && it.context != null) {
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
      } else if (!compact && hasMaterialMetric(it)) {
        W(`${itag} 含可能影响判断的数字，但未提供 context 量级说明`);
      }
    });
  });
  for (const id of NEWS_SECTION_IDS) {
    if (!compact && !seenIds.has(id)) E(`缺少必需新闻栏目：${id}（每栏 ${NEWS_ITEM_MIN}–${NEWS_ITEM_MAX} 条）`);
  }
  if (compact && !seenIds.has("ai")) E("v2 缺少必需 AI 栏：id=ai，每天恰好 3 条高权重新闻");

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

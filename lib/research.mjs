// 项目研究与新闻共用展示外壳，但来源发布日期和本次核验日期分别记录。
export const RESEARCH_CATEGORIES = Object.freeze({
  "perp-protocol": "永续协议",
  "trading-frontend": "交易前端",
  "spot-infrastructure": "现货基础设施",
  "prediction-market": "预测市场",
  other: "其他项目",
});

export const DISCUSSION_AFFILIATIONS = Object.freeze({
  official: "官方",
  independent: "独立讨论",
  sponsored: "赞助内容",
  unknown: "关系未确认",
});

export const isIsoDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date) && date.toISOString().slice(0, 10) === value;
};

export const isHttpUrl = (value) => {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
};

export const extractUrlDate = (url = "") => {
  if (typeof url !== "string") return null;
  const match = url.match(/\b(20\d{2})[\/\-_](0[1-9]|1[0-2])[\/\-_](0[1-9]|[12]\d|3[01])\b/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return isIsoDate(iso) ? { iso, d: new Date(`${iso}T00:00:00Z`) } : null;
};

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, minimum = 1) => typeof value === "string" && value.trim().length >= minimum;

// 与渲染器一致：只去掉空白及受支持的 **粗体** 标记，其余可见字符均计1。
export const visibleCharCount = (value) => Array.from(String(value || "")
  .replace(/\*\*([^*]+)\*\*/g, "$1")
  .replace(/\s/g, "")).length;

const headlineDates = (headline) => typeof headline === "string"
  ? [...headline.matchAll(/(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|(?:\d{4}年)?\d{1,2}月\d{1,2}日)/g)].map(([match]) => match)
  : [];

// 只识别研究时间包装，不把普通语义中的“今天”或数值区间一律当日期。
const headlineUsesCheckDateFraming = (headline) => typeof headline === "string" && (
  /截至\s*(?:(?:今天|今日|当日|本日)|(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])(?!\d))/.test(headline)
  || /^\s*(?:(?:今天|今日|当日|本日)|(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01]))\s*(?:研究|核验)/.test(headline)
);

const headlineIncludesDate = (headline, date) => {
  if (typeof headline !== "string" || !isIsoDate(date)) return false;
  const [year, month, day] = date.split("-");
  return headlineDates(headline).some((candidate) => candidate === date || new RegExp(`^(?:${year}年)?0?${Number(month)}月0?${Number(day)}日$`).test(candidate));
};

export function validateV2Item(item, reportDate, tag = "item") {
  const errors = [];
  const E = (message) => errors.push(`${tag}.${message}`);
  if (!object(item)) return [`${tag} 应为对象`];
  if (!["crypto", "ai", "crypto-ai"].includes(item.domain)) E("domain 必须是 crypto、ai 或 crypto-ai");
  if (!text(item.relevance, 12)) E("relevance 应为至少 12 字的具体关联与价值说明");
  const headlineLength = Array.from(String(item.headline || "").replace(/\s/g, "")).length;
  if (!text(item.headline) || headlineLength < 12 || headlineLength > 90) E("headline 应为 12–90 字，完整说明主体及具体事件、机制或数据结论");
  if (typeof item.body !== "string") E("body 必须是单一字符串");
  else {
    if (/[\r\n\u2028\u2029]/.test(item.body) || /[•●▪◦‣⁃]/.test(item.body) || /^\s*(?:[-+*]|\d+[.)、])\s+/.test(item.body)) {
      E("body 必须是单段连续正文，不得换行或使用项目符号");
    }
    const length = visibleCharCount(item.body);
    if (length < 70 || length > 150) E(`body 应为 70–150 个可见字符，当前 ${length} 字`);
    const labels = /(?:^|[\n。！？!?；;])\s*(?:事件|机制|影响|背景|结论|判断|GTM(?:\s*策略)?|产品策略|产品|选题理由|尚未确认|未知项|讨论|分析推断)\s*[:：]/i;
    if (labels.test(item.body) || /\*\*[^*\n]{1,24}\*\*\s*[:：]/.test(item.body) || /【[^】\n]{1,24}】\s*[:：]?/.test(item.body) || /^\s{0,3}#{1,6}\s+/m.test(item.body)) {
      E("body 不应使用事件、机制、影响等标签式小标题，请写成连贯正文");
    }
  }
  if (Object.hasOwn(item, "context")) E("context 已停用，必要事实和限制应并入 body");
  const hasEventDate = item.event_date != null;
  const hasSnapshotDate = Object.hasOwn(item, "snapshot_date");
  if (hasSnapshotDate) {
    if (item.kind !== "research") E("snapshot_date 仅用于 research 数据快照，不能替代新闻事件日期");
    if (hasEventDate) E("snapshot_date 与 event_date 互斥，请按事件或数据快照选择时间类型");
    if (!isIsoDate(item.snapshot_date)) E("snapshot_date 应为真实 YYYY-MM-DD 数据快照日期");
    else {
      if (isIsoDate(reportDate) && item.snapshot_date > reportDate) E("snapshot_date 不能晚于报告日期");
      if (!headlineIncludesDate(item.headline, item.snapshot_date) || !/截至/.test(item.headline)) {
        E("headline 数据快照标题必须明确截至，并包含与 snapshot_date 对应的 YYYY-MM-DD 或 M月D日");
      }
    }
  }
  if (item.kind !== "research" || hasEventDate) {
    if (!isIsoDate(item.event_date)) E("event_date 应为真实 YYYY-MM-DD 事件日期");
    else {
      if (isIsoDate(reportDate) && item.event_date > reportDate) E("event_date 不能晚于报告日期");
      if (!headlineIncludesDate(item.headline, item.event_date)) E("headline 必须包含与 event_date 对应的 YYYY-MM-DD 或 M月D日");
    }
  } else if (!hasSnapshotDate && (headlineDates(item.headline).length || headlineUsesCheckDateFraming(item.headline))) {
    E("headline 无 event_date 或 snapshot_date 的机制研究应使用无日期标题，checked_at 核验日不能作为标题时间");
  }
  return errors;
}

// 结构与时效两道关卡均调用本函数，不能只加 kind:research 就绕过日期要求。
export function validateResearchItem(item, reportDate, tag = "research", editorialVersion) {
  const errors = [];
  const E = (message) => errors.push(`${tag}.${message}`);
  if (!object(item)) return [`${tag} 应为对象`];
  if (item.kind !== "research") E("kind 必须是 research");
  if (!isIsoDate(reportDate)) E("报告日期无效");
  if (!text(item.headline)) E("headline 缺失");
  const body = typeof item.body === "string" ? [item.body] : item.body;
  if (!Array.isArray(body) || !body.length || !body.every((part) => text(part))) {
    E("body 应为非空研究摘要");
  } else if (editorialVersion !== 2 && body.join(" ").split(/[。！？!?]+/).filter((part) => part.trim()).length > 2) {
    E("body 只保留 1–2 句研究摘要");
  }

  const checkSource = (source, path) => {
    if (!object(source)) return E(`${path} 应为对象`);
    if (!text(source.source)) E(`${path}.source 缺失`);
    if (!isHttpUrl(source.url)) E(`${path}.url 应为有效 http(s) 链接`);
    if (!isIsoDate(source.checked_at) || source.checked_at !== reportDate) {
      E(`${path}.checked_at 必须等于报告日期 ${reportDate}`);
    }
    const urlDate = extractUrlDate(source.url);
    if (source.date == null) {
      if (urlDate) E(`${path}.date 未标注，但 URL 内嵌日期=${urlDate.iso}，请核实真实发布日期`);
    } else if (!isIsoDate(source.date)) {
      E(`${path}.date 应为真实 YYYY-MM-DD 发布日期，无日期文档用 null 或省略`);
    } else {
      if (isIsoDate(reportDate) && source.date > reportDate) E(`${path}.date 不能晚于报告日期`);
      if (urlDate && source.date !== urlDate.iso) E(`${path}.date=${source.date} 与 URL 内嵌日期=${urlDate.iso} 冲突`);
    }
  };
  checkSource(item, "主来源");
  if (!Array.isArray(item.references) || item.references.length < 1 || item.references.length > 3) {
    E("references 必须有 1–3 条补充来源，至少两个独立 URL");
  } else {
    const urls = new Set([item.url]);
    item.references.forEach((reference, index) => {
      checkSource(reference, `references[${index}]`);
      if (isHttpUrl(reference?.url)) {
        if (urls.has(reference.url)) E(`references[${index}].url 与主来源或其他补充来源重复`);
        urls.add(reference.url);
      }
    });
    if (urls.size < 2) E("references 至少需要两个不同 URL");
  }

  const research = item.research;
  if (!object(research)) return [...errors, `${tag}.research 应为对象`];
  if (!text(research.project)) E("research.project 缺失");
  if (!Object.hasOwn(RESEARCH_CATEGORIES, research.category)) E("research.category 应为 perp-protocol/trading-frontend/spot-infrastructure/prediction-market/other");
  for (const field of ["why_now", "mechanism", "gtm", "product", "implication", "unknowns"]) {
    if (!text(research[field], 12)) E(`research.${field} 应为至少 12 字的具体说明`);
  }
  if (!Array.isArray(research.discussions) || research.discussions.length > 4) {
    E("research.discussions 应为 0–4 条讨论数组");
  } else {
    if (research.discussions.length === 0 && !text(research.discussion_gap, 12)) E("research.discussion_gap 应具体说明未找到可核验讨论的原因（至少 12 字）");
    research.discussions.forEach((discussion, index) => {
      const path = `research.discussions[${index}]`;
      if (!object(discussion)) return E(`${path} 应为对象`);
      if (!text(discussion.speaker)) E(`${path}.speaker 缺失`);
      if (!Object.hasOwn(DISCUSSION_AFFILIATIONS, discussion.affiliation)) E(`${path}.affiliation 应为 official/independent/sponsored/unknown`);
      if (!text(discussion.summary)) E(`${path}.summary 缺失`);
      if (!isHttpUrl(discussion.url)) E(`${path}.url 应为有效 http(s) 链接`);
      if (!isIsoDate(discussion.date)) E(`${path}.date 应为真实 YYYY-MM-DD 发布日期`);
      else {
        const age = (new Date(`${reportDate}T00:00:00Z`) - new Date(`${discussion.date}T00:00:00Z`)) / 86400000;
        if (age < 0 || age > 30) E(`${path}.date 应在报告日前 0–30 天内；旧观点只能作为背景`);
        const urlDate = extractUrlDate(discussion.url);
        if (urlDate && discussion.date !== urlDate.iso) E(`${path}.date 与 URL 内嵌日期=${urlDate.iso} 冲突`);
      }
    });
  }
  return errors;
}

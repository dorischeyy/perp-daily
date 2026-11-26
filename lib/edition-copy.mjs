import { DISCUSSION_AFFILIATIONS, RESEARCH_CATEGORIES, hasChinese } from "./research.mjs";

const en = {
  lang: "en", locale: "en-US", name: "Perp DEX Daily", masthead: "PERP DEX DAILY",
  description: "Perp DEX Daily is built and maintained by Doris. It covers perpetual futures exchanges, crypto market infrastructure and AI products.",
  subject: "Perpetual Futures and Market Infrastructure", issue: n => `Issue ${n}`,
  credit: "Built and maintained by Doris", footer: "Automated publication · For research purposes only. Not investment advice.",
  readEdition: "Read the edition",
  source: "Source", sources: "Sources", published: "Published", verified: "Verified",
  undated: "publication date unavailable", unrecorded: "Not recorded", additionalSource: "Additional source: ",
  sourceLabel: (n, details) => `Source ${n}: ${details}`, separator: "; ",
  discussionSource: "Discussion source", byline: (speaker, affiliation) => `${speaker} (${affiliation})`,
  affiliations: DISCUSSION_AFFILIATIONS, categories: RESEARCH_CATEGORIES, unclassified: "Unclassified",
  scale: "Scale", selection: "Selection rationale", mechanism: "Mechanism", gtm: "GTM strategy", product: "Product strategy",
  discussion: "Discussion", gap: "Evidence gap", research: "Project research", verifiedOn: "verification date",
  interpretation: "Interpretation", unconfirmed: "Not confirmed", productObservations: "Product observations",
  developments: "Latest developments", since: "Since", day: n => `Day ${n}`, tier: t => `Tier ${t}`, next: "Next milestone:",
};

const zh = {
  lang: "zh-CN", locale: "zh-CN", name: "Perp DEX 日报", masthead: "PERP DEX 日报",
  description: "Perp DEX 日报由 Doris 开发并维护，追踪永续合约交易所、加密市场基础设施与 AI 产品进展。",
  subject: "永续合约与市场基础设施", issue: n => `第 ${n} 期`,
  credit: "Doris 开发与维护", footer: "自动化编发 · 仅供研究参考，不构成投资建议",
  readEdition: "阅读日报",
  source: "来源", sources: "来源", published: "发布", verified: "核验",
  undated: "未标发布日期", unrecorded: "未记录", additionalSource: "补充来源：",
  sourceLabel: (n, details) => `来源 ${n}：${details}`, separator: "；",
  discussionSource: "讨论原文", byline: (speaker, affiliation) => `${speaker}（${affiliation}）`,
  affiliations: { official: "官方", independent: "独立讨论", sponsored: "赞助内容", unknown: "关系未确认" },
  categories: { "perp-protocol": "永续协议", "trading-frontend": "交易前端", "spot-infrastructure": "现货基础设施", "prediction-market": "预测市场", other: "其他项目" },
  unclassified: "分类未确认",
  scale: "量级参照", selection: "选题理由", mechanism: "机制", gtm: "GTM 策略", product: "产品策略",
  discussion: "谁在讨论", gap: "讨论核验缺口", research: "项目研究", verifiedOn: "核验日",
  interpretation: "判断（分析推断）", unconfirmed: "尚未确认", productObservations: "产品观察",
  developments: "今日进展", since: "自", day: n => `第 ${n} 天`, tier: t => `${t} 级`, next: "下一步看：",
};

// Daily copy is Chinese. Archived English editions keep their original display language.
export function editionCopy(text) {
  return !text || hasChinese(text) ? zh : en;
}

export function reportCopy(content) {
  return editionCopy(content.lead || content.sections?.[0]?.items?.[0]?.headline);
}

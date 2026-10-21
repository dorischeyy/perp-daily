#!/usr/bin/env node
// 只生成检索计划，不联网、不写配置，也不把待查名单当成已核实项目。
import { readFileSync } from "node:fs";

const REQUIRED_AI_IDS = ["anthropic", "openai", "scale-ai", "xai", "moonshot", "deepseek", "alibaba-qwen"];

function aiDailyScan(registry) {
  const watchlist = registry.ai_watchlist;
  if (!Array.isArray(watchlist)) throw new Error("AI每日必扫名单缺失");
  const ids = watchlist.map((entry) => entry?.id);
  if (new Set(ids).size !== ids.length) throw new Error("AI每日必扫名单ID重复");
  const missing = REQUIRED_AI_IDS.filter((id) => !ids.includes(id));
  if (missing.length) throw new Error(`AI每日必扫名单缺少：${missing.join("、")}`);
  const policy = registry.ai_daily_policy;
  if (policy?.window_days !== 3) throw new Error("AI每日检索窗口必须为3天");
  if (policy.selection?.max_items !== 3 || policy.selection?.recommended_min_score !== 75 ||
      policy.selection?.audit_section !== "A5") {
    throw new Error("AI筛选须保留最高3条、75分门槛及A5人工审计");
  }
  const weights = { structural: 30, relevance: 25, durability: 20, actionability: 15, evidence: 10 };
  if (Object.entries(weights).some(([key, value]) => policy.selection.weights?.[key] !== value)) {
    throw new Error("AI评分权重须为结构30、相关25、持续20、行动15、证据10");
  }
  return watchlist.map((entry) => {
    if (typeof entry.name !== "string" || !entry.name.trim() ||
        !Array.isArray(entry.aliases) || !entry.aliases.length ||
        entry.aliases.some((alias) => typeof alias !== "string" || !alias.trim())) {
      throw new Error(`AI每日必扫项目${entry.id}缺少名称或有效别名`);
    }
    const terms = [...new Set([entry.name, ...entry.aliases])].map((term) => JSON.stringify(term)).join(" OR ");
    const subject = `(${terms})`;
    return {
      id: entry.id,
      name: entry.name,
      aliases: entry.aliases,
      window_days: 3,
      official_discovery_queries: [
        `${subject} (official OR announcement OR documentation OR changelog)`,
        `${subject} (官方 OR 公告 OR 文档 OR 更新日志)`,
      ],
      queries: [
        {
          purpose: "releases_capabilities_access",
          query_en: `${subject} (release OR launch OR model capabilities OR API availability OR rollout)`,
          query_zh: `${subject} (发布 OR 上线 OR 模型能力 OR API可用性 OR 开放范围)`,
          window_days: 3,
        },
        {
          purpose: "pricing_safety_adoption",
          query_en: `${subject} (pricing OR safety OR security OR production adoption OR customer deployment)`,
          query_zh: `${subject} (定价 OR 价格 OR 安全 OR 真实采用 OR 生产部署 OR 客户落地)`,
          window_days: 3,
        },
      ],
    };
  });
}

export function researchPlan(registry, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("日期必须为有效的 YYYY-MM-DD");
  }
  if (!Array.isArray(registry.projects) || !registry.projects.length) throw new Error("项目雷达为空");
  if (new Set(registry.projects.map((p) => p.id)).size !== registry.projects.length) throw new Error("项目ID重复");
  const aiScan = aiDailyScan(registry);
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const priority = date <= registry.priority_until ? registry.projects.filter((p) => p.priority) : [];
  const rotation = registry.projects.filter((p) => !priority.includes(p));
  const selected = [...priority];
  const count = Math.max(registry.projects_per_day || 4, priority.length + 1);
  for (let i = 0; i < rotation.length && selected.length < count; i += 1) {
    selected.push(rotation[(day + i) % rotation.length]);
  }
  const discovery = registry.discovery_queries || [];
  return {
    date,
    instruction: "先读近7期自评A4补入待查项目；列表不是收录配额或热度排名。名单外发现的新名称也要追查。",
    projects: selected.map((p) => ({
      id: p.id, name: p.name, category_to_verify: p.category,
      official_entrypoints: p.sources, questions: p.questions, caution: p.caution,
      queries: Object.entries(registry.query_templates).map(([purpose, template]) => ({
        purpose,
        query: template.replaceAll("{name}", `"${p.name}"`),
        window_days: purpose === "discussion" ? 30 : null,
      })),
      followup_queries: p.queries || p.aliases.map((alias) => `"${alias}" docs referral trader review`),
    })),
    discovery: Array.from({ length: Math.min(2, discovery.length) }, (_, i) => discovery[(day * 2 + i) % discovery.length]),
    ai_daily_scan: aiScan,
    ai_scan_rule: registry.ai_daily_policy.scan_rule,
    ai_selection: registry.ai_daily_policy.selection,
    evidence_rule: "搜索摘要只当线索。讨论记作者/关系/日期/观点/原链接；机制核实官方原文。不可读如实记录，不能编造热度。",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const date = process.argv[2] || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
    const registry = JSON.parse(readFileSync(new URL("../config/project-radar.json", import.meta.url), "utf8"));
    console.log(JSON.stringify(researchPlan(registry, date), null, 2));
  } catch (e) {
    console.error(`检索计划失败：${e.message}`);
    process.exit(1);
  }
}

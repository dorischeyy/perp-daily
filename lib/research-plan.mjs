#!/usr/bin/env node

// Generate a search plan from the project registry. The plan lists candidates for verification.

import { readFileSync } from "node:fs";

const REQUIRED_AI_IDS = ["anthropic", "openai", "scale-ai", "xai", "moonshot", "deepseek", "alibaba-qwen"];

function aiDailyScan(registry) {
  const watchlist = registry.ai_watchlist;
  if (!Array.isArray(watchlist)) throw new Error("AI watchlist is missing");
  const ids = watchlist.map((entry) => entry?.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate AI watchlist ID");
  const missing = REQUIRED_AI_IDS.filter((id) => !ids.includes(id));
  if (missing.length) throw new Error(`missing required AI vendors: ${missing.join(", ")}`);
  const policy = registry.ai_daily_policy;
  if (policy?.window_days !== 3) throw new Error("AI search window must be 3 days");
  if (policy.selection?.max_items !== 3 || policy.selection?.recommended_min_score !== 75 ||
      policy.selection?.audit_section !== "A5") {
    throw new Error("AI selection requires 3 items, a minimum score of 75 and an A5 audit");
  }
  const weights = { structural: 30, relevance: 25, durability: 20, actionability: 15, evidence: 10 };
  if (Object.entries(weights).some(([key, value]) => policy.selection.weights?.[key] !== value)) {
    throw new Error("invalid AI scoring weights");
  }
  return watchlist.map((entry) => {
    if (typeof entry.name !== "string" || !entry.name.trim() ||
        !Array.isArray(entry.aliases) || !entry.aliases.length ||
        entry.aliases.some((alias) => typeof alias !== "string" || !alias.trim())) {
      throw new Error(`missing name or valid aliases for ${entry.id}`);
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
        `${subject} (site:cn OR site:aliyun.com) (announcement OR documentation)`,
      ],
      queries: [
        {
          purpose: "releases_capabilities_access",
          query_en: `${subject} (release OR launch OR model capabilities OR API availability OR rollout)`,
          query_zh: `${subject} (release OR model capabilities OR API access OR rollout)`,
          window_days: 3,
        },
        {
          purpose: "pricing_safety_adoption",
          query_en: `${subject} (pricing OR safety OR security OR production adoption OR customer deployment)`,
          query_zh: `${subject} (pricing OR safety evaluation OR customer deployment OR production adoption)`,
          window_days: 3,
        },
      ],
    };
  });
}

export function researchPlan(registry, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("date must be a valid YYYY-MM-DD");
  }
  if (!Array.isArray(registry.projects) || !registry.projects.length) throw new Error("project registry is empty");
  if (new Set(registry.projects.map((p) => p.id)).size !== registry.projects.length) throw new Error("duplicate project ID");
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
    instruction: "Review open questions from the last seven A4 audits and investigate relevant projects outside the registry.",
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
    ai_query_localization: {
      field: "query_zh",
      target_language: "zh",
      instruction: "Translate the search concepts into Chinese before submitting query_zh or the Chinese official-source discovery query. Keep brand names and search operators, add verified Chinese vendor aliases, and record which sources the search returned.",
    },
    ai_scan_rule: registry.ai_daily_policy.scan_rule,
    ai_selection: registry.ai_daily_policy.selection,
    evidence_rule: "Verify primary sources. Record authors, affiliations, dates and URLs. Note inaccessible sources and evidence gaps.",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const date = process.argv[2] || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
    const registry = JSON.parse(readFileSync(new URL("../config/project-radar.json", import.meta.url), "utf8"));
    console.log(JSON.stringify(researchPlan(registry, date), null, 2));
  } catch (e) {
    console.error(`Research plan failed: ${e.message}`);
    process.exit(1);
  }
}

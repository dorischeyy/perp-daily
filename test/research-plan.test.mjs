import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { researchPlan } from "../lib/research-plan.mjs";

const registry = JSON.parse(readFileSync(new URL("../config/project-radar.json", import.meta.url), "utf8"));

test("首周检索覆盖三条用户线索、独立协议及两条名单外发现", () => {
  const plan = researchPlan(registry, "2026-10-21");
  for (const id of ["trasia", "deepbook", "predict-fun"]) assert.ok(plan.projects.some((p) => p.id === id));
  assert.ok(plan.projects.some((p) => p.category_to_verify === "perp-protocol"));
  assert.equal(plan.discovery.length, 2);
  assert.equal(new Set(plan.discovery.map((d) => d.id)).size, 2);
  assert.equal(plan.projects[0].queries.find((q) => q.purpose === "mechanism").window_days, null);
  assert.equal(plan.projects[0].queries.find((q) => q.purpose === "discussion").window_days, 30);
});

test("轮换能覆盖全名单，不会永久只查用户举例或头部", () => {
  const seen = new Set();
  for (let d = 1; d <= 15; d += 1) {
    for (const p of researchPlan(registry, `2026-11-${String(d).padStart(2, "0")}`).projects) seen.add(p.id);
  }
  assert.equal(seen.size, registry.projects.length);
});

test("非法日期和重复项目会明确失败", () => {
  assert.throws(() => researchPlan(registry, "2026-02-30"), /日期/);
  assert.throws(() => researchPlan(registry, "yesterday"), /日期/);
  assert.throws(() => researchPlan({ ...registry, projects: [registry.projects[0], registry.projects[0]] }, "2026-10-21"), /重复/);
});

const requiredAiIds = ["anthropic", "openai", "scale-ai", "xai", "moonshot", "deepseek", "alibaba-qwen"];

test("AI七家每天必扫且跨日期不受Perp项目轮换影响", () => {
  for (const date of ["2026-10-21", "2026-10-27", "2026-10-28", "2026-11-15", "2027-01-01"]) {
    const plan = researchPlan(registry, date);
    assert.deepEqual(plan.ai_daily_scan.map((entry) => entry.id), requiredAiIds);
    for (const entry of plan.ai_daily_scan) {
      assert.equal(entry.window_days, 3);
      assert.equal(entry.queries.length, 2);
      assert.equal(entry.official_discovery_queries.length, 2);
      assert.ok(entry.official_discovery_queries.every((query) => !/https?:\/\//.test(query)));
      for (const query of entry.queries) {
        assert.equal(query.window_days, 3);
        assert.match(query.query_zh, /[\u4e00-\u9fff]/);
        for (const name of [entry.name, ...entry.aliases]) {
          assert.ok(query.query_en.includes(JSON.stringify(name)));
          assert.ok(query.query_zh.includes(JSON.stringify(name)));
        }
      }
    }
    assert.equal(plan.ai_selection.max_items, 3);
    assert.equal(plan.ai_selection.recommended_min_score, 75);
    assert.equal(plan.ai_selection.audit_section, "A5");
    assert.deepEqual(plan.ai_selection.weights, { structural: 30, relevance: 25, durability: 20, actionability: 15, evidence: 10 });
  }
});

test("删除任一家AI必扫项目或整份名单时计划必须报错", () => {
  for (const id of requiredAiIds) {
    const incomplete = { ...registry, ai_watchlist: registry.ai_watchlist.filter((entry) => entry.id !== id) };
    assert.throws(() => researchPlan(incomplete, "2026-10-21"), new RegExp(`AI每日必扫名单缺少.*${id}`));
  }
  const missing = { ...registry };
  delete missing.ai_watchlist;
  assert.throws(() => researchPlan(missing, "2026-10-21"), /AI每日必扫名单缺失/);
});

test("AI名单重复、空别名或每日窗口与筛选规则被改坏时明确失败", () => {
  const duplicate = { ...registry, ai_watchlist: [...registry.ai_watchlist, registry.ai_watchlist[0]] };
  assert.throws(() => researchPlan(duplicate, "2026-10-21"), /AI每日必扫名单ID重复/);
  const invalidAlias = structuredClone(registry);
  invalidAlias.ai_watchlist[0].aliases = [];
  assert.throws(() => researchPlan(invalidAlias, "2026-10-21"), /有效别名/);
  const wrongWindow = structuredClone(registry);
  wrongWindow.ai_daily_policy.window_days = 30;
  assert.throws(() => researchPlan(wrongWindow, "2026-10-21"), /窗口必须为3天/);
  const wrongSelection = structuredClone(registry);
  wrongSelection.ai_daily_policy.selection.max_items = 7;
  assert.throws(() => researchPlan(wrongSelection, "2026-10-21"), /最高3条/);
  const wrongWeights = structuredClone(registry);
  wrongWeights.ai_daily_policy.selection.weights.relevance = 30;
  assert.throws(() => researchPlan(wrongWeights, "2026-10-21"), /评分权重/);
});

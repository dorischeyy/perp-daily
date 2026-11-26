import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { researchPlan } from "../lib/research-plan.mjs";

const registry = JSON.parse(readFileSync(new URL("../config/project-radar.json", import.meta.url), "utf8"));

test("Includes priority leads, independent protocols and outside searches", () => {
  const plan = researchPlan(registry, "2026-10-21");
  for (const id of ["trasia", "deepbook", "predict-fun"]) assert.ok(plan.projects.some((p) => p.id === id));
  assert.ok(plan.projects.some((p) => p.category_to_verify === "perp-protocol"));
  assert.equal(plan.discovery.length, 2);
  assert.equal(new Set(plan.discovery.map((d) => d.id)).size, 2);
  assert.equal(plan.projects[0].queries.find((q) => q.purpose === "mechanism").window_days, null);
  assert.equal(plan.projects[0].queries.find((q) => q.purpose === "discussion").window_days, 30);
});

test("Rotates through the complete registry", () => {
  const seen = new Set();
  for (let d = 1; d <= 15; d += 1) {
    for (const p of researchPlan(registry, `2026-11-${String(d).padStart(2, "0")}`).projects) seen.add(p.id);
  }
  assert.equal(seen.size, registry.projects.length);
});

test("Rejects invalid dates and duplicate projects", () => {
  assert.throws(() => researchPlan(registry, "2026-02-30"), /date/);
  assert.throws(() => researchPlan(registry, "yesterday"), /date/);
  assert.throws(() => researchPlan({ ...registry, projects: [registry.projects[0], registry.projects[0]] }, "2026-10-21"), /duplicat/);
});

const requiredAiIds = ["anthropic", "openai", "scale-ai", "xai", "moonshot", "deepseek", "alibaba-qwen"];

test("Checks all seven AI vendors independently of project rotation", () => {
  for (const date of ["2026-10-21", "2026-10-27", "2026-10-28", "2026-11-15", "2027-01-01"]) {
    const plan = researchPlan(registry, date);
    assert.equal(plan.ai_query_localization.field, "query_zh");
    assert.equal(plan.ai_query_localization.target_language, "zh");
    assert.match(plan.ai_query_localization.instruction, /Translate the search concepts into Chinese/);
    assert.deepEqual(plan.ai_daily_scan.map((entry) => entry.id), requiredAiIds);
    for (const entry of plan.ai_daily_scan) {
      assert.equal(entry.window_days, 3);
      assert.equal(entry.queries.length, 2);
      assert.equal(entry.official_discovery_queries.length, 2);
      assert.ok(entry.official_discovery_queries.every((query) => !/https?:\/\//.test(query)));
      for (const query of entry.queries) {
        assert.equal(query.window_days, 3);
        assert.match(query.query_zh, query.purpose === "releases_capabilities_access" ? /API access/ : /customer deployment/);
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

test("Requires every AI vendor", () => {
  for (const id of requiredAiIds) {
    const incomplete = { ...registry, ai_watchlist: registry.ai_watchlist.filter((entry) => entry.id !== id) };
    assert.throws(() => researchPlan(incomplete, "2026-10-21"), new RegExp(`missing required AI vendors.*${id}`));
  }
  const missing = { ...registry };
  delete missing.ai_watchlist;
  assert.throws(() => researchPlan(missing, "2026-10-21"), /AI watchlist is missing/);
});

test("Validates search windows, aliases and scoring policy", () => {
  const duplicate = { ...registry, ai_watchlist: [...registry.ai_watchlist, registry.ai_watchlist[0]] };
  assert.throws(() => researchPlan(duplicate, "2026-10-21"), /duplicate AI watchlist ID/);
  const invalidAlias = structuredClone(registry);
  invalidAlias.ai_watchlist[0].aliases = [];
  assert.throws(() => researchPlan(invalidAlias, "2026-10-21"), /valid aliases/);
  const wrongWindow = structuredClone(registry);
  wrongWindow.ai_daily_policy.window_days = 30;
  assert.throws(() => researchPlan(wrongWindow, "2026-10-21"), /window must be 3 days/);
  const wrongSelection = structuredClone(registry);
  wrongSelection.ai_daily_policy.selection.max_items = 7;
  assert.throws(() => researchPlan(wrongSelection, "2026-10-21"), /requires 3/);
  const wrongWeights = structuredClone(registry);
  wrongWeights.ai_daily_policy.selection.weights.relevance = 30;
  assert.throws(() => researchPlan(wrongWeights, "2026-10-21"), /scoring weights/);
});

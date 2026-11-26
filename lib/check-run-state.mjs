#!/usr/bin/env node

// Check publication state before starting research.
// Exit 0 to proceed, 10 when today's edition is already published, or 1 for invalid state.
// Usage: node lib/check-run-state.mjs [YYYY-MM-DD] [latest.json] [market.json]

import { readFileSync } from "node:fs";

const isDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

const beijingDate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export function inspectRunState({ today, latest, market }) {
  const errors = [];
  if (!isDate(today)) errors.push(`invalid edition date: ${today}`);
  if (!latest || typeof latest !== "object" || !isDate(latest.date)) {
    errors.push(`latest.json contains an invalid date: ${latest?.date}`);
  }
  if (errors.length) return { status: "invalid", market: "unknown", errors };

  if (latest.date > today) {
    return {
      status: "invalid",
      market: "unknown",
      errors: [`latest.json.date=${latest.date} is later than today=${today}; refusing to backdate`],
    };
  }

  let marketStatus = "missing";
  let marketDate = null;
  if (market && typeof market === "object" && market.fetched_at) {
    marketDate = beijingDate(market.fetched_at);
    marketStatus = marketDate === today ? "fresh" : marketDate ? "stale" : "invalid";
  }

  return {
    status: latest.date === today ? "already_published" : "ready",
    market: marketStatus,
    marketDate,
    errors: [],
  };
}

const readJson = (path, optional = false) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    if (optional && e.code === "ENOENT") return null;
    throw new Error(`Cannot read ${path}: ${e.message}`);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const today = process.argv[2] || beijingDate();
  const latestPath = process.argv[3] || "docs/latest.json";
  const marketPath = process.argv[4] || "docs/market.json";
  let latest;
  let market;
  try {
    latest = readJson(latestPath);
    market = readJson(marketPath, true);
  } catch (e) {
    console.error(`Preflight failed: ${e.message}`);
    process.exit(1);
  }

  const result = inspectRunState({ today, latest, market });
  console.log(`Preflight: Beijing date ${today}, latest edition ${latest.date}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`  ❌ ${error}`);
    process.exit(1);
  }
  if (result.status === "already_published") {
    console.log("ALREADY_PUBLISHED: the edition for this date already exists.");
    process.exit(10);
  }
  if (result.market === "fresh") {
    console.log(`Market data is current: ${result.marketDate}`);
  } else {
    console.log(
      `Market data is ${result.market}; omit these figures from the edition.`
    );
  }
  console.log("READY: research may begin.");
}

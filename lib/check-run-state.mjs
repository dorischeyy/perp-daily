#!/usr/bin/env node
// check-run-state.mjs — 昂贵调研前的幂等与行情快照预检。
// 用法: node lib/check-run-state.mjs [today] [latest.json] [market.json]
// 退出码：0 可继续；10 今天已发布，应无改动停止；1 状态文件损坏或日期倒退。
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
  if (!isDate(today)) errors.push(`today 非法: ${JSON.stringify(today)}`);
  if (!latest || typeof latest !== "object" || !isDate(latest.date)) {
    errors.push(`latest.json 缺少合法 date: ${JSON.stringify(latest?.date)}`);
  }
  if (errors.length) return { status: "invalid", market: "unknown", errors };

  if (latest.date > today) {
    return {
      status: "invalid",
      market: "unknown",
      errors: [`latest.json.date=${latest.date} 晚于 today=${today}，拒绝倒退生成`],
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
    throw new Error(`${path} 读取/解析失败: ${e.message}`);
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
    console.error(`⛔ 运行前检查失败：${e.message}`);
    process.exit(1);
  }

  const result = inspectRunState({ today, latest, market });
  console.log(`运行前检查 · 北京日期=${today} · latest=${latest.date}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`  ❌ ${error}`);
    process.exit(1);
  }
  if (result.status === "already_published") {
    console.log("⏹ ALREADY_PUBLISHED：今日日报已存在，停止调研、生成、渲染和发布。");
    process.exit(10);
  }
  if (result.market === "fresh") {
    console.log(`  ✅ 行情快照可用：${result.marketDate}`);
  } else {
    console.log(
      `  ⚠️ 行情快照${result.market === "missing" ? "缺失" : "不可用或陈旧"}${result.marketDate ? `（北京日期 ${result.marketDate}）` : ""}；可继续出报，但不得使用其中数字。`
    );
  }
  console.log("✅ READY：可进入信源加载与调研。");
}

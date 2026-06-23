#!/usr/bin/env node
// fetch-data.mjs — 免费拉取 perp/行情数据快照，给日报当「数字参照系」。无需任何 API key。
// 数据源：CoinGecko 公共 API（免费档）。底层用 curl（比 node fetch 在各沙箱里更稳）。
// 用法：node fetch-data.mjs [输出路径=data/market.json]
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const CG = "https://api.coingecko.com/api/v3";
const sleepSync = (s) => { try { execFileSync("sleep", [String(s)]); } catch {} };
// curl 拿 JSON；识别 CoinGecko 限流(返回 200 但 payload 带 status.error_code)并重试。
// 限流是「每分钟」窗口，退避要够长：8s/16s/24s。
const curlJSON = (u) => {
  let lastErr;
  for (let i = 1; i <= 4; i++) {
    try {
      const j = JSON.parse(
        execFileSync("curl", ["-s", "--max-time", "25", "-H", "accept: application/json", u], {
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        })
      );
      if (j && j.status && j.status.error_code) {
        throw new Error(`CG ${j.status.error_code}: ${String(j.status.error_message || "").slice(0, 50)}`);
      }
      return j;
    } catch (e) { lastErr = e; if (i < 4) sleepSync(i * 8); }
  }
  throw lastErr;
};

const out = { fetched_at: new Date().toISOString(), source: "CoinGecko (free)" };

try {
  const der = curlJSON(`${CG}/derivatives/exchanges?order=open_interest_btc_desc&per_page=20`);
  if (!Array.isArray(der)) throw new Error("derivatives 响应非数组(疑似限流/异常)");
  out.derivatives = der.map((e) => ({
    name: e.name,
    oi_btc: e.open_interest_btc,
    vol24h_btc: e.trade_volume_24h_btc,
    perps: e.number_of_perpetual_pairs,
  }));
} catch (e) { out.derivatives_error = String(e.message).slice(0, 120); }

sleepSync(3); // 免费档限流，调用之间隔开

try {
  const p = curlJSON(
    `${CG}/simple/price?ids=bitcoin,ethereum,solana,hyperliquid&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
  );
  if (!p || !p.bitcoin) throw new Error("prices 响应异常(疑似限流)");
  out.prices = p;
} catch (e) { out.prices_error = String(e.message).slice(0, 120); }

sleepSync(3);

try {
  const g = curlJSON(`${CG}/global`);
  if (!g || !g.data) throw new Error("global 响应异常(疑似限流)");
  out.global = {
    total_mcap_usd: g.data?.total_market_cap?.usd,
    mcap_change_24h_pct: g.data?.market_cap_change_percentage_24h_usd,
    btc_dominance_pct: g.data?.market_cap_percentage?.btc,
  };
} catch (e) { out.global_error = String(e.message).slice(0, 120); }

const path = process.argv[2] || "data/market.json";
mkdirSync(dirname(path) || ".", { recursive: true });
writeFileSync(path, JSON.stringify(out, null, 2));
const okCount =
  (Array.isArray(out.derivatives) && out.derivatives.length ? 1 : 0) +
  (out.prices && !out.prices_error ? 1 : 0) +
  (out.global && out.global.total_mcap_usd != null ? 1 : 0);
console.log(`✅ 数据快照写入 ${path}（${okCount}/3 组成功，fetched_at=${out.fetched_at}）`);
if (okCount < 3) console.error(`⚠️ ${3 - okCount}/3 组未拿到（可能限流），相应字段已标 *_error`);

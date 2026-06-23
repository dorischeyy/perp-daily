#!/usr/bin/env node
// fetch-data.mjs — 免费拉取 perp/行情数据快照，给日报当「数字参照系」。无需任何 API key。
// 数据源：CoinGecko 公共 API（免费档）。底层用 curl（比 node fetch 在各沙箱里更稳）。
// 用法：node fetch-data.mjs [输出路径=data/market.json]
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const CG = "https://api.coingecko.com/api/v3";
const curlJSON = (u) =>
  JSON.parse(
    execFileSync("curl", ["-s", "--max-time", "25", "-H", "accept: application/json", u], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    })
  );

const out = { fetched_at: new Date().toISOString(), source: "CoinGecko (free)" };

try {
  const der = curlJSON(`${CG}/derivatives/exchanges?order=open_interest_btc_desc&per_page=20`);
  out.derivatives = der.map((e) => ({
    name: e.name,
    oi_btc: e.open_interest_btc,
    vol24h_btc: e.trade_volume_24h_btc,
    perps: e.number_of_perpetual_pairs,
  }));
} catch (e) { out.derivatives_error = String(e.message).slice(0, 120); }

try {
  out.prices = curlJSON(
    `${CG}/simple/price?ids=bitcoin,ethereum,solana,hyperliquid&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
  );
} catch (e) { out.prices_error = String(e.message).slice(0, 120); }

try {
  const g = curlJSON(`${CG}/global`);
  out.global = {
    total_mcap_usd: g.data?.total_market_cap?.usd,
    mcap_change_24h_pct: g.data?.market_cap_change_percentage_24h_usd,
    btc_dominance_pct: g.data?.market_cap_percentage?.btc,
  };
} catch (e) { out.global_error = String(e.message).slice(0, 120); }

const path = process.argv[2] || "data/market.json";
mkdirSync("data", { recursive: true });
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(`✅ 数据快照写入 ${path}`);

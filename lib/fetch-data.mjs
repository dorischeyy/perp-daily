#!/usr/bin/env node
// Fetch a public snapshot of perpetual futures venues and crypto markets.
// Uses the public CoinGecko API via curl. An API key is not required.
// Usage: node lib/fetch-data.mjs [output path]
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const CG = "https://api.coingecko.com/api/v3";
const sleepSync = (s) => { try { execFileSync("sleep", [String(s)]); } catch {} };
// The public API may signal rate limits through status.error_code in an HTTP 200 response.
// Retry after 8, 16, and 24 seconds to account for per-minute limits.
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
  if (!Array.isArray(der)) throw new Error("Expected a derivatives array. The API may have returned a rate-limit response.");
  out.derivatives = der.map((e) => ({
    name: e.name,
    oi_btc: e.open_interest_btc,
    vol24h_btc: e.trade_volume_24h_btc,
    perps: e.number_of_perpetual_pairs,
  }));
} catch (e) { out.derivatives_error = String(e.message).slice(0, 120); }

sleepSync(3); // Space requests on the free tier.

try {
  const p = curlJSON(
    `${CG}/simple/price?ids=bitcoin,ethereum,solana,hyperliquid&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
  );
  if (!p || !p.bitcoin) throw new Error("Unexpected prices response. Check possible rate limits.");
  out.prices = p;
} catch (e) { out.prices_error = String(e.message).slice(0, 120); }

sleepSync(3);

try {
  const g = curlJSON(`${CG}/global`);
  if (!g || !g.data) throw new Error("Unexpected global-market response. Check possible rate limits.");
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
console.log(`Wrote market snapshot to ${path} (${okCount}/3 groups available, fetched_at=${out.fetched_at}).`);
if (okCount < 3) console.error(`${3 - okCount}/3 groups unavailable. Their *_error fields record the failures.`);

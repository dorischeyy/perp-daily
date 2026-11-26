#!/usr/bin/env node
// Send one edition's title, URL, and summary to enabled channels.
// Register each supported channel type in ADAPTERS and configure it in channels.json.
//
// Usage: node lib/deliver.mjs <title> <url> [summary] [channels.json]
// Paths resolve relative to the repository, with a fallback to the sample configuration.
//
// Configure webhook references as env:VAR. Store their values outside the repository.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// Load the optional root .env without overriding existing environment variables.
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

// Map the shared edition fields to each provider's webhook payload.
const ADAPTERS = {
  // Interactive card for a Feishu group bot.
  feishu: ({ title, url, summary }) => ({
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: { template: "red", title: { tag: "plain_text", content: title } },
      elements: [
        ...(summary ? [{ tag: "div", text: { tag: "lark_md", content: summary } }] : []),
        { tag: "action", actions: [
          { tag: "button", text: { tag: "plain_text", content: "Read the edition" }, type: "primary", url },
        ]},
      ],
    },
  }),
  // Slack incoming webhook with Block Kit
  slack: ({ title, url, summary }) => ({
    text: `${title} — ${url}`, // Notification fallback text
    blocks: [
      { type: "header", text: { type: "plain_text", text: title, emoji: true } },
      ...(summary ? [{ type: "section", text: { type: "mrkdwn", text: summary } }] : []),
      { type: "actions", elements: [
        { type: "button", text: { type: "plain_text", text: "Read the edition", emoji: true }, url, style: "primary" },
      ]},
    ],
  }),
};

function resolveWebhook(v) {
  if (typeof v === "string" && v.startsWith("env:")) return process.env[v.slice(4)] || "";
  return v || "";
}

// Use synchronous backoff around the synchronous curl invocation.
function sleepSync(sec) {
  try { execFileSync("sleep", [String(sec)]); } catch {}
}

// A successful HTTP response must also satisfy the channel's application status.
// A Feishu bot can return HTTP 200 and report an error code in the body.
export function isDeliverySuccess(status, body) {
  if (!(status >= 200 && status < 300)) return false;
  const t = String(body || "").trim();
  if (!t) return true; // Some webhooks return an empty response on success.
  try {
    const j = JSON.parse(t);
    if (typeof j.code === "number" && j.code !== 0) return false;
    if (typeof j.StatusCode === "number" && j.StatusCode !== 0) return false;
    return true;
  } catch {
    return true; // A successful non-JSON response includes Slack's plain-text acknowledgement.
  }
}

function postOnce(hook, body) {
  try {
    // On a separate line, curl appends the HTTP status to the response body.
    const raw = execFileSync(
      "curl",
      ["-s", "-w", "\n%{http_code}", "--max-time", "25", "-X", "POST",
       "-H", "Content-Type: application/json", "--data-binary", "@-", hook],
      { input: body, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
    );
    const nl = raw.lastIndexOf("\n");
    const respBody = nl >= 0 ? raw.slice(0, nl) : raw;
    const status = parseInt((nl >= 0 ? raw.slice(nl + 1) : "").trim(), 10) || 0;
    const ok = isDeliverySuccess(status, respBody);
    return { ok, err: ok ? null : `HTTP ${status} ${String(respBody).trim().slice(0, 180) || "no response body"}` };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

// Retry transient POST failures up to three attempts, with 2s and 4s delays.
function send(ch, msg) {
  const adapt = ADAPTERS[ch.type];
  if (!adapt) return { ch, ok: false, err: `Unknown channel type: ${ch.type}` };
  const hook = resolveWebhook(ch.webhook);
  if (!hook) return { ch, ok: false, err: `Webhook unavailable (check ${ch.webhook})` };
  const body = JSON.stringify(adapt(msg));
  const MAX = 3;
  let last = { ok: false, err: "Not attempted" };
  for (let i = 1; i <= MAX; i++) {
    last = postOnce(hook, body);
    if (last.ok) return { ch, ok: true, err: null, attempts: i };
    if (i < MAX) { console.error(`Attempt ${i} to deliver to ${ch.type} failed (${last.err}). Retrying in ${2 * i}s.`); sleepSync(2 * i); }
  }
  return { ch, ok: false, err: `Delivery failed after ${MAX} attempts: ${last.err}`, attempts: MAX };
}

// The CLI runs only on direct execution. Tests can import the response checker.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [title, url, summary, cfgArg] = process.argv.slice(2);
  if (!title || !url) { console.error("Usage: node lib/deliver.mjs <title> <url> [summary] [channels.json]"); process.exit(1); }

  // Resolve the default channel configuration relative to this script.
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const cfgPath =
    cfgArg ||
    (existsSync(join(repoRoot, "config", "channels.json"))
      ? join(repoRoot, "config", "channels.json")
      : join(repoRoot, "config", "channels.sample.json"));
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const active = (cfg.channels || []).filter((c) => c.enabled);
  if (!active.length) { console.error("No channels are enabled in the delivery configuration."); process.exit(1); }

  const msg = { title, url, summary };
  const results = await Promise.all(active.map((c) => send(c, msg)));

  let failed = 0;
  for (const r of results) {
    if (r.ok) console.log(`Sent to ${r.ch.type} (${r.ch.name || ""})`);
    else { failed++; console.error(`Delivery to ${r.ch.type} (${r.ch.name || ""}) failed: ${r.err}`); }
  }
  process.exit(failed ? 1 : 0);
}

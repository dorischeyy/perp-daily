#!/usr/bin/env node
// deliver.mjs — 渠道无关的交付层：把「标题 + 链接 + 摘要」发到所有启用的渠道。
// 加新渠道只需在 channels.json 增一条 + 在 ADAPTERS 里加一个适配器函数。
//
// 用法: node deliver.mjs <标题> <链接> [摘要] [channels.json路径]
// 默认读 ./channels.json（不存在则回退 ./channels.sample.json）。
//
// 渠道凭证：channels.json 里 webhook 写 "env:VAR" 从环境变量读，避免明文入库。

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// 加载脚本同目录的 .env（若存在），不覆盖已有环境变量
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

// ---- 各渠道的 payload 适配器：输入统一 {title,url,summary}，输出该渠道的 webhook body ----
const ADAPTERS = {
  // 飞书自定义机器人：interactive 卡片
  feishu: ({ title, url, summary }) => ({
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: { template: "red", title: { tag: "plain_text", content: title } },
      elements: [
        ...(summary ? [{ tag: "div", text: { tag: "lark_md", content: summary } }] : []),
        { tag: "action", actions: [
          { tag: "button", text: { tag: "plain_text", content: "📖 打开今日日报" }, type: "primary", url },
        ]},
      ],
    },
  }),
  // Slack incoming webhook：Block Kit
  slack: ({ title, url, summary }) => ({
    text: `${title} — ${url}`, // 通知/回退文本
    blocks: [
      { type: "header", text: { type: "plain_text", text: title, emoji: true } },
      ...(summary ? [{ type: "section", text: { type: "mrkdwn", text: summary } }] : []),
      { type: "actions", elements: [
        { type: "button", text: { type: "plain_text", text: "📖 打开今日日报", emoji: true }, url, style: "primary" },
      ]},
    ],
  }),
};

function resolveWebhook(v) {
  if (typeof v === "string" && v.startsWith("env:")) return process.env[v.slice(4)] || "";
  return v || "";
}

// 用 curl 发 POST（比 node fetch 在各沙箱/云端更稳——node fetch 在受限环境常失败）
function send(ch, msg) {
  const adapt = ADAPTERS[ch.type];
  if (!adapt) return { ch, ok: false, err: `未知渠道类型: ${ch.type}` };
  const hook = resolveWebhook(ch.webhook);
  if (!hook) return { ch, ok: false, err: `webhook 为空（检查 ${ch.webhook}）` };
  try {
    const txt = execFileSync(
      "curl",
      ["-s", "--max-time", "25", "-X", "POST", "-H", "Content-Type: application/json", "--data-binary", "@-", hook],
      { input: JSON.stringify(adapt(msg)), encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
    );
    // 飞书成功 {code:0}；Slack 成功返回纯文本 "ok"
    let ok = false;
    try { const j = JSON.parse(txt); ok = typeof j.code === "number" ? j.code === 0 : true; }
    catch { ok = txt.trim() === "ok"; }
    return { ch, ok, err: ok ? null : String(txt).slice(0, 200) || "无响应" };
  } catch (e) {
    return { ch, ok: false, err: e.message };
  }
}

const [title, url, summary, cfgArg] = process.argv.slice(2);
if (!title || !url) { console.error("用法: node deliver.mjs <标题> <链接> [摘要] [channels.json]"); process.exit(1); }

const cfgPath = cfgArg || (existsSync("channels.json") ? "channels.json" : "channels.sample.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const active = (cfg.channels || []).filter((c) => c.enabled);
if (!active.length) { console.error("没有启用的渠道（channels.json 里 enabled:true）"); process.exit(1); }

const msg = { title, url, summary };
const results = await Promise.all(active.map((c) => send(c, msg)));

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`✅ ${r.ch.type} (${r.ch.name || ""}) 已发送`);
  else { failed++; console.error(`❌ ${r.ch.type} (${r.ch.name || ""}) 失败: ${r.err}`); }
}
process.exit(failed ? 1 : 0);

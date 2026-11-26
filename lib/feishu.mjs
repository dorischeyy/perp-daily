#!/usr/bin/env node
// Import Markdown into Feishu Docs or send an edition link via a group bot or app.
// Uses the built-in fetch, FormData, and Blob APIs in Node.js 18 or later.
//
// Commands:
//   node feishu.mjs doc <markdown-file> [document-title]
//     Import Markdown as a document, grant organization read access, and print {token,url}.
//     Requires FEISHU_APP_ID and FEISHU_APP_SECRET. FEISHU_FOLDER_TOKEN is optional.
//
//   node feishu.mjs webhook <title> <url> [summary]
//     Send a link card through a group bot.
//     Requires FEISHU_WEBHOOK.
//
//   node feishu.mjs dm <openId> <title> <url>
//     Send a direct message. The app needs im:message permission and the user's open_id.
//     Requires FEISHU_APP_ID and FEISHU_APP_SECRET.
//
// Defaults to open.feishu.cn. For Lark, set FEISHU_DOMAIN=https://open.larksuite.com.

import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { editionCopy } from "./edition-copy.mjs";

const BASE = process.env.FEISHU_DOMAIN || "https://open.feishu.cn";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tenantToken() {
  const id = process.env.FEISHU_APP_ID, secret = process.env.FEISHU_APP_SECRET;
  if (!id || !secret) throw new Error("FEISHU_APP_ID and FEISHU_APP_SECRET are required");
  const r = await fetch(`${BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: id, app_secret: secret }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`Token request failed: ${j.code} ${j.msg}`);
  return j.tenant_access_token;
}

// Upload the source to cloud storage and return its file_token.
async function uploadFile(token, filePath) {
  const buf = readFileSync(filePath);
  const name = basename(filePath);
  const fd = new FormData();
  fd.append("file_name", name);
  fd.append("parent_type", "explorer");
  fd.append("size", String(statSync(filePath).size));
  fd.append("file", new Blob([buf]), name);
  const r = await fetch(`${BASE}/open-apis/drive/v1/files/upload_all`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`Upload failed: ${j.code} ${j.msg}`);
  return j.data.file_token;
}

// Create an import job to convert Markdown or HTML into a document.
async function createImport(token, fileToken, ext, title, folderToken) {
  const point = { mount_type: 1 };
  if (folderToken) point.mount_key = folderToken;
  const r = await fetch(`${BASE}/open-apis/drive/v1/import_tasks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file_extension: ext, file_token: fileToken, type: "docx", file_name: title, point }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`Could not create the import job: ${j.code} ${j.msg}`);
  return j.data.ticket;
}

async function pollImport(token, ticket) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${BASE}/open-apis/drive/v1/import_tasks/${ticket}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (j.code !== 0) throw new Error(`Could not retrieve the import job: ${j.code} ${j.msg}`);
    const res = j.data.result;
    if (res.job_status === 0) return { token: res.token, url: res.url };       // Complete
    if (res.job_status !== 1 && res.job_status !== 2)                            // Status 1 or 2 means processing.
      throw new Error(`Import failed with status=${res.job_status}: ${res.job_error_msg || ""}`);
    await sleep(1500);
  }
  throw new Error("Import job timed out");
}

// Grant organization-level read access for sharing.
async function makeShareable(token, docToken) {
  const r = await fetch(
    `${BASE}/open-apis/drive/v1/permissions/${docToken}/public?type=docx`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ link_share_entity: "tenant_readable", external_access: false }),
    }
  );
  const j = await r.json();
  if (j.code !== 0) console.error(`Could not set sharing permissions (${j.code} ${j.msg}). The document is available for manual sharing.`);
}

async function cmdDoc(mdPath, title) {
  const t = await tenantToken();
  const ext = mdPath.endsWith(".html") ? "html" : "md";
  const docTitle = title || `${editionCopy(readFileSync(mdPath, "utf8")).name} ${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })}`;
  const fileToken = await uploadFile(t, mdPath);
  const ticket = await createImport(t, fileToken, ext, docTitle, process.env.FEISHU_FOLDER_TOKEN);
  const { token: docToken, url } = await pollImport(t, ticket);
  await makeShareable(t, docToken);
  console.log(JSON.stringify({ token: docToken, url }));
}

function card(title, url, summary) {
  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: { template: "red", title: { tag: "plain_text", content: title } },
      elements: [
        ...(summary ? [{ tag: "div", text: { tag: "lark_md", content: summary } }] : []),
        { tag: "action", actions: [
          { tag: "button", text: { tag: "plain_text", content: editionCopy(title || summary).readEdition },
            type: "primary", url },
        ]},
      ],
    },
  };
}

async function cmdWebhook(title, url, summary) {
  const hook = process.env.FEISHU_WEBHOOK;
  if (!hook) throw new Error("FEISHU_WEBHOOK is required");
  const r = await fetch(hook, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card(title, url, summary)),
  });
  const j = await r.json();
  if (j.code && j.code !== 0) throw new Error(`Webhook delivery failed: ${j.code} ${j.msg}`);
  console.log("Sent via webhook");
}

async function cmdDm(openId, title, url) {
  const t = await tenantToken();
  const copy = editionCopy(title);
  const content = JSON.stringify({
    [copy.lang === "zh-CN" ? "zh_cn" : "en_us"]: { title, content: [[{ tag: "a", text: copy.readEdition, href: url }]] },
  });
  const r = await fetch(`${BASE}/open-apis/im/v1/messages?receive_id_type=open_id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ receive_id: openId, msg_type: "post", content }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`Direct message failed: ${j.code} ${j.msg}`);
  console.log("Direct message sent");
}

const [cmd, ...args] = process.argv.slice(2);
const run = { doc: () => cmdDoc(args[0], args[1]),
  webhook: () => cmdWebhook(args[0], args[1], args[2]),
  dm: () => cmdDm(args[0], args[1], args[2]) }[cmd];
if (!run) { console.error("See the usage notes for the doc, webhook, and dm commands."); process.exit(1); }
run().catch((e) => { console.error("Error:", e.message); process.exit(1); });

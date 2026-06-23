#!/usr/bin/env node
// feishu.mjs — 飞书集成：把 Markdown 导入为飞书云文档 + 通过 Webhook/应用把链接发给你
// 无外部依赖（Node 18+ 内置 fetch / FormData / Blob）。
//
// 子命令：
//   node feishu.mjs doc <markdown文件> [文档标题]
//        用自建应用把 md 导入为飞书云文档(docx)，设为「组织内可读」，打印 {token,url}
//        需要环境变量: FEISHU_APP_ID, FEISHU_APP_SECRET, (可选)FEISHU_FOLDER_TOKEN
//
//   node feishu.mjs webhook <标题> <链接> [一句话摘要]
//        通过群自定义机器人 Webhook 发一张带链接的卡片
//        需要环境变量: FEISHU_WEBHOOK
//
//   node feishu.mjs dm <openId> <标题> <链接>
//        用自建应用给指定用户发私信(需 im:message 权限 + 用户 open_id)
//        需要环境变量: FEISHU_APP_ID, FEISHU_APP_SECRET
//
// 域名默认国内版 open.feishu.cn；海外(Lark)版设 FEISHU_DOMAIN=https://open.larksuite.com

import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

const BASE = process.env.FEISHU_DOMAIN || "https://open.feishu.cn";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tenantToken() {
  const id = process.env.FEISHU_APP_ID, secret = process.env.FEISHU_APP_SECRET;
  if (!id || !secret) throw new Error("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET");
  const r = await fetch(`${BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: id, app_secret: secret }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`取 token 失败: ${j.code} ${j.msg}`);
  return j.tenant_access_token;
}

// 上传文件到云盘，拿 file_token
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
  if (j.code !== 0) throw new Error(`上传失败: ${j.code} ${j.msg}`);
  return j.data.file_token;
}

// 创建导入任务: md/html -> docx
async function createImport(token, fileToken, ext, title, folderToken) {
  const point = { mount_type: 1 };
  if (folderToken) point.mount_key = folderToken;
  const r = await fetch(`${BASE}/open-apis/drive/v1/import_tasks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file_extension: ext, file_token: fileToken, type: "docx", file_name: title, point }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`创建导入任务失败: ${j.code} ${j.msg}`);
  return j.data.ticket;
}

async function pollImport(token, ticket) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${BASE}/open-apis/drive/v1/import_tasks/${ticket}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (j.code !== 0) throw new Error(`查询导入任务失败: ${j.code} ${j.msg}`);
    const res = j.data.result;
    if (res.job_status === 0) return { token: res.token, url: res.url };       // 成功
    if (res.job_status !== 1 && res.job_status !== 2)                            // 1/2=处理中
      throw new Error(`导入失败 status=${res.job_status}: ${res.job_error_msg || ""}`);
    await sleep(1500);
  }
  throw new Error("导入任务超时");
}

// 设为组织内可读，便于分享
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
  if (j.code !== 0) console.error(`(提醒) 设置分享权限失败: ${j.code} ${j.msg}，文档仍可用但需手动分享`);
}

async function cmdDoc(mdPath, title) {
  const t = await tenantToken();
  const ext = mdPath.endsWith(".html") ? "html" : "md";
  const docTitle = title || `Perp DEX 日报 ${new Date().toISOString().slice(0, 10)}`;
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
          { tag: "button", text: { tag: "plain_text", content: "📖 打开今日日报" },
            type: "primary", url },
        ]},
      ],
    },
  };
}

async function cmdWebhook(title, url, summary) {
  const hook = process.env.FEISHU_WEBHOOK;
  if (!hook) throw new Error("缺少 FEISHU_WEBHOOK");
  const r = await fetch(hook, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card(title, url, summary)),
  });
  const j = await r.json();
  if (j.code && j.code !== 0) throw new Error(`Webhook 发送失败: ${j.code} ${j.msg}`);
  console.log("已通过 Webhook 发送");
}

async function cmdDm(openId, title, url) {
  const t = await tenantToken();
  const content = JSON.stringify({
    zh_cn: { title, content: [[{ tag: "a", text: "📖 打开今日日报", href: url }]] },
  });
  const r = await fetch(`${BASE}/open-apis/im/v1/messages?receive_id_type=open_id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ receive_id: openId, msg_type: "post", content }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`发送私信失败: ${j.code} ${j.msg}`);
  console.log("已发送私信");
}

const [cmd, ...args] = process.argv.slice(2);
const run = { doc: () => cmdDoc(args[0], args[1]),
  webhook: () => cmdWebhook(args[0], args[1], args[2]),
  dm: () => cmdDm(args[0], args[1], args[2]) }[cmd];
if (!run) { console.error("用法见文件头注释 (doc | webhook | dm)"); process.exit(1); }
run().catch((e) => { console.error("错误:", e.message); process.exit(1); });

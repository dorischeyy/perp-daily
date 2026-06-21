#!/usr/bin/env bash
# publish.sh — 渲染 HTML → 写 latest.json → 推送(触发 Pages + GitHub Actions 发飞书)。
# 云端沙箱出口白名单不含 open.feishu.cn，所以飞书改由 GitHub Actions 发(见 .github/workflows/feishu-notify.yml)。
# 用法：bash publish.sh
set -uo pipefail

DATE=$(TZ=Asia/Shanghai date +%F)
URL="https://dorischeyy.github.io/perp-daily/archive/${DATE}.html"

# 1) 渲染 + 自评落档
mkdir -p docs/archive
node build-html.mjs content.json "docs/archive/${DATE}.html"
cp "docs/archive/${DATE}.html" docs/index.html
[ -f review.draft.md ] && mv -f review.draft.md "docs/archive/${DATE}-review.md"

# 2) 写 latest.json，供 GitHub Actions 读取并发飞书
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('content.json','utf8'));const d='${DATE}';fs.writeFileSync('docs/latest.json',JSON.stringify({date:d,url:'${URL}',title:'Perp DEX 日报 · '+d,lead:c.lead||'今日 Perp DEX 日报'},null,2))"

# 3) 提交并推送（Pages 发布 + 触发 Actions 发飞书）
git config user.name "dorischeyy"
git config user.email "startrail1016@gmail.com"
git add docs
git commit -m "report: ${DATE}" || echo "(无变更，跳过 commit)"
git pull --rebase -q origin main || true
git push origin main

echo "✅ publish 完成：${URL}（飞书由 GitHub Actions 推送）"

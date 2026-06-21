#!/usr/bin/env bash
# publish.sh — 原子发布：渲染 HTML → 提交推送(触发 Pages) → 发飞书。
# 前提：当前目录有写好的 content.json；环境变量 FEISHU_WEBHOOK 已设；git remote 已带推送鉴权。
# 用法：FEISHU_WEBHOOK="https://..." bash publish.sh
set -euo pipefail

DATE=$(TZ=Asia/Shanghai date +%F)
URL="https://dorischeyy.github.io/perp-daily/archive/${DATE}.html"

# 1) 渲染杂志 HTML：当天永久页 + 首页(最新一期)
mkdir -p docs/archive
node build-html.mjs content.json "docs/archive/${DATE}.html"
cp "docs/archive/${DATE}.html" docs/index.html

# 1.5) 自评文件：agent 写到根目录 review.draft.md，这里按【权威 DATE】落到 archive，
#      避免 agent 自己猜日期导致 review 与报告日期对不上。
if [ -f review.draft.md ]; then
  mv -f review.draft.md "docs/archive/${DATE}-review.md"
fi

# 2) 提交并推送（触发 GitHub Pages 发布）
git config user.name "dorischeyy"
git config user.email "startrail1016@gmail.com"
git add docs
git commit -m "report: ${DATE}" || echo "(无变更，跳过 commit)"
git pull --rebase -q origin main || true
git push origin main

# 3) 发飞书（与推送绑定在同一脚本，杜绝"推了却不发"）
LEAD=$(node -e "console.log((JSON.parse(require('fs').readFileSync('content.json','utf8')).lead)||'今日 Perp DEX 日报')")
node deliver.mjs "Perp DEX 日报 · ${DATE}" "${URL}" "${LEAD}"

echo "✅ publish 完成：${URL}"

#!/usr/bin/env bash
# publish.sh — 渲染 HTML → 写 latest.json → 推送(触发 Pages + GitHub Actions 发飞书)。
# 云端沙箱出口白名单不含 open.feishu.cn，所以飞书改由 GitHub Actions 发(见 .github/workflows/feishu-notify.yml)。
# 用法：bash publish.sh
set -uo pipefail

DATE=$(TZ=Asia/Shanghai date +%F)
URL="https://dorischeyy.github.io/perp-daily/archive/${DATE}.html"

# 0) 时效关卡（机械化，不过则阻断发布；启发栏豁免，新闻≤72h、本周主线≤7天）
node check-freshness.mjs content.json "${DATE}" || {
  echo "⛔ 时效关卡未通过，发布中止。请按上方违规条目修 content.json 后重跑。" >&2
  exit 1
}

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
if git diff --cached --quiet; then
  echo "⚠️ docs 无变更，未生成新提交——今日报告可能没正常产出，请检查。" >&2
  exit 1
fi
git commit -m "report: ${DATE}"

# 同步远端：rebase 失败要报错，不能默默用旧状态硬推
if ! git pull --rebase -q origin main; then
  echo "⛔ git pull --rebase 失败（可能有冲突/未提交改动），停止以免推坏。请人工处理。" >&2
  exit 1
fi

# push 失败必须让整个脚本失败，不许谎报成功
if ! git push origin main; then
  echo "⛔ git push 失败，报告未发布、Action 不会触发。请检查 token/网络后重试。" >&2
  exit 1
fi

echo "✅ publish 完成：${URL}（飞书+Slack 由 GitHub Actions 推送）"

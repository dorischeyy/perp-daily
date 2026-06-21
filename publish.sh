#!/usr/bin/env bash
# publish.sh — 渲染 HTML → 推送(触发 Pages) → 发飞书并把全过程写进可审计日志。
# 用法：FEISHU_WEBHOOK="https://..." bash publish.sh
# 注意：不要漏 FEISHU_WEBHOOK= 前缀，否则 deliver 拿不到 webhook 会失败（日志会记录）。
set -uo pipefail   # 故意不带 -e：deliver 失败也要把日志写完并提交

DATE=$(TZ=Asia/Shanghai date +%F)
URL="https://dorischeyy.github.io/perp-daily/archive/${DATE}.html"
LOG="docs/archive/${DATE}-publish.log"

# 1) 渲染 + 自评落档
mkdir -p docs/archive
node build-html.mjs content.json "docs/archive/${DATE}.html"
cp "docs/archive/${DATE}.html" docs/index.html
[ -f review.draft.md ] && mv -f review.draft.md "docs/archive/${DATE}-review.md"

git config user.name "dorischeyy"
git config user.email "startrail1016@gmail.com"

# 2) 先推报告（让 Pages 先发布，链接立即可用）
git add docs
git commit -m "report: ${DATE}" || echo "(无变更，跳过 commit)"
git pull --rebase -q origin main || true
git push origin main

# 3) 发飞书，并把环境/输出/退出码全部写进日志（便于云端排错）
LEAD=$(node -e "console.log((JSON.parse(require('fs').readFileSync('content.json','utf8')).lead)||'今日 Perp DEX 日报')")
{
  echo "=== publish log @ $(date -u) UTC ==="
  echo "DATE=${DATE}"
  echo "URL=${URL}"
  echo "FEISHU_WEBHOOK present: $([ -n "${FEISHU_WEBHOOK:-}" ] && echo YES || echo 'NO/EMPTY (这就是没发飞书的原因)')"
  echo "node: $(node -v 2>&1) | curl: $(command -v curl || echo MISSING)"
  echo "channels cfg: $([ -f channels.json ] && echo channels.json || echo channels.sample.json)"
  echo "--- deliver.mjs 输出 ---"
} > "${LOG}"
node deliver.mjs "Perp DEX 日报 · ${DATE}" "${URL}" "${LEAD}" >> "${LOG}" 2>&1
echo "deliver exit code: $?" >> "${LOG}"

# 4) 提交日志（便于事后审计 deliver 到底发生了什么）
git add "${LOG}"
git commit -m "publish-log: ${DATE}" || echo "(无日志变更)"
git pull --rebase -q origin main || true
git push origin main

echo "✅ publish 完成：${URL}（deliver 日志：${LOG}）"
cat "${LOG}"

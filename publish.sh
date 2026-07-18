#!/usr/bin/env bash
# publish.sh — 机械发布管线（零 LLM、零 token）。
#
# 解耦原则：昂贵的"调研+评分+生成"(产出 content.json / threads.json / review.draft.md) 是上游，
# 本脚本只消费这些交接物做"校验→渲染→推送"。content.json 是两段之间的持久交接物，
# 下游任何一步失败都能"哪步坏跑哪步"单独重跑，绝不需要重新调研。
#
# 阶段化用法（可插拔）：
#   bash publish.sh            # 全流程 preflight → validate → render → push
#   bash publish.sh preflight  # 调研前查重复发布 + 行情快照状态
#   bash publish.sh validate   # 只跑内容/编辑/时效/台账关卡
#   bash publish.sh render      # 只渲染 HTML + 落自评 + 写 latest.json
#   bash publish.sh push        # 只 commit + pull --rebase + push（已 render 过就只补推这步）
# 交付(发飞书/Slack)是独立的 GitHub Action；它失败用仓库 Actions 页 "Run workflow" 重发，同样不碰生成。
set -uo pipefail

STAGE="${1:-all}"
DATE=$(TZ=Asia/Shanghai date +%F)
URL="https://dorischeyy.github.io/perp-daily/archive/${DATE}.html"

# 阶段 0：应在联网调研前运行。已发布返回 10，明确 no-op，避免重复消耗研究成本。
stage_preflight() {
  node lib/check-run-state.mjs "${DATE}"
}

# 阶段 1：校验关卡（纯只读，可反复跑）
stage_validate() {
  node lib/validate-content.mjs content.json || {
    echo "⛔ content.json 结构校验未通过。按上方缺失字段修 content.json 后重跑 \`bash publish.sh validate\`。" >&2; return 1; }
  node lib/check-editorial.mjs content.json || {
    echo "⛔ 编辑去重/机会项关卡未通过。只修对应文案后重跑 \`bash publish.sh validate\`。" >&2; return 1; }
  node lib/check-freshness.mjs content.json "${DATE}" || {
    echo "⛔ 时效/防造假关卡未通过。修 content.json 后重跑 \`bash publish.sh validate\`（无需重新调研）。" >&2; return 1; }
  node lib/threads.mjs "${DATE}" || {
    echo "⛔ 台账结构校验未通过。修 threads.json 后重跑 \`bash publish.sh validate\`。" >&2; return 1; }
  echo "✅ validate 通过"
}

# 阶段 2：渲染（幂等，可反复跑；只读 content.json，写 docs/）
stage_render() {
  mkdir -p docs/archive
  node lib/build-html.mjs content.json "docs/archive/${DATE}.html" || { echo "⛔ 渲染失败" >&2; return 1; }
  cp "docs/archive/${DATE}.html" docs/index.html
  [ -f review.draft.md ] && mv -f review.draft.md "docs/archive/${DATE}-review.md"
  node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('content.json','utf8'));const d='${DATE}';fs.writeFileSync('docs/latest.json',JSON.stringify({date:d,url:'${URL}',title:'Perp DEX 日报 · '+d,lead:c.lead||'今日 Perp DEX 日报'},null,2))" \
    || { echo "⛔ 写 latest.json 失败" >&2; return 1; }
  echo "✅ render 完成：docs/archive/${DATE}.html"
}

# 阶段 3：提交+推送（可重入：已 commit 但 push 失败时，重跑只补推）
stage_push() {
  git config user.name "dorischeyy"; git config user.email "startrail1016@gmail.com"
  git add docs threads.json
  local has_staged=0; git diff --cached --quiet || has_staged=1
  [ "$has_staged" = 1 ] && { git commit -m "report: ${DATE}" || { echo "⛔ commit 失败" >&2; return 1; }; }
  git fetch -q origin main 2>/dev/null || true
  local ahead; ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  if [ "$has_staged" = 0 ] && [ "$ahead" = 0 ]; then
    echo "⚠️ 无新变更、无待推提交——内容可能没产出或今天已发过，请检查上游。" >&2; return 1
  fi
  git pull --rebase -q origin main || {
    echo "⛔ rebase 失败（冲突/未提交改动）。人工处理后重跑 \`bash publish.sh push\`。" >&2; return 1; }
  git push origin main || {
    echo "⛔ push 失败。修 token/网络后重跑 \`bash publish.sh push\`（已 render 过，不会重做）。" >&2; return 1; }
  echo "✅ push 完成：${URL}（飞书+Slack 由 GitHub Action 投递）"
}

case "$STAGE" in
  preflight)      stage_preflight; exit $? ;;
  validate|gate) stage_validate || exit 1 ;;
  render)        stage_render   || exit 1 ;;
  push|commit)   stage_push     || exit 1 ;;
  all)           stage_preflight; rc=$?; [ "$rc" -eq 0 ] || exit "$rc"
                 stage_validate && stage_render && stage_push || exit 1 ;;
  *) echo "未知阶段: ${STAGE} (可选 preflight | validate | render | push | all)" >&2; exit 2 ;;
esac

#!/usr/bin/env bash
# Publish a previously researched edition.
#
# Inputs: content.json, threads.json, and review.draft.md.
# Stages can be retried independently after failure.
#
# Usage:
#   bash publish.sh           Run all stages for the legacy Actions fallback.
#   bash publish.sh preflight Check the edition date and market snapshot.
#   bash publish.sh validate  Check content, editorial review, freshness, and ledger.
#   bash publish.sh render    Render HTML, archive the review, and write latest.json.
#   bash publish.sh manifest  Verify file lengths and Git blob hashes.
#   bash publish.sh push      Commit, rebase, and push in the legacy fallback.
# Delivery runs separately and can be retried without generating the edition again.
set -uo pipefail

STAGE="${1:-all}"
DATE=$(TZ=Asia/Shanghai date +%F)
URL="https://dorischeyy.github.io/perp-daily/archive/${DATE}.html"

# Check before online research. Exit 10 when the edition already exists.
stage_preflight() {
  node lib/check-run-state.mjs "${DATE}"
}

# Read-only validation. Fix the specific failure before retrying.
stage_validate() {
  node lib/validate-content.mjs content.json || {
    echo "Invalid content.json. Fix the reported fields and rerun bash publish.sh validate." >&2; return 1; }
  node lib/check-editorial.mjs content.json || {
    echo "Editorial validation failed. Revise the affected copy and rerun bash publish.sh validate." >&2; return 1; }
  node lib/check-review.mjs review.draft.md content.json || {
    echo "Editorial review incomplete. Update review.draft.md and rerun bash publish.sh validate." >&2; return 1; }
  node lib/check-freshness.mjs content.json "${DATE}" || {
    echo "Source-date validation failed. Correct content.json and rerun bash publish.sh validate." >&2; return 1; }
  node lib/threads.mjs "${DATE}" || {
    echo "Invalid ledger. Correct threads.json and rerun bash publish.sh validate." >&2; return 1; }
  echo "Validation passed."
}

# Render the dated edition and latest index from the verified inputs.
stage_render() {
  mkdir -p docs/archive
  node lib/build-html.mjs content.json "docs/archive/${DATE}.html" || { echo "Rendering failed." >&2; return 1; }
  cp "docs/archive/${DATE}.html" docs/index.html
  [ -f review.draft.md ] && mv -f review.draft.md "docs/archive/${DATE}-review.md"
  node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('content.json','utf8'));const d='${DATE}';fs.writeFileSync('docs/latest.json',JSON.stringify({date:d,url:'${URL}',title:'Perp DEX Daily · '+d,lead:c.lead||'Perp DEX Daily'},null,2))" \
    || { echo "Failed to write latest.json." >&2; return 1; }
  echo "Rendered docs/archive/${DATE}.html"
}

# Generate the five-file connector manifest locally.
# Missing or truncated files, or a homepage/archive mismatch, block publication.
stage_manifest() {
  node lib/build-publish-manifest.mjs "${DATE}" || {
    echo "Manifest validation failed. Do not upload artifacts or update remote main." >&2; return 1; }
}

# Retry a pending push without creating a second report commit.
stage_push() {
  git config user.name "dorischeyy"; git config user.email "startrail1016@gmail.com"
  git add docs threads.json
  local has_staged=0; git diff --cached --quiet || has_staged=1
  [ "$has_staged" = 1 ] && { git commit -m "report: ${DATE}" || { echo "Commit failed." >&2; return 1; }; }
  git fetch -q origin main 2>/dev/null || true
  local ahead; ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  if [ "$has_staged" = 0 ] && [ "$ahead" = 0 ]; then
    echo "No changes or pending commits. Check the generation output and publication date." >&2; return 1
  fi
  git pull --rebase -q origin main || {
    echo "Rebase failed. Resolve the conflict or uncommitted changes and rerun bash publish.sh push." >&2; return 1; }
  git push origin main || {
    echo "Push failed. Check authorization and network access, then rerun bash publish.sh push." >&2; return 1; }
  echo "Published ${URL}. The delivery workflow handles Feishu and Slack."
}

case "$STAGE" in
  preflight)      stage_preflight; exit $? ;;
  validate|gate) stage_validate || exit 1 ;;
  render)        stage_render   || exit 1 ;;
  manifest|publish-check) stage_manifest || exit 1 ;;
  push|commit)   stage_push     || exit 1 ;;
  all)           stage_preflight; rc=$?; [ "$rc" -eq 0 ] || exit "$rc"
                 stage_validate && stage_render && stage_manifest && stage_push || exit 1 ;;
  *) echo "Unknown stage: ${STAGE}. Choose preflight, validate, render, manifest, push, or all." >&2; exit 2 ;;
esac

# perp-daily · A Perp DEX Daily, Written Like an Analyst

> **Not a day-by-day news feed — an analyst tracking a set of ongoing narratives.** The system scores every story, maintains a cross-day *story ledger*, weaves scattered developments into a continuous thread of judgment, and enforces integrity with mechanical gates: freshness, anti-fabrication, de-duplication, and missed-run alerting.
>
> 📐 **Editorial methodology (the *why*) → [METHODOLOGY.md](METHODOLOGY.md)** ｜ 🛠 **Operations / troubleshooting → [OPERATIONS.md](OPERATIONS.md)**

Every Beijing day, a Codex automation runs: preflight → research → score & thread → editorial gates → render → publish through the GitHub connector → deliver cards to Feishu + Slack via the repository workflows. A watchdog checks for a missed run.

Sections: **Perp DEX (primary) → optional Launchpad / Crypto / AI → "Opportunities & Playbook"**. A compact Story Threads block appears only when a due thread has an informative status not already carried by a news item.
*(The published report is written in Chinese; the repository and its documentation are in English.)*

### Why this is analyst-grade, not a one-prompt digest
- **Signal scoring** — every story is scored 0–100 across five axes (structural impact / relevance / durability / actionability / magnitude × credibility), which drives selection, ordering, and whether it becomes a tracked thread.
- **Narrative threading** — S-tier stories (≥90) are entered into a persistent `threads.json` ledger, revisited on a cadence, and recalled across days, so a reader who missed a day never loses the thread. An anti-redundancy rule guarantees *connection*, never *repetition*.
- **Mechanical gates** — already-published preflight, market-snapshot status, freshness (≤72h), anti-date-fabrication, provenance links, editorial de-duplication, opportunity-item grounding, ledger schema validation, delivery de-duplication, missed-run alerting, and delivery retries.
- **Auditable** — every edition ships an *Editor's Self-Review* (scoring table + per-item freshness verification + thread-continuity check + six-lens critique), publicly archived.

## Design principle: channel portability

Four decoupled layers, each independent of the delivery channel — so "Feishu today → add Slack / a team channel later" requires zero code changes:

| Layer | Files | Channel-independence |
|-------|-------|----------------------|
| Content | `generate.md` + `lib/build-html.mjs` | Produces content JSON + HTML, channel-agnostic |
| Hosting | GitHub Pages | Produces **one public URL**, deliverable anywhere |
| Delivery | `lib/deliver.mjs` + `config/channels.json` | Fans out to every enabled channel; **add a channel = edit config, not code** |
| Scheduling | Cloud Routine (`/schedule`) | Indifferent to channels coming and going |

## Pipeline decoupling (atomic & resumable)

The expensive **LLM stage** (research → score → thread → write) emits three durable hand-off artifacts — `content.json`, `threads.json`, `review.draft.md`. Everything downstream is **cheap, token-free, and independently re-runnable**:

```bash
bash publish.sh preflight  # before research: already-published + market snapshot state
bash publish.sh validate   # structure + editorial + freshness + ledger gates
bash publish.sh render      # render HTML + write latest.json
```

The scheduled Codex path publishes the validated artifact set to `main` through the GitHub connector. Local Git credentials, PATs, `gh`, and webhook access are not part of the daily path. The no-argument `publish.sh` / `push` stages remain only for the manual Legacy GitHub Actions fallback.

If any downstream step fails, re-run only that stage — never re-research. See the resume matrix in [OPERATIONS.md](OPERATIONS.md) §5.

## Files

| File | Role |
|------|------|
| `generate.md` | The full daily instruction set the Codex automation executes (preflight → research → score → thread → self-review → gates → render → connector publication) |
| `METHODOLOGY.md` | Editorial methodology: scoring rubric + story threading + integrity gates |
| `config/sources.json` | Source registry (official / founder / media / kol / data × region × topic) + a real-time RSS feed layer |
| `threads.json` | **Story ledger** — persistent cross-day state (score / thesis / cadence / development log) |
| `lib/threads.mjs` | Ledger QA — schema validation + "threads due for review today" reminder |
| `lib/check-freshness.mjs` | Freshness + anti-fabrication gate (news ≤72h; URL-embedded date vs `date` cross-check) |
| `lib/validate-content.mjs` | content.json structural validator (required fields / URL scheme / date format) |
| `lib/check-run-state.mjs` | Pre-research idempotency + market-snapshot status (`ALREADY_PUBLISHED` exits 10) |
| `lib/check-editorial.mjs` | Blocks repeated lead/body/context and ungrounded or generic opportunity items |
| `lib/build-html.mjs` | Content JSON → single-file magazine HTML (incl. the Story Threads block; zero dependencies) |
| `test/` + `package.json` | Zero-dependency unit tests — `npm test` (Node's built-in runner) |
| `.github/workflows/ci.yml` | CI: syntax check + unit tests + gate smoke on every code push |
| `lib/deliver.mjs` | Channel-agnostic delivery — reads `config/channels.json`, fans out to enabled channels (Feishu/Slack adapters + retry) |
| `lib/check-feeds.mjs` | RSS feed health check (dead/stale/unreachable detection) |
| `.github/workflows/` | `feishu-notify.yml` (delivery) · `market-data.yml` (pre-fetch CoinGecko → `docs/market.json`) · `daily-watchdog.yml` (missed-run) · `feed-health.yml` (RSS health). Ops alerts go via Action-failure → GitHub, not the report channels |
| `config/channels.sample.json` / `config/content.sample.json` | Sample channel / content JSON schemas |
| `out/` | Daily artifacts (HTML) |

## Local preview (no credentials needed)

```bash
node lib/build-html.mjs config/content.sample.json   # → out/perp-daily-<date>.html
open out/perp-daily-<date>.html
```

## Delivery channels

Credentials are never committed — `config/channels.json` references webhooks as `"env:VAR"`, and delivery runs on a GitHub Actions runner using repository secrets (`FEISHU_WEBHOOK`, `SLACK_WEBHOOK`).

- **Feishu** — target group → Settings → Bots → Custom Bot → copy the webhook → store as repo secret `FEISHU_WEBHOOK`.
- **Slack** — api.slack.com/apps → Create an App (from scratch) → Incoming Webhooks → Add New Webhook to Workspace → pick a channel → copy the URL → store as repo secret `SLACK_WEBHOOK`. Set the slack entry in `config/channels.json` to `"enabled": true`. **No code changes.**

## Hosting & scheduling

- **Hosting** — GitHub Pages serves each day's HTML at `https://dorischeyy.github.io/perp-daily/archive/<date>.html`; the magazine layout is preserved 1:1.
- **Scheduling** — a Codex automation runs the full `generate.md` pipeline daily. Content rules, sources, and styling take effect on the next run after publication to `main`; schedule and repository settings are managed separately.

## Ground rules
- No item without a real, verifiable source URL. No investment advice.
- Fixed section order: Perp DEX first.

# perp-daily · A Perp DEX Daily, Written Like an Analyst

> **Not a day-by-day news feed — an analyst tracking a set of ongoing narratives.** The system scores every story, maintains a cross-day *story ledger*, weaves scattered developments into a continuous thread of judgment, and enforces integrity with mechanical gates: freshness, anti-fabrication, de-duplication, and missed-run alerting.
>
> 📐 **Editorial methodology (the *why*) → [METHODOLOGY.md](METHODOLOGY.md)** ｜ 🛠 **Operations / troubleshooting → [OPERATIONS.md](OPERATIONS.md)**

Every day at **08:03 Beijing time**, automatically: research the web → score & thread → render a magazine-style HTML → publish to GitHub Pages → deliver cards to Feishu + Slack via GitHub Actions. A 10:30 watchdog checks for a missed run.

Sections: **Story Threads → Perp DEX (primary) → Launchpad → Crypto → AI → "Implications for Hertzflow"**.
*(The published report is written in Chinese; the repository and its documentation are in English.)*

### Why this is analyst-grade, not a one-prompt digest
- **Signal scoring** — every story is scored 0–100 across five axes (structural impact / relevance / durability / actionability / magnitude × credibility), which drives selection, ordering, and whether it becomes a tracked thread.
- **Narrative threading** — S-tier stories (≥90) are entered into a persistent `threads.json` ledger, revisited on a cadence, and recalled across days, so a reader who missed a day never loses the thread. An anti-redundancy rule guarantees *connection*, never *repetition*.
- **Mechanical gates** — freshness (≤72h), anti-date-fabrication (URL + WebFetch cross-check), ledger schema validation, delivery de-duplication, missed-run alerting, and delivery retries — all enforced by scripts, not by good intentions.
- **Auditable** — every edition ships an *Editor's Self-Review* (scoring table + per-item freshness verification + thread-continuity check + six-lens critique), publicly archived.

## Design principle: channel portability

Four decoupled layers, each independent of the delivery channel — so "Feishu today → add Slack / a team channel later" requires zero code changes:

| Layer | Files | Channel-independence |
|-------|-------|----------------------|
| Content | `generate.md` + `build-html.mjs` | Produces content JSON + HTML, channel-agnostic |
| Hosting | GitHub Pages | Produces **one public URL**, deliverable anywhere |
| Delivery | `deliver.mjs` + `channels.json` | Fans out to every enabled channel; **add a channel = edit config, not code** |
| Scheduling | Cloud Routine (`/schedule`) | Indifferent to channels coming and going |

## Pipeline decoupling (atomic & resumable)

The expensive **LLM stage** (research → score → thread → write) emits three durable hand-off artifacts — `content.json`, `threads.json`, `review.draft.md`. Everything downstream is **cheap, token-free, and independently re-runnable**:

```bash
bash publish.sh            # full pipeline: validate → render → push
bash publish.sh validate   # gates only (freshness + ledger schema)
bash publish.sh render      # render HTML + write latest.json
bash publish.sh push        # commit + rebase + push
```

If any downstream step fails, re-run only that stage — never re-research. See the resume matrix in [OPERATIONS.md](OPERATIONS.md) §4.6.

## Files

| File | Role |
|------|------|
| `generate.md` | The full daily instruction set the cloud Routine executes (research → score → thread → self-review → render → publish → deliver) |
| `METHODOLOGY.md` | Editorial methodology: scoring rubric + story threading + integrity gates |
| `sources.json` | Source registry (official / founder / media / kol / data × region × topic) + a real-time RSS feed layer |
| `threads.json` | **Story ledger** — persistent cross-day state (score / thesis / cadence / development log) |
| `threads.mjs` | Ledger QA — schema validation + "threads due for review today" reminder |
| `check-freshness.mjs` | Freshness + anti-fabrication gate (news ≤72h; URL-embedded date vs `date` cross-check) |
| `build-html.mjs` | Content JSON → single-file magazine HTML (incl. the Story Threads block; zero dependencies) |
| `deliver.mjs` | Channel-agnostic delivery — reads `channels.json`, fans out to enabled channels (Feishu/Slack adapters + retry) |
| `.github/workflows/` | `feishu-notify.yml` (de-duplicated delivery) + `daily-watchdog.yml` (missed-run alert) |
| `channels.sample.json` / `content.sample.json` | Sample channel / content JSON schemas |
| `out/` | Daily artifacts (HTML) |

## Local preview (no credentials needed)

```bash
node build-html.mjs content.sample.json   # → out/perp-daily-<date>.html
open out/perp-daily-<date>.html
```

## Delivery channels

Credentials are never committed — `channels.json` references webhooks as `"env:VAR"`, and delivery runs on a GitHub Actions runner using repository secrets (`FEISHU_WEBHOOK`, `SLACK_WEBHOOK`).

- **Feishu** — target group → Settings → Bots → Custom Bot → copy the webhook → store as repo secret `FEISHU_WEBHOOK`.
- **Slack** — api.slack.com/apps → Create an App (from scratch) → Incoming Webhooks → Add New Webhook to Workspace → pick a channel → copy the URL → store as repo secret `SLACK_WEBHOOK`. Set the slack entry in `channels.json` to `"enabled": true`. **No code changes.**

## Hosting & scheduling

- **Hosting** — GitHub Pages serves each day's HTML at `https://dorischeyy.github.io/perp-daily/archive/<date>.html`; the magazine layout is preserved 1:1.
- **Scheduling** — a cloud Routine (created via `/schedule`) runs the full `generate.md` pipeline daily. Changing content rules / sources / styling takes effect on the next run automatically (the Routine clones the latest repo each time); only schedule, model, or credential changes touch the Routine itself.

## Ground rules
- No item without a real, verifiable source URL. No investment advice.
- Fixed section order: Perp DEX first.

# perp-daily · A Perp DEX Daily, Written Like an Analyst

> **Not a day-by-day news feed — an analyst tracking a set of ongoing narratives.** The system scores every story, maintains a cross-day *story ledger*, weaves scattered developments into a continuous thread of judgment, and enforces integrity with mechanical gates: freshness, anti-fabrication, de-duplication, and missed-run alerting.
>
> 📐 **Editorial methodology (the *why*) → [METHODOLOGY.md](METHODOLOGY.md)** ｜ 🛠 **Operations / troubleshooting → [OPERATIONS.md](OPERATIONS.md)**

Every Beijing day, a Codex automation runs: preflight → research → score & thread → editorial gates → render → publish through the GitHub connector → deliver cards to Feishu + Slack via the repository workflows. A watchdog checks for a missed run.

From 2026-10-21, non-AI sections are chosen dynamically from the day's verified Crypto material, without fixed names, item counts or research quotas. AI has one fixed section, `id: "ai"`, containing exactly three genuine `kind: "news"` items; all `domain: "ai"` or `"crypto-ai"` content belongs there. The three integer `importance_score` values are 75–100 and sorted descending. Each item uses a complete headline and one 70–150-character paragraph. Event headlines carry the true event date; mechanism studies have undated titles; only genuine data snapshots use an as-of date. One numbered “来源 1 2 3…” line retains all deduplicated primary, reference and discussion URLs; full source names, dates and available author relationships stay in link `title` and `aria-label`, without a separate supplement line. Deep research remains in the working evidence; mechanism/GTM/impact subheads, context cards and the separate Story Threads block are not displayed.
The lead directly states one evidence-backed conclusion or analytical result and its necessary boundary in one or two short sentences, 20–120 characters total and at most 70 per sentence. It is not a reading guide, research plan or list of headlines. Phrases such as “更值得研究的是”, “更值得关注的是”, “这期先看”, “这一期先看”, “今天先看”, “本文将” and “让我们来看看” are prohibited.
News first explains the concrete change and applicable users, then the necessary mechanism. Studies explain user actions and money flows in ordinary language and compare a verified, equivalent product mode. Do not use abstract contrasts such as “共享流动性不等于共享保证金” instead of explaining what the user can do, or exaggerate an ordinary feature as unique. Source-check dates remain evidence metadata, not headline news.
Use the approved 2026-10-21 edition of roughly nine items as a length reference, not a quota: three AI news items and around six qualified non-AI items. Seek fresh derivatives-volume trends, product changes and user campaigns alongside mechanism studies. Data comparisons must share metrics, windows and coverage, with an actual snapshot time; notional turnover is not net inflow.
*(The published report is written in Chinese; the repository and its documentation are in English.)*

### Why this is analyst-grade, not a one-prompt digest

- **Signal scoring** — every candidate is scored across structural impact (30), relevance (25), durability (20), actionability (15) and evidence quality (10), driving selection, ordering and tracking. AI consolidates the same event before choosing the highest three qualifying news items; fewer than three means continued research, not a lower threshold, old studies or invented dates.
- **Daily AI coverage** — Anthropic, OpenAI, Scale AI, xAI, Kimi, DeepSeek and Qwen are all scanned every day, independently of Perp rotation. Exact names and aliases are searched in Chinese and English over three days for releases, capabilities, API access, pricing, safety and real adoption. Seven daily scans do not mean seven published items or one per company; official URLs are discovered and read, not invented.
- **Narrative threading** — S-tier stories (≥90) are entered into a persistent `threads.json` ledger, revisited on a cadence, and recalled across days, so a reader who missed a day never loses the thread. An anti-redundancy rule guarantees *connection*, never *repetition*.
- **Mechanical gates** — already-published preflight, market-snapshot status, dynamic non-AI sections, exactly three AI news items with integer scores 75–100 in descending order, correct domain routing, distinct event/snapshot/undated mechanism titles, 70–150-character bodies, freshness (≤72h), provenance, editorial de-duplication and ledger validation. Actual relevance, scoring, natural language and factual accuracy still require editorial review.
- **Auditable** — every edition ships an *Editor's Self-Review*. Alongside scoring, freshness, thread continuity, critique and A4 project discovery, the exact `## A5 AI候选筛选` heading sits after A4 and before B. Its `### 厂商覆盖` and `### 前三条与取舍` record all seven canonical company names, concrete queries and findings, five-axis scores, same-event consolidation, ranking and reasons for selection or exclusion.

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

The scheduled Codex path uses the GitHub connector object API: verified blobs, a tree based on the current remote main tree, one report commit, an exact five-file comparison, then a non-force fast-forward with an expected parent SHA. No staging branch is required. Read back all five blobs and today's latest date before creating the local mirror commit. Recoverable errors resume from the failed stage; unrelated local changes are preserved separately. Local Git credentials, PATs, `gh`, and webhook access are not part of the daily path. The no-argument `publish.sh` / `push` stages remain only for the manual Legacy GitHub Actions fallback.

If any downstream step fails, re-run only that stage — never re-research. See the resume matrix in [OPERATIONS.md](OPERATIONS.md) §5.

## Files

| File | Role |
|------|------|
| `generate.md` | The full daily instruction set the Codex automation executes (preflight → research → score → thread → self-review → gates → render → connector publication) |
| `METHODOLOGY.md` | Editorial methodology: scoring rubric + story threading + integrity gates |
| `config/sources.json` | Source registry (official / founder / media / kol / data × region × topic) + a real-time RSS feed layer |
| `config/project-radar.json` / `config/research-playbook.md` | Named project discovery, seven mandatory daily AI scans, targeted questions, classification, discussion provenance and research rules |
| `lib/research-plan.mjs` | Perp rotation plus all seven daily AI scans; missing AI companies fail validation, without API credentials or network writes |
| `lib/research.mjs` | Research structure, source dates, check dates and discussion validation |
| `threads.json` | **Story ledger** — persistent cross-day state (score / thesis / cadence / development log) |
| `lib/threads.mjs` | Ledger QA — schema validation + "threads due for review today" reminder |
| `lib/check-freshness.mjs` | Freshness + anti-fabrication gate (news ≤72h; URL-embedded date vs `date` cross-check) |
| `lib/validate-content.mjs` | content.json structural validator (required fields / URL scheme / date format) |
| `lib/check-run-state.mjs` | Pre-research idempotency + market-snapshot status (`ALREADY_PUBLISHED` exits 10) |
| `lib/check-editorial.mjs` | Blocks repeated lead/body/context and ungrounded or generic opportunity items |
| `lib/build-html.mjs` | Content JSON → single-file magazine HTML; v2 preserves dynamic section order and renders concise items, while legacy output remains compatible |
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
- Non-AI sections follow the selected stories without item or research quotas. AI contains exactly three highest-ranked qualifying news items after seven-company daily coverage; keep researching if fewer qualify, without low-value filler or invented dates.
- Every item is strongly related to Crypto or AI; a complete title states the concrete event or mechanism, followed by one 70–150-character paragraph without template subheads. Event titles include `event_date`; mechanism titles do not inherit today's check date.
- A non-AI study's `checked_at` is not its publication, launch or data-snapshot date. Its primary documents may be old or undated when actual current reading is recorded. A genuine data-snapshot study may use `snapshot_date` with a matching “截至” headline instead of `event_date`. News uses the existing 72-hour limit or genuine multi-event seven-day weekly-trend exception, including AI; single old events and studies cannot fill the three AI slots.

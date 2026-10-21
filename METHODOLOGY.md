# Editorial Methodology

> This document explains **why the daily reads the way it does**. The core stance: a daily is not a re-statement of today's headlines — it is **an analyst tracking a set of narratives**, intimately familiar with the arc of each important story, weaving developments scattered across days into a single line of judgment. The mechanisms below exist to support that stance.

---

## 0. One-line positioning

> **Not day-by-day reporting, and not a fixed-story diary.** What the reader should take away is which structural shifts actually moved today, what they mean for us, and what to watch next.

To deliver that, the system does more than generate content. It **maintains state** (a cross-day story ledger), **scores signal** (to drive selection and tracking), and **enforces integrity mechanically** (freshness, anti-fabrication, de-duplication, missed-run alerting). Remove any one and it degrades into "a daily produced from a one-line prompt."

The lead directly states one evidence-backed conclusion or analytical result and its necessary boundary, not a reading guide, research plan or compressed table of contents. Version 2 uses one or two short sentences, 20–120 characters total and at most 70 per sentence. Avoid “更值得研究的是”, “更值得关注的是”, “这期先看”, “这一期先看”, “今天先看”, “本文将”, “让我们来看看” and similar introductory promises. Do not cram multiple institutions, unexplained terms, or unrelated Crypto and AI developments into a synthetic theme. Supporting detail stays in the body; historical research is not presented as a new event.

From 2026-10-21, `editorial_version: 2` uses dynamic non-AI sections without fixed categories, per-section counts or research quotas. The single exception is section `id: "ai"`: exactly three genuine `kind: "news"` items, including all `domain: "ai"` and `"crypto-ai"` items, in descending integer `importance_score` order from 75 to 100. Every item must be strongly related to Crypto or AI and useful for product, trading, distribution, risk or tool decisions. Internal research still checks mechanisms, GTM, product choices, attributed discussion and uncertainty. The page shows only a complete headline, one 70–150-character paragraph and one numbered source line, “来源 1 2 3…”. Headlines carry dates only for a verified event or a genuine data snapshot, not for the act of checking a mechanism. All primary, reference and discussion URLs are retained and deduplicated; full source names, dates and available author/affiliation metadata stay in each link's `title` and `aria-label`, not a separate supplement row. No event/mechanism/impact subheads, context card, research grid or separate developments block is displayed. Titles and source links are excluded from the body character count.

### Facts first, mechanisms in ordinary language

Use the approved 2026-10-21 edition of roughly nine items as a length reference: exactly three AI news items and around six non-AI items, varying with qualified material rather than a hard quota. Actively seek fresh derivatives-volume trends, product changes and user campaigns so evergreen mechanism studies do not crowd out current developments. Market comparisons need an actual snapshot time, consistent metrics, windows and coverage; notional turnover is not net capital inflow. A stale ranking or price-only bulletin is not fresh market analysis.

News begins with what actually changed, who can use it, and any necessary effective-date or scope details. A headline identifies the event date, project and concrete action. State the old-to-new difference only when both sides are verified; explain the relevant mechanism afterwards. Do not lead with claims about complexity, novelty or industry impact.

A mechanism study has an undated headline unless it concerns a real event. Describe what the user deposits, borrows, trades or withdraws, then explain a useful difference from a verified, comparable mainstream product and mode. Do not treat one platform's cross-margin mode as its only mode, or call an ordinary isolated-margin feature unique. A line such as “共享流动性不等于共享保证金” is not a substitute for explaining which balances can be used for which positions. Prefer concrete actions and consequences to abstract contrasts, jargon or a compulsory risk-disclaimer ending. This is an editorial review, not a blanket ban on logical comparisons.

Keep four dates distinct: source publication (`date`), event occurrence (`event_date`), actual data snapshot (`snapshot_date`), and source checking (`checked_at`). Event headlines match `event_date`. Only a genuine non-AI research snapshot uses `snapshot_date` and an “截至” headline; it is mutually exclusive with `event_date` and cannot be later than the report. Undated mechanism headlines do not display `checked_at`. The editor verifies the factual time and comparison basis; a valid field alone does not prove either.

## 0.1 Project discovery comes before news collection

Start with `config/project-radar.json`, recent discovery audits, and `node lib/research-plan.mjs YYYY-MM-DD`. Search exact project names and aliases with questions about liquidity, pricing, settlement, referrals, onboarding, mobile distribution, and trader experience. Follow ecosystem integrations and identifiable speakers to discover names outside the registry. RSS is a final coverage check, not a substitute for social discussion. Record at least two outside-registry discovery searches in the review.

The plan also requires a separate daily AI scan of Anthropic, OpenAI, Scale AI, xAI, Kimi, DeepSeek and Qwen. All seven are scanned every day, independent of Perp project rotation; this is coverage, not one published item per company. Use exact names and aliases in Chinese and English over a three-day window, covering releases, model capabilities, API availability, pricing, safety and real adoption. Discover official pages through search and read them before citation; do not invent URLs. Merge reports about the same event, score the candidate pool, and choose the highest three qualifying news items. If fewer than three qualify, continue research without reducing the threshold, recycling old studies or inventing dates.

A small funding round or early trading volume is not a reason to discard a useful product or distribution model. The July 17 review rejected Trasia largely because its funding was small; that filter missed the relevance of an Asia-focused frontend using existing liquidity. Size describes stage. Mechanism, distribution, and decision relevance determine research value.

An app chain, an order book, and an oracle describe different layers and may coexist. Every comparison separates execution, liquidity and counterparty PnL, trade/index/mark prices, custody and settlement, and liquidation or market-creation control. GTM analysis follows target users, acquisition channel, activation, retention, and incentive cost. Claims of popularity need multiple attributable observations and an explicit measurement window.

---

## 1. Signal scoring

Every candidate story is scored across five dimensions (0–100 total). Scoring is not decoration — it **forces selection, ordering, and the "track it long-term?" decision to be defensible**, and surfaces what genuinely matters.

| Dimension | Max | What it measures |
|-----------|-----|------------------|
| Structural | 30 | Does it reveal a consequential mechanism, product choice, or distribution model? Sector-wide disruption is not required. |
| Relevance | 25 | Does it touch the project's core, compete for the same users, collateral, order flow, asset supply, price discovery, liquidity or distribution, or change a concrete product/tool decision through AI capability, access, pricing, safety or adoption? |
| Durability | 20 | A one-off event, or the head of a multi-week narrative? |
| Actionability | 15 | Can it become a concrete opportunity / decision / risk for us? |
| Evidence quality | 10 | Verifiable mechanics, readable primary evidence, clear separation of claims and inference; early scale alone is not a penalty. |

**Tiers**: S (≥90) opens a tracked story thread · A (75–89) priority item, threaded if durable · B (60–74) eligible only for non-AI coverage · <60 cut.

Each edition's scoring detail is recorded in that day's *Editor's Self-Review* (`docs/archive/<date>-review.md`) and is auditable. AI selection uses the same 30/25/20/15/10 rubric: each published `importance_score` is the integer total, at least 75, and exactly the three highest qualifying candidates are published in descending order after same-event consolidation. A5 manually audits scoring, ranking, ties and exclusions; vendor coverage is not an output quota.

---

## 2. Story ledger & threading

This is what separates the daily from a news relay. **Important information must not break just because a reader missed one day, but a thread does not earn page space merely by remaining open.**

### 2.1 The ledger (persistent state)
`threads.json` holds every story currently being tracked. Each entry carries: the thesis, the implication for us (`why_us`), the trigger to watch (`watch_for`), a review cadence, the next review date (`next_check`), and a time-ordered development log (deltas only). It is public — anyone can see which threads the daily is tracking and where each one stands.

### 2.2 Lifecycle
```
new S-tier event ──open──▶ active ──(due review: update & recall if there's news)──▶ active
                              │
                              ├──(due review, no delta)───────────▶ active (internal only, off the page)
                              ├──(two cadences with no movement)──▶ dormant (kept, off the page)
                              └──(event resolves / ruling lands)───▶ closed (one closing line)
```
`lib/threads.mjs` mechanically lists, each day, the threads whose `next_check` is due — so nothing slips.

### 2.3 How it surfaces (the line between professional and verbose)
Version 2 places a verified new development in one regular news item. Necessary historical context fits naturally inside its paragraph. The ledger remains persistent, but there is no separate developments map or status card. Due reviews without new facts stay off the page; a story returns only with independently verifiable new information.

### 2.4 Competitive perimeter

The daily does not define competition by product label. It scans six surfaces every day:

1. direct perp and onchain-derivatives venues;
2. centralized exchanges and market makers;
3. wallets, brokers, super-apps, aggregators, and embedded trading;
4. substitute products such as prediction markets, options, regulated futures, tokenized securities, and leveraged spot;
5. oracles, clearing, stablecoins, bridges, custody, and risk infrastructure;
6. newly launched or newly funded trading products showing early adoption.

The operative question is not “is this another perp DEX?” It is “can this product replace the user's trading job, capture the collateral, own the distribution, or set the price?”

---

## 3. Integrity gates

Mechanisms run on scripts, not good intentions.

| Gate | File | Function |
|------|------|----------|
| **Run idempotency** | `lib/check-run-state.mjs` | Runs before research; exits 10 when today's report already exists, and labels the market snapshot fresh/stale so expensive work is not repeated and old numbers are not reused |
| **Freshness** | `lib/check-freshness.mjs` | News ≤72h; genuine multi-event weekly threads retain the ≤7d exception, including AI. A single old event or a study cannot fill the three AI slots. Non-AI studies retain old/unknown publication dates with current-day checks and discussions no older than 30 days |
| **Anti-fabrication** | `lib/check-freshness.mjs` + `generate.md` | URL-embedded date vs `date` cross-check; and every `date` must be verified against the source page via WebFetch — unverifiable items are cut. Built after a real incident where months-old articles were stamped with today's date |
| **Ledger integrity** | `lib/threads.mjs` | Story-ledger schema validation; a broken ledger blocks publishing |
| **Concise format** | `lib/validate-content.mjs` + `lib/research.mjs` | Dynamic nonempty non-AI sections; exactly three AI news items with integer scores 75–100 in descending order; explicit Crypto/AI relevance and correct domain routing; 12–90-character headlines with event/snapshot dates only when applicable, one 70–150-character paragraph, no subheads or context blocks |
| **Editorial economy** | `lib/check-editorial.mjs` | Checks visible text for duplication; v2 may summarize internal research without treating hidden evidence as repeated page content |
| **Conclusion lead** | `lead` + `lib/validate-content.mjs` | v2 requires one or two short sentences, 20–120 characters total and ≤70 per sentence; editorial review checks a direct evidence-backed conclusion and boundary, not a reading guide or research plan |
| **Reader-value audit** | `review.draft.md` + `lib/check-review.mjs` | Forces the editor to answer why today's edition is worth opening, what judgment changed, what decision improves, and what would invalidate the conclusion |
| **Source provenance** | `references` + validator/renderer | News has a dated primary source; studies require at least two distinct URLs with separate publication/check dates. All source URLs are deduplicated into one numbered line; full names, dates and available author relationships remain in title/aria-label, including explicit undated labels |
| **Project depth** | `lib/research.mjs` + validator | Internal research retains classification, mechanism, GTM, product choice, discussions or a gap, inference and unknowns. It does not render as a template grid; a kind label alone cannot exempt stale news |
| **Delivery de-dup** | `feishu-notify.yml` | Delivers only on the day's report commit, preventing duplicate cards; plus a concurrency lock |
| **Missed-run alert** | `daily-watchdog.yml` | Self-checks after the expected publish time; alerts if no report ran, preventing a silent missed day |
| **Delivery retry** | `lib/deliver.mjs` | Auto-retries transient channel failures so cards aren't dropped |

---

## 4. Audit trail

Before each publish, the archived review includes per-item freshness verification, scores, thread continuity, critique, exclusions and changes. The editor also checks that news explains the change before the mechanism, that research does not display its check date as an event, and that comparisons name the relevant product/mode and explain a concrete user consequence. Version 2 requires A4: actual queries, discovery candidates, category checks, discussion provenance, research novelty and open questions. It also requires the exact heading `## A5 AI候选筛选`, after A4 and before B, with `### 厂商覆盖` and `### 前三条与取舍`.

A5 coverage uses the seven canonical names Anthropic, OpenAI, Scale AI, xAI, Kimi, DeepSeek and Qwen. Each company has concrete bilingual queries, the three-day window, readable sources, findings and exclusion reasons when nothing qualifies, not just a coverage checkbox. The selection subsection records candidate five-axis scores and integer totals, same-event consolidation, ranking, why the top three won and why other candidates were excluded; its winners and scores must match the AI section.

New candidates survive in this existing report artifact and are reread in subsequent runs; daily publication still changes exactly five files. Merely rereading an old document does not create a new story-ledger event.

---

## 5. Pipeline architecture

```
Scheduling   Cloud Routine (daily)
   │
Content      preflight → generate.md (score → thread → weave → self-review) → editorial gates → HTML render
   │           ├─ State: threads.json (story ledger)
   │           └─ Gates: run-state / structure / editorial / freshness / threads
   │
Hosting      GitHub Pages (one public URL, channel-agnostic)
   │
Delivery     GitHub Actions → lib/deliver.mjs (de-dup / retry) → channels (Feishu + Slack)
   └─ Safety net: daily-watchdog.yml
```

Principles: **content decoupled from channel**, **state separated from presentation**, **judgment separated from gatekeeping**, and **one fact has one visible home and traceable source**.

---

*This methodology evolves with the system. Behind most of these rules sits a real lesson learned the hard way.*

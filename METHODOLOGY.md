# Editorial Methodology

> This document explains **why the daily reads the way it does**. The core stance: a daily is not a re-statement of today's headlines — it is **an analyst tracking a set of narratives**, intimately familiar with the arc of each important story, weaving developments scattered across days into a single line of judgment. The mechanisms below exist to support that stance.

---

## 0. One-line positioning

> **Not day-by-day reporting — continuous narrative analysis.** What the reader should take away is not "what happened today," but "where the few structural shifts now under way stand, what they mean for us, and what to watch next."

To deliver that, the system does more than generate content. It **maintains state** (a cross-day story ledger), **scores signal** (to drive selection and tracking), and **enforces integrity mechanically** (freshness, anti-fabrication, de-duplication, missed-run alerting). Remove any one and it degrades into "a daily produced from a one-line prompt."

---

## 1. Signal scoring

Every candidate story is scored across five dimensions (0–100 total). Scoring is not decoration — it **forces selection, ordering, and the "track it long-term?" decision to be defensible**, and surfaces what genuinely matters.

| Dimension | Max | What it measures |
|-----------|-----|------------------|
| Structural | 30 | Does it shift market structure / competitive landscape / regulatory definition / a core mechanism? |
| Relevance | 25 | Does it touch the project's core (perp-DEX mechanics / RWA·FX·equity markets / fee model / regulation / competitor playbooks)? |
| Durability | 20 | A one-off event, or the head of a multi-week narrative? |
| Actionability | 15 | Can it become a concrete opportunity / decision / risk for us? |
| Magnitude × Credibility | 10 | Record-setting / first-of-kind / officially confirmed vs. rumor / small numbers |

**Tiers**: S (≥90) opens a tracked story thread · A (75–89) lead item, threaded if durable · B (60–74) included · <60 cut.

Each edition's scoring detail is recorded in that day's *Editor's Self-Review* (`docs/archive/<date>-review.md`) and is auditable.

---

## 2. Story ledger & threading

This is what separates the daily from a news relay. **Important information must not break just because a reader missed one day.**

### 2.1 The ledger (persistent state)
`threads.json` holds every story currently being tracked. Each entry carries: the thesis, the implication for us (`why_us`), the trigger to watch (`watch_for`), a review cadence, the next review date (`next_check`), and a time-ordered development log (deltas only). It is public — anyone can see which threads the daily is tracking and where each one stands.

### 2.2 Lifecycle
```
new S-tier event ──open──▶ active ──(due review: update & recall if there's news)──▶ active
                              │
                              ├──(two cadences with no movement)──▶ dormant (kept, off the page)
                              └──(event resolves / ruling lands)───▶ closed (one closing line)
```
`lib/threads.mjs` mechanically lists, each day, the threads whose `next_check` is due — so nothing slips.

### 2.3 How it surfaces (the line between professional and verbose)
Two non-overlapping mechanisms:
- **Inline callback** — when today's story belongs to an active thread, one sentence places it on the arc ("X thread · since MM-DD · 3rd development"). Gives a single story depth.
- **"Story Threads" map** — a compact block at the top of the report listing the threads worth surfacing today, each with today's delta + what to watch next. Lets the reader see, at a glance, where the tracked stories stand.

**Anti-redundancy rule**: a thread appears on a given day only if there is a real new development, or its review is due *and* there is something informative to say. A callback states only the delta, never re-narrates. The map holds at most 3–4 threads. The test is the reader's felt sense — "the author is genuinely following this" — not "that story got repeated again."

---

## 3. Integrity gates

Mechanisms run on scripts, not good intentions.

| Gate | File | Function |
|------|------|----------|
| **Freshness** | `lib/check-freshness.mjs` | News ≤72h, weekly-thread ≤7d; over the limit exits 1 and blocks publishing |
| **Anti-fabrication** | `lib/check-freshness.mjs` + `generate.md` | URL-embedded date vs `date` cross-check; and every `date` must be verified against the source page via WebFetch — unverifiable items are cut. Built after a real incident where months-old articles were stamped with today's date |
| **Ledger integrity** | `lib/threads.mjs` | Story-ledger schema validation; a broken ledger blocks publishing |
| **Scale context** | `lib/validate-content.mjs` + `generate.md` | Validates the compact context schema and warns when a potentially material metric appears without a same-basis explanation |
| **Delivery de-dup** | `feishu-notify.yml` | Delivers only on the day's report commit, preventing duplicate cards; plus a concurrency lock |
| **Missed-run alert** | `daily-watchdog.yml` | Self-checks after the expected publish time; alerts if no report ran, preventing a silent missed day |
| **Delivery retry** | `lib/deliver.mjs` | Auto-retries transient channel failures so cards aren't dropped |

---

## 4. Audit trail

Before each publish, an *Editor's Self-Review* (publicly archived) is produced: per-item freshness verification, the five-axis scoring table, the thread-continuity check, a six-lens critique, a ten-dimension scorecard, a not-included list, and a draft changelog. **No self-review = the check was not done.** Every day's judgment is traceable, contestable, and improvable.

---

## 5. Pipeline architecture

```
Scheduling   Cloud Routine (daily)
   │
Content      generate.md (score → thread → weave → self-review) + lib/build-html.mjs (magazine render)
   │           ├─ State: threads.json (story ledger)
   │           └─ Gates: lib/check-freshness.mjs / lib/threads.mjs
   │
Hosting      GitHub Pages (one public URL, channel-agnostic)
   │
Delivery     GitHub Actions → lib/deliver.mjs (de-dup / retry) → channels (Feishu + Slack)
   └─ Safety net: daily-watchdog.yml
```

Principles: **content decoupled from channel** (add a channel by editing config, not code), **state separated from presentation** (ledger vs. daily snapshot), **judgment separated from gatekeeping** (the model judges, scripts validate).

---

*This methodology evolves with the system. Behind most of these rules sits a real lesson learned the hard way.*

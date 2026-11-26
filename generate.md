# Perp DEX Daily publishing guide

Produce one English-language edition for the current date in Beijing. Write headlines, body copy, section labels, summaries, editorial reviews, and ledger commentary in English. Preserve source URLs, API identifiers, numbers, dates, and attributed meaning. Research may use sources in other languages.

Perp DEX Daily serves traders, product builders, and market researchers. Cover perpetual futures, crypto trading infrastructure, and material AI developments. Verify what changed, when it happened, who can use it, and what decision it affects. Use `editorial_version: 2` for current editions. Read [the research playbook](config/research-playbook.md) with [the project radar](config/project-radar.json).

## 1. Preflight and prior coverage

Determine the report date with `TZ=Asia/Shanghai date +%F`. Before starting online research, run:

```bash
node lib/check-run-state.mjs YYYY-MM-DD
```

An exit code of 10 (`ALREADY_PUBLISHED`) means the date is already in `docs/latest.json`. End the run without duplicating an edition or notification. Exit 1 means the state or date needs investigation. Repair a recoverable issue and retry preflight. Exit 0 means research can proceed. A stale or missing market snapshot precludes its use in the report.

Read the three most recent published reports, A4 and A5 in the last seven editorial reviews, the current ledger, and the files listed in [the operations guide](OPERATIONS.md). With no archive, begin with verified developments from the normal reporting window. In subsequent editions:

- Follow up only with a verified change. State the new fact and add its first-coverage date if a reader needs context. Rechecking an existing rule does not create a new event.
- Avoid repeating the same project and research thesis within seven editions. Record what the new research adds in `research.why_now`.
- Run `node lib/threads.mjs`. Review every active story's thesis, reader relevance (`why_us`), next observation (`watch_for`), and due date. Resolve each due review even if the result stays in the ledger.

## 2. Build the research plan

Run `node lib/research-plan.mjs YYYY-MM-DD`. Use the registry in `config/sources.json` to distinguish official announcements and protocol documents, founder or core-team signals, press coverage, commentator interpretations, and independent data. Locate `verify: true` accounts by the listed name. If a watch-list source is unavailable, try a comparable source. Treat social handles as leads until the actual statements are readable.

Start with reader leads, unresolved questions, and rotating projects. Follow aliases, ecosystem integrations, developers, traders, and named commentators. Search at least twice outside the registry. Apply the playbook's four groups of questions on discussion, acquisition and retention, product flows, and mechanisms. Check RSS and media last for omissions. A coverage outage or inaccessible post is an evidence gap.

Scan six competitive areas on each run:

1. Perpetuals DEXs, onchain order books, and real-world-asset or stock perpetuals.
2. Centralized derivatives exchanges, unified margin, brokers, and market-making infrastructure.
3. Wallets, brokers, super-apps, aggregators, and embedded trading.
4. Prediction markets, options, regulated futures, tokenized securities, and leveraged spot trading.
5. Oracles, clearing, stablecoin collateral, bridging, custody, and risk controls.
6. Discoveries from the past 30 days, including launches, testnets, financing with a concrete product purpose, and first documented use.

Search the last 24 to 48 hours for changes in products, listings, governance, access, distribution, and clearing as well as conventional perpetuals terms. Identify which trading need a competing product serves and how it changes access, collateral, order flow, price discovery, liquidity, or distribution. Registering a project as a lead does not guarantee coverage.

Run the separate `ai_daily_scan` for Anthropic, OpenAI, Scale AI, xAI, Kimi, DeepSeek, and Qwen every day. For each, search exact names and aliases in English and Chinese over three days. Submit `query_en` in English. The plan supplies the `query_zh` search intent in English and sets `ai_query_localization.target_language` to `zh`. Translate the search terms into Chinese before issuing the second search, add verified Chinese names alongside the original brand, and preserve search operators. Apply the same procedure to Chinese official-source discovery and any discovery entry marked `target_language: zh`. Record the sources returned by both searches. Cover releases, capabilities, and API availability, then pricing, safety, and evidence of adoption. Include aliases such as Claude, Grok, Moonshot, and Alibaba Qwen. Find and read the actual official page before citing a URL. Log findings for each company in A5. Also consider qualifying candidates from outside these seven.

Global primary materials and specialist outlets provide broad coverage. Chinese-language sources including BlockBeats, Odaily, PANews, TechFlow, Foresight News, ChainCatcher, Jinse, Wu Blockchain, and BlockTempo can surface Asia-specific regulation, local launches, or original announcements. Follow leads to the original material and verify dates there. Use reviews, posts, interviews, forums, and app stores for evidence about slippage, funding, withdrawals, incentives, or mobile distribution. Identify the author and their relationship to the project.

## 3. Verify evidence, freshness, and scale

Open every cited page. A search-result snippet, crawl time, or a recollection of a URL cannot establish an event, date, or rule. If a source returns a 403, is unavailable, or gives no publication date for news, find a readable dated account or omit it. Prefer an exchange announcement, protocol document, regulatory filing, attributed original post, or original paper. Keep claims by the operator distinct from independent evidence of adoption.

Use the four date fields for their specific purposes:

| Field | Meaning and use |
| --- | --- |
| `date` | Actual publication date of the cited source, confirmed on the page. News requires a date. Undated research documents may use null. |
| `event_date` | Verified date of the event itself. Include it in news headlines. A later reprint does not renew an event. For an announcement of future implementation, distinguish the announcement from its effective date. |
| `snapshot_date` | Actual observation date of a data study. Use it only on research and with a matching “As of” headline, no later than the report date. It is mutually exclusive with `event_date`. |
| `checked_at` | Day the source was read. For studies, set it to the report date on the primary source and each reference. Keep it out of undated mechanism headlines. |

Check embedded source URL dates against the source's real date. An unexplained difference of more than two days blocks publication. In a prior edition, articles published on December 19, 2025, January 29, March 18, and June 3, 2026 were assigned June 20 or 21 dates. Keep an older article's true date even when that removes a candidate.

**News.** A standalone news item's source and event must meet the 72-hour window. Older evidence needed for context can appear briefly in a current item, clearly dated as background. A seven-day exception is available for one or two genuine multi-event weekly trends. Consolidate related developments into a chronological account, prefix the headline with `Weekly theme |`, use the latest relevant source date, and explain the change over the week. A single old announcement cannot use this exception. AI news follows the same rule. Reject future and invalid dates.

**Research.** Use `kind: "research"` for a substantive non-AI study with full evidence. Require at least two distinct URLs, including an official mechanism document or product page, and reread all sources on the report date. Preserve known dates even when old. Document which rule, application, comparison, or evidence is new to the publication. Search current discussion over seven days where possible, up to 30 days. Mechanism documents have no age limit. Older interviews can serve as references. Record specific discussion gaps if original observations are unavailable.

**Figures.** Inspect `docs/market.json` before using its CoinGecko derivatives, price, market-cap, or dominance figures. The existing market-data workflow is scheduled for 07:30 Beijing time. Use a group of figures only when `fetched_at` falls on the current Beijing date and that group has no error flag. Use the workflow's snapshot when cloud research cannot reach the data provider directly. Cross-check with the registry's data pages, such as DefiLlama Perps or CoinGecko Derivatives. Use [the benchmarks](config/benchmarks.md) as dated historical context. Compare matching metrics, windows, assets, and venues. Name the missing denominator when a ranking or share cannot be checked. Distinguish daily volume, open interest, fees, net deposits, and user retention.

**Mechanisms and product adoption.** Classify each trading product as an independent protocol, trading frontend, spot venue or infrastructure, prediction market, or other relevant product. Check execution, source of depth, counterparties and P&L, execution and risk prices, settlement, custody, market creation, and distribution independently. An application chain may use both an order book and an external oracle. Cite market-specific fee schedules, provider names, and risk parameters with their dates. Identify how a user discovers, funds, trades on, and returns to the product, and who pays the incentives. Verify AI candidates against their actual model, API, product, tool, or adoption changes.

## 4. Select candidates

Score all candidates. Record the five components, total, tier, kind, selection, and decision on ledger tracking in A2. Use the same score for AI candidates in A5.

| Dimension | Points | Evidence guiding the score |
| --- | ---: | --- |
| Structural impact | 30 | Consequential execution, liquidity, distribution, or product choices. A documented new mechanism can qualify at an early stage. |
| Relevance | 25 | Effect on access, collateral, trading, exits, or selection of a product, route, or AI tool. A concrete decision earns more than a general comparison. |
| Durability | 20 | Likelihood that observable developments will continue over several weeks. A one-off event earns few points. |
| Actionability | 15 | Evidence enabling a reader to change a decision or verify a specific risk. |
| Evidence quality | 10 | Readable, attributable evidence of the rules, actual product, or observation. State the boundary between fact and inference. |

An S candidate scores at least 90 and opens or updates a story thread, usually reviewed about every three days. An A candidate scores 75 to 89 and receives priority. If durability is at least 15, track it on a roughly five-to-seven-day cadence. A B candidate scores 60 to 74 and is eligible for non-AI coverage. Exclude lower scores except for necessary, clearly attributed background. A low funding amount or early trading volume is insufficient by itself to discard a useful mechanism or acquisition finding.

Build non-AI sections around the selected stories. Each item must show a concrete connection to crypto or AI and help the reader understand product use, trading, risk, distribution, or tool selection. Screen out unrelated macro commentary, celebrity news, raw price moves, unsupported predictions, and statements that repeat public announcements without useful new information. For financing or regulation, identify the product use of funds, access restriction, rule, or execution choice that changes. Consider current volume, product changes, and user campaigns as well as mechanism studies.

Consolidate reports of the same AI event before scoring. Publish exactly the three highest qualifying news items in a single `ai` section, with integer `importance_score` values from 75 to 100 in descending order. Explain ties, direct sources, and exclusions in A5. When fewer than three qualify, continue researching without lowering the standard. The approved October 21, 2026 edition had around nine items overall, including three AI items. Non-AI counts depend on the available evidence.

## 5. Maintain the story ledger

For an S-tier event or durable A-tier change, update an existing thread if it matches the thesis. Append the dated new fact and URL, update `last_update`, and set `next_check` according to cadence. Otherwise open a thread with an ID, title, score, tier, thesis, relevance to readers, next observation, status, cadence, dates, and evidence log. Preserve the existing schema and status values.

For each due active thread, check for new evidence. A verified change earns a new log entry. Without one, advance the review date without adding a repeated status line or a public item. Two review cycles without a change move the thread to `dormant`. A resolved matter becomes `closed` with a final factual line. Rerun `node lib/threads.mjs` after editing.

A qualifying development appears in one normal report item. Use a short sentence of prior context where needed. Keep review reminders, status cards, and a separate `content.json.threads` snapshot out of v2 editions.

## 6. Write the public edition

- **Lead.** State one supported finding and any necessary limit in one or two sentences. Use 8 to 55 words overall and at most 32 words per sentence. Prefer the concrete change and its consequence over phrases such as “This edition will explore” or “Let's look at.” Keep detailed numbers and mechanics in the body. A regulatory or funding announcement earns the lead only if its effect warrants it.
- **Headlines.** Use 3 to 25 words in a complete statement. News headlines name the real event date, project, and change. Use ISO dates or English month-and-day dates. Mechanism studies have undated headlines unless tied to a verified event. Snapshot studies use “As of” and the matching data date.
- **Body.** Write a single paragraph of 30 to 100 English words in a single string. Omit bullets, stacked subheads, and separate context cards. The public headline and numbered source row are outside the body word count. Use plain prose or the renderer's supported bold markers and place URLs in their dedicated fields.
- **News.** Begin with what was added, changed, or withdrawn. Give the affected users and scope, including region or effective date where material. Compare with the previous rule only if documented. Explain the mechanism after the event itself.
- **Studies.** Describe what users deposit, borrow, trade, or withdraw. Compare a documented equivalent mode. For instance, if each pair needs separate collateral, say that the balance assigned to one pair cannot cover a loss in another. Explain the actual account behavior before calling a rule unusual.
- **Navigation and evidence.** Use one section heading. Keep `kicker`, `product_view`, separate developments, retired product-assessment sections, item `context`, and internal research labels off the current page. Let the lead summarize the main change and use the body for detail. A finding can draw on the internal notes without duplicating a visible paragraph. Avoid repeating a project study or the same event in multiple sections.
- **Style.** Write for an informed colleague. Define a term when it changes how the reader interprets the rule. Give figures a useful comparison. Avoid invented industry-wide implications, long dashes, unexplained jargon, and routine closing disclaimers. Distinguish planned, tested, and live features. Describe uncertainty in the relevant sentence.

## 7. Complete the editorial review

Review the working draft, revise the edition, and save the audit to `review.draft.md` in the repository root. Render archives it as `docs/archive/YYYY-MM-DD-review.md`. The audit is a separate published artifact. Use the following headings and order exactly.

```markdown
## A0 Reader value
**Why open this edition today?**: ...
**What is the most important finding?**: ...
**Which prior assessment changed?**: ...
**What decision can readers make?**: ...
**What evidence would overturn the conclusion?**: ...
**Which news recap was removed?**: Removed ...

## A Editorial review
### Freshness audit
### Six reader perspectives
### Ten-dimension assessment
### Top three revisions
## A1 Metric context
## A2 Candidate scores
## A3 Story continuity
## A4 Project discovery and evidence
### Search coverage
### Project classification
### Discussion evidence
### New findings and open questions
## A5 AI candidate selection
### Vendor coverage
### Top three and exclusions
## B Excluded items
## C Changelog
```

Fill every section with actual observations. In A0, give a concrete subject, change in judgment, decision, and observable falsifier. State which prior conclusion changed or why confidence changed. Explain the basis and limits of the lead and why it outranked other candidates. Begin the final answer with `Removed` and identify an actual removal. Revise the draft if it offers no specific reader benefit.

In the freshness audit, list every headline, section, kind, source date, event date, snapshot date, check date, body word count, and disposition. Mark inapplicable fields explicitly. Check source and event freshness for news, source-level verification for studies, matching snapshot headlines, and the multi-event basis for any weekly trend. In the six perspectives, give one or two item-specific observations for each reader:

1. A trader checks positions, margin, exits, and comparable figures.
2. A product lead checks implementation status and a comparable user action.
3. A strategist identifies a development with evidence for a resource or product decision.
4. A fact-checker separates independently verifiable evidence from a single party's assertion.
5. An editor checks ordering, the lead, and duplicated details.
6. A first-time reader identifies any missing background, unclear language, or unsupported claim of novelty.

Record the ten-dimension quality assessment with reasons for material deductions. Include accuracy, freshness, traceable sources, research depth, trading relevance, product value, mechanism clarity, numerical comparability, deduplication, and readability. List the three most important changes actually made.

In A1, record the headline, figure and unit, window, comparator, treatment in the paragraph, and conclusion. Identify missing data. Dates and identifiers may be exempt. In A2, score selected and rejected candidates and explain ledger decisions. In A3, record due-thread reviews, evidence added, status decisions, and whether each public development appears once.

In A4, give exact queries, dates and windows, at least two outside-registry discovery queries, classifications, coverage gaps, attributed discussion, and what changed relative to the past seven editions. Include every selected research project. Even an edition without research items requires an actual discovery and exclusion record.

In A5, record actual bilingual queries, three-day windows, sources, results, and any access gaps for all seven canonical company names. Then list candidate subscores and totals, merge duplicate events, rank the remainder, explain ties and exclusions, and reconcile the published top three with their integer scores. In B, name three to five excluded candidates and give their reasons. In C, list three to five revisions from the working draft and why they improved the edition.

## 8. Write content.json

Preserve the field names. The following illustration shows one non-AI news item, with example-only values. A publishable edition also requires the AI section, real verified source URLs, and complete evidence.

```json
{
  "date": "2026-11-26",
  "editorial_version": 2,
  "edition": 143,
  "lead": "The exchange extended collateral eligibility to five tokenized securities.",
  "sections": [{
    "id": "collateral",
    "title": "Collateral and margin",
    "items": [{
      "kind": "news",
      "domain": "crypto",
      "relevance": "Eligibility affects which assets traders can post as margin.",
      "event_date": "2026-11-25",
      "headline": "November 25: Binance adds five tokenized securities as collateral",
      "body": "Binance added five tokenized securities to its eligible collateral list. Eligible users can trade these instruments on the spot market and use them as collateral under the applicable margin program.",
      "source": "Illustrative exchange announcement",
      "url": "https://example.com/announcement",
      "date": "2026-11-25"
    }]
  }]
}
```

Give each section a unique English slug. Array order is display order. Use `domain: "crypto"` outside the AI section. Use `domain: "ai"` or `"crypto-ai"` only inside it. Every item needs a substantive `relevance` statement of at least 12 characters after trimming. For the AI section set `id: "ai"` and `title: "AI"`. Each of its three news items has `kind`, `domain`, `relevance`, `importance_score`, `event_date`, `headline`, `body`, `source`, `url`, and `date`, with references where needed.

News may include one to three supplementary references in `references`, each with `source`, `url`, and `date`. Use one primary source per URL. Assign background or corroborating facts to their own references. The renderer combines and deduplicates primary, supplementary, and discussion URLs into a single numbered source row. Each link preserves source names, actual publication dates or undated status, check dates, and known author relationships in its title and accessible label.

For non-AI research, retain these extra fields:

| Field | What to record |
| --- | --- |
| `date`, `checked_at`, `references` | Actual primary publication date or null. Same-day primary check. One to three supplementary sources with their own name, URL, actual date or null, and same-day check. At least two distinct URLs overall. Do not hide a known date embedded in a URL. |
| `research.project`, `research.category` | Named project and one of `perp-protocol`, `trading-frontend`, `spot-infrastructure`, `prediction-market`, or `other`. |
| `research.why_now` | First substantial investigation or new evidence relative to recent coverage. |
| `research.mechanism` | Matching, liquidity, counterparties, risk prices, settlement, and the risk bearer. Identify material gaps. |
| `research.gtm`, `research.product` | Target user, acquisition, incentives, activation, retention evidence, user task, and a real product choice and its cost. |
| `research.discussions`, `research.discussion_gap` | Up to four readable observations, each with `speaker`, `affiliation`, `summary`, `url`, and `date`. Use `official`, `independent`, `sponsored`, or `unknown`. When there are none, use an empty array and state which searches and access gaps prevented verification. |
| `research.implication`, `research.unknowns` | Inference and the conditions under which it holds, missing mechanism or adoption evidence, and the observation that would change the assessment. |

Each substantive research field and any required discussion-gap explanation must contain at least 12 characters after trimming. Keep substantive descriptions in the evidence record. Select the most useful facts for the public paragraph and label an inference when including it. A research label alone cannot convert stale news into a study.

## 9. Validate, release, and recover

```bash
bash publish.sh validate
bash publish.sh render
bash publish.sh manifest
```

Run the checks, tests, local mirror verification, and recovery steps in [the operations guide](OPERATIONS.md). Confirm that the homepage and dated archive match. Publish exactly the five manifest paths through the GitHub connector against the current remote tree. Match byte counts, base64 lengths, and blob SHAs. Compare the parent and candidate commit, recheck the parent, then fast-forward `main` with `force: false` and `expected_sha`. A race requires checking the new head and rebuilding the candidate on that tree. Read back all five hashes and today's latest date before making the local mirror commit. GitHub Pages, Feishu, and Slack use existing repository workflows.

Keep the research inputs, report, ledger, review, and recovery point if a downstream step fails. Correct the particular item, evidence, ledger record, render, object transfer, or delivery stage. Read remote state after a timeout before repeating a write. Retry recoverable failures without repeating completed research or delivering a second card. If the generation input itself is missing or invalid, return to the affected research stage. The manual legacy GitHub Actions fallback retains separate shell publication modes. Its credentials and commands are outside the scheduled connector flow.

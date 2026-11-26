# Perp DEX Daily operations guide

This guide covers the scheduled edition from preflight through publication and delivery. The editorial requirements and source rules are in [the publishing guide](generate.md) and [the research playbook](config/research-playbook.md).

## 1. Scope and publication authority

- The daily run publishes to `dorischeyy/perp-daily` on `main`. Use the current date in `Asia/Shanghai` for the edition, checks, and archive names.
- Use the GitHub connector's Git object API. Base each report on the current remote commit and tree, then update the branch once. A staging branch is unnecessary.
- The daily path does not use local Git credentials, `gh`, a personal access token, `.env` values, other accounts, or channel webhooks. Workflow changes, repository settings, secrets, schedules, configuration, and skill maintenance require separate authorization.
- Identify existing local changes before starting. Preserve or isolate them reversibly and exclude them from the report commit. A dirty workspace can still produce an independently verified report.
- Existing repository workflows host the page and deliver Feishu and Slack summaries. Daily commits use `report: YYYY-MM-DD`. Maintenance commits use an appropriate `fix:`, `feat:`, or `chore:` prefix.

The October 20, 2026 editorial update was a local rules, code, test, and preview change. It did not redistribute that day's report.

## 2. Data flow

The scheduled Codex run checks the edition date, researches and verifies sources, scores candidates, updates the story ledger, writes the edition and its review, validates the artifacts, and renders the site. A connector commit advances the remote branch. GitHub Pages publishes the site. The delivery workflow distributes the report summary.

Research produces three durable handoffs: `content.json`, `threads.json`, and `review.draft.md`. Preserve them until publication is verified so downstream failures can be retried independently.

## 3. Daily run

### 3.1 Preflight before online research

Read this guide, `generate.md`, `METHODOLOGY.md`, `config/sources.json`, `config/project-radar.json`, `config/research-playbook.md`, `config/benchmarks.md`, `threads.json`, `docs/latest.json`, and `docs/market.json`. Review the last three published editions and the A4 discovery and A5 AI selection records in the last seven editorial reviews.

```bash
node lib/check-run-state.mjs YYYY-MM-DD
```

| Result | Action |
| --- | --- |
| `ALREADY_PUBLISHED`, exit 10 | Today's edition exists. Stop the generation run. |
| `READY`, exit 0 | Begin research. If the snapshot is stale or missing, omit its figures. |
| Invalid state or date, exit 1 | Diagnose the affected file, repair recoverable issues, and rerun preflight. Report the exact recovery point if authorization or external state prevents a repair. |

### 3.2 Research and drafting

1. Run `node lib/research-plan.mjs YYYY-MM-DD`. Investigate named projects, aliases, traders, developers, distribution, and mechanisms. Record at least two outside-registry discovery searches in A4. Use RSS afterward to check coverage.
2. Cover perpetuals DEXs, centralized venues, wallets, brokers, prediction markets, regulated derivatives, tokenized assets, clearing, oracles, and new entrants. Include current volume trends, product changes, and user campaigns when evidence supports them. Separate notional volume, open interest, and net deposits.
3. Run the independent three-day AI scan for Anthropic, OpenAI, Scale AI, xAI, Kimi, DeepSeek, and Qwen. Search names and aliases in English and Chinese for releases, capabilities, access, pricing, safety, and actual adoption. Locate and read the official page. Record outcomes even when nothing qualifies.
4. Verify the source's publication date on the actual page. Independent news must fall within 72 hours. A genuine multi-event weekly trend may cover seven days. Apply the same rules to AI. For non-AI research, retain actual source dates or null, record today's check date, and use discussion evidence no older than 30 days.
5. Score each candidate for structural impact (30), relevance (25), durability (20), actionability (15), and evidence quality (10). Non-AI candidates below B are normally excluded. Consolidate duplicate AI events and publish exactly the top three qualifying news items with integer `importance_score` from 75 to 100 in descending order. Continue research if more qualifying candidates are needed.
6. Use `editorial_version: 2` for current editions. Group non-AI material according to the evidence. The single `ai` section contains all items with `domain` set to `ai` or `crypto-ai`. Document each item's relevance and the actual publication or implementation status.
7. Write in English. State one evidence-backed conclusion in a lead of one or two sentences, 8 to 55 words total, at most 32 per sentence. Use a complete headline of 3 to 25 words and a single body paragraph of 30 to 100 words per item. News headlines carry `event_date`. Undated mechanism studies have undated headlines. Real data studies may use `snapshot_date` and a matching “As of” headline. `checked_at` is the date of verification only.
8. Explain the change, affected users, effective date, and scope before describing its mechanism. For product research, explain user actions, money flows, and a comparable product in the same mode. Identify inference and unknowns. Keep notes about classification, comparison, go-to-market strategy, and discussion evidence in the research record.
9. Use `source/url/date` for the primary source and `references` for additional evidence. Preserve the publication date, check date, and author relationship when available. The renderer deduplicates primary, supplementary, and discussion URLs into a single numbered row.
10. Record factual changes in `threads.json`. An update appears once in the edition. The lead goes straight into sections without a separate ledger snapshot or product-view block.
11. Write the editorial review in the exact order specified in [the publishing guide](generate.md). A4 covers discovery and evidence. A5 follows A4 and precedes B. Use `## A5 AI candidate selection`, `### Vendor coverage`, and `### Top three and exclusions`. Record actual searches and reasons for selection, ties, and exclusions. Check the five scores against the published top three and ordering.

The October 21, 2026 reference edition had about nine items. Three AI news items are required. The number and arrangement of non-AI stories depend on verified material.

### 3.3 Validate and render

From the repository root, run the checks for the intended Beijing date:

```bash
bash publish.sh validate
bash publish.sh render
bash publish.sh manifest
npm test
npm run check
cmp -s docs/index.html docs/archive/YYYY-MM-DD.html
```

If the workspace contains `.env`, run the full tests in an isolated temporary directory that contains `lib/`, `test/`, `package.json`, and the public fixtures the tests require. Omit credentials, channel configuration, and `.env`. The delivery module attempts to read that file on import. Do not execute the delivery CLI during testing. Structure, editorial, and render tests can also be run separately.

| Gate | What must pass |
| --- | --- |
| `lib/validate-content.mjs` | Edition and section structure, AI routing, scores and ordering, relevance, word limits, date-aware headlines, URLs, and internal research evidence. |
| `lib/check-editorial.mjs` | Deduplication of visible copy, unique project studies, and checks for retired layouts. Hidden research may inform the visible paragraph. |
| `lib/check-review.mjs` | Review completeness, ordered reader questions, A4, A5, seven vendors, top three, and exclusions. Pass the edition content so v2 checks run. |
| `lib/check-freshness.mjs` | Publication and event dates, research check dates, URL dates, source timing, and rejection of future dates. |
| `lib/threads.mjs` | Ledger structure and due reviews. |

Inspect desktop and mobile layouts for horizontal overflow. Confirm that the homepage and dated archive match. Sections have one heading. Current editions omit kickers, context cards, item subheads, separate developments, and retired assessment sections. Check the visible lead, single-paragraph items, and numbered source links. Verify that sources retain full names, dates, and available affiliations in their accessible labels. Check the source and comparable market behind each significant figure. Use ordinary punctuation without en or em dashes in report prose.

### 3.4 Publish the five artifacts

The report manifest contains `docs/archive/YYYY-MM-DD-review.md`, `docs/archive/YYYY-MM-DD.html`, `docs/index.html`, `docs/latest.json`, and `threads.json`. Validate and render the entire set before advancing `main`.

1. Run `bash publish.sh manifest`. Save the expected `bytes`, `base64_chars`, and `blob_sha` for each file.
2. Read the commit and tree SHA of the current remote `main` through the connector. Remote market snapshots, historical files, or other updates may be absent locally. Build on the remote tree.
3. Create the five blobs. Verify the full byte count before transfer. For base64, strip transport whitespace and match the exact encoded length. Never upload a truncated terminal result.
4. Compare each returned or reused blob SHA with its manifest entry. Repair the affected transfer before proceeding if they differ. In particular, verify the full length and hash of the story ledger.
5. Overlay only the manifest paths on the verified remote tree. Create one commit with that remote head as its sole parent and message `report: YYYY-MM-DD`.
6. Compare the parent and candidate commit. The changed paths must match the five manifest entries exactly. Preserve the remote generation input, market snapshot, workflows, rules, and every unrelated path.
7. Recheck the head and fast-forward with `force: false` and `expected_sha`. If the head moved, inspect the new changes, reuse verified blobs, rebuild on the new tree, and repeat the comparison. If another run published today's edition, verify it and stop duplication.
8. Read back all five published files. Confirm the blob hashes and today's date in `docs/latest.json`.
9. Once all five match, create a local mirror commit with the same message and only those paths. Local history may give this commit a different SHA. The mirror stays local. Preserve unrelated workspace changes.
10. Report the remote commit URL, public edition URL, verification result, and delivery status. Distinguish a workflow starting from its successful completion.

After a timeout, read the relevant ref, commit, or blob before retrying the exact failed stage. Reuse an object or update already confirmed remotely. Recoverable validation, transport, or concurrency failures are handled during the run. If external access is genuinely unavailable or a fix needs prohibited credentials or configuration changes, record the completed checks, artifacts, failure, and next recovery point. The no-argument and `push` modes of `publish.sh` exist for the manual legacy GitHub Actions fallback.

## 4. Local and remote state

The connector does not move local `HEAD`. Report changes can therefore still appear as modified or untracked immediately after a successful remote release. Verify the commit and blob contents before making the local mirror. Local `origin/main` is not authoritative for this operation. Avoid resets, forced checkouts, or file deletion to obtain a clean-looking status.

## 5. Recovery by stage

| Failed stage | Resume here |
| --- | --- |
| Preflight | Check the target date, latest index, and snapshot status before researching. |
| Source verification | Recheck only the source or candidate. Drop news without a verified date. Find a qualifying AI replacement if necessary. |
| Structure or editorial | Fix the identified item or review section. Rerun validation. |
| Freshness | Correct the date from the source or remove the stale item. Research only the missing candidate. |
| Ledger | Correct the specific record in `threads.json` and rerun its validator. |
| Render | Rerun `bash publish.sh render` with the preserved inputs. |
| GitHub publication | Read back remote state, then retry the incomplete object or ref operation. |
| Pages or delivery | Inspect the existing workflow and its result. Keep the completed edition and avoid duplicate notifications. |

## 6. Maintenance and entry points

- **Editorial rules.** `generate.md` defines the daily run. `METHODOLOGY.md` explains selection, scoring, and continuity. The source registry, project radar, research playbook, and historical benchmarks live in `config/`.
- **Research.** `lib/research-plan.mjs` builds the project rotation and AI queries. `lib/research.mjs` validates research evidence and source dates. `lib/check-run-state.mjs` provides preflight.
- **Publication.** `publish.sh` coordinates validation and rendering. `lib/build-html.mjs` generates each page. `lib/build-publish-manifest.mjs` verifies the release set and blob hashes. `docs/latest.json` points to the newest edition, and `docs/archive/` holds editions and reviews.
- **Implementation changes.** Update the relevant rules and validator together. Test changes to `lib/` under `test/`. Check desktop and mobile rendering for layout changes. Treat schedules, repository or Actions settings, secrets, and delivery channel changes as separate maintenance tasks.

[Repository](https://github.com/dorischeyy/perp-daily) · [Latest edition](https://dorischeyy.github.io/perp-daily/) · [Workflow runs](https://github.com/dorischeyy/perp-daily/actions)

Dated editions use `https://dorischeyy.github.io/perp-daily/archive/YYYY-MM-DD.html`.

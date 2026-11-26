# Project discovery and research

Use this playbook with [the publishing guide](../generate.md) and `editorial_version: 2`. Research establishes who competes for users, how orders reach a venue, and who bears the risk. Publish the findings in English, while searching original materials in the languages used by projects and their users.

## 1. Choosing subjects

Group the day's verified crypto material according to the stories it supports. There are no fixed non-AI section names, counts, or research quotas. Use one `ai` section containing exactly three genuine news items. Include all AI and crypto-AI items there. Rank them in descending order by integer `importance_score` between 75 and 100. If fewer qualify, continue searching. A study or an old announcement cannot fill a news slot. Record the `domain` and specific `relevance` of every item.

Identify a decision the evidence can inform. For example, a rule change might affect how a user funds an account, reuses collateral, pays fees, or accesses a market in a particular region. A funding announcement, token move, ranking, or regulatory statement has to establish a concrete change to earn priority.

Investigate new projects, leads supplied by readers, and unresolved questions from prior editions. A useful non-AI study can introduce a mechanism without an announcement that day. Explain the new evidence or insight. Read the A4 and A5 reviews for the past seven editions and the most recent three reports. Consolidate reports of the same event. Repeat a project and thesis only for a meaningful change in mechanics, adoption, distribution, or the evidence behind a dispute.

The October 21, 2026 edition, with about nine items, is a length reference. Three AI items are required. The number of non-AI items depends on the quality of the material. Look for fresh volume trends, product changes, and user campaigns alongside mechanism research. Attach the actual observation time, measurement window, and coverage to market comparisons. Distinguish turnover, open interest, and net deposits.

## 2. Daily search sequence

Run `node lib/research-plan.mjs YYYY-MM-DD`. Start with suggested names, aliases, and accounts, then expand beyond the list.

1. Follow reader leads, unresolved projects from prior reviews, and the rotating project list. Identify the official site, documentation, developers, and integrations.
2. Search one concrete question at a time. Follow up on mechanism, user flow, acquisition, retention, and independent discussion.
3. Run at least two discovery searches outside the registry. Check ecosystem directories, builder integrations, app stores, wallet partnerships, researcher comparisons, and trader reports. Verify each new name against an official page.
4. Check press and RSS coverage after project research. Public posts, blogs, interviews, and forums can be searched without an X API key. Record access failures.

Run the separate `ai_daily_scan` for Anthropic, OpenAI, Scale AI, xAI, Kimi, DeepSeek, and Qwen every day, independently of the derivatives rotation. For each company, submit the English `query_en`, then translate the `query_zh` search intent into Chinese and run it within the same three-day window. The plan identifies the required language in `ai_query_localization.target_language`. Preserve brand names and search operators, and add verified local names when available. Translate Chinese official-source discovery terms and other entries marked `target_language: zh` before searching. Record the results or access gaps for each language in the review. Search for releases, model capabilities, and API availability, then for pricing, safety, and actual adoption. Claude belongs under Anthropic, Grok under xAI, Moonshot under Kimi, and Alibaba's Qwen products under Qwen. Use the seven canonical names in A5. Locate and read official pages before citing them. Additional companies can contribute qualifying stories.

Use separate windows. Search news over three days, discussions preferably over seven and at most thirty days, and recently discovered products over thirty days. Mechanism documentation can be older or undated. Distinguish a page's publication date from its indexing or crawl date.

### Four search groups

| Question | Example queries | Evidence to collect |
| --- | --- | --- |
| Who is discussing it? | Project name plus trader experience, review, criticism, withdrawal, or slippage. Search public author posts. | Named author, original URL and date, specific observation, relationship to the project. |
| How does it acquire and retain users? | Referral, affiliate, points, wallet integration, builder fees, Asia, mobile, invitation, or campaign. | Target group, first distribution channel, incentive cost, activation step, retention evidence. |
| What does the user do? | Onboarding, deposit, account, mobile, cross margin, API, or copy trading. | Task, funding and trading steps, feature trade-offs, dependence on an underlying protocol. |
| How does execution work? | Matching, oracle, liquidity, liquidation, settlement, custody, sequencer, or official documentation. | Matching location, role of prices, source of capital, execution, exit, and risk ownership. |

## 3. Classifying and comparing trading products

| Internal category | Definition |
| --- | --- |
| `perp-protocol` | Operates its own perpetual trading and risk rules. |
| `trading-frontend` | Provides a user interface over an existing protocol's matching, liquidity, or settlement. Name the underlying dependency. |
| `spot-infrastructure` | Provides a spot order book, borrowing, or leveraged spot trading. |
| `prediction-market` | Creates outcome shares with rules for resolution and settlement. |
| `other` | Covers another relevant product. State what it provides. |

These categories describe a project. Group public items by the actual question readers face. Different product types may appear together when they compete for the same task. Check AI stories against actual changes in models, APIs, tools, or adoption.

Verify each layer independently. An application chain, an order book, and an external oracle may coexist.

1. **Execution.** Establish whether orders match against a book, an AMM, a pooled quote, or an RFQ. Find where matching happens and who operates it.
2. **Liquidity and P&L.** Identify the counterparty, the capital committed by market makers or LPs, who pays profitable traders, and any external hedge.
3. **Prices.** Distinguish the execution, index, and mark prices. Check how the venue uses oracles for quotes, margin, or liquidation.
4. **Settlement and control.** Check the chain, collateral, segregation, account permissions, and withdrawal or emergency exit path. Identify undisclosed arrangements.
5. **Markets and risk.** Establish who lists a market, sets its limits, controls parameters, and absorbs liquidation losses, bad debt, insurance claims, or automatic deleveraging.

Compare a documented product in the same trading mode. State its collateral, liquidity, execution, and pricing. Verify market and date before citing a fee, an oracle provider, or a risk parameter.

## 4. Distribution, product decisions, and public writing

Trace the route from discovery to continued use. Identify the audience, where they find the product, what prompts a deposit or trial, their first completed action, why they return, and who pays the incentive. Claims about effectiveness need evidence such as retention, net deposits, or use after rewards end.

Explain at least one documented choice and its cost. Examples include building a venue versus drawing on existing liquidity, mobile onboarding versus professional API access, market breadth versus asset specialization, or collateral efficiency versus risk isolation. Attribute a project's stated position and label any inference about motives or effects.

Keep the full mechanism, go-to-market analysis, product trade-off, discussion, inference, and unknowns in the evidence record. Publish a 3 to 25 word headline and a single paragraph of 30 to 100 words. Put links in the source fields. For news, lead with the event, affected users, and effective scope. Document the previous rule before claiming a difference. For a study, describe what users can deposit, borrow, trade, or withdraw. Explain which balances can support which positions before generalizing about margin systems.

Use `event_date` for a verified event and match the headline date. Leave undated mechanism headlines undated. For a genuine data study, use `snapshot_date` with a matching “As of” date, no later than the report date. It is mutually exclusive with `event_date`. The actual source publication date stays in `date`, or is null for undated research material. Record the research check separately in `checked_at`. Never convert a check date into a launch or snapshot date.

Write the lead in one or two sentences, 8 to 55 words in total, with no sentence longer than 32 words. State one supported finding and any essential condition. Leave out reading instructions, general claims of significance, and connections between unrelated events.

## 5. Discussion and adoption claims

Each discussion entry needs an author, publication date, permanent link, specific observation, and relationship to the project. Use `official`, `independent`, `sponsored`, or `unknown`. Treat reposts, integration partners, developers, traders, and researchers as discovery leads. An official post, affiliate campaign, or airdrop task cannot establish independent user approval.

A claim that multiple people discussed an issue requires at least two distinct authors with readable original accounts. Growth or popularity also requires evidence across time and a stated sample. Reprints of one story count once. A search ranking, follower count, or screenshot does not establish adoption. If an X post is inaccessible, try a public blog, forum, interview, podcast transcript, or attributable secondary account. Identify secondary accounts as such. Otherwise record the queries and access gap in `discussion_gap`.

## 6. Source record and editorial review

Each study requires at least two distinct source URLs, including an official mechanism document or product page. Two official pages can confirm a rule without showing independent adoption. Reread the primary source and references on the report date and set their `checked_at` accordingly. A readable specification alone does not establish production availability. The public source row deduplicates the primary, reference, and discussion URLs and keeps source names, publication and check dates, and available affiliations in accessible link metadata.

Write `## A4 Project discovery and evidence` using these headings in order:

- `### Search coverage` records actual queries, windows, discoveries, selections, exclusions, and at least two searches outside the registry.
- `### Project classification` names the internal type, public grouping, domain, and relevance of each selected item.
- `### Discussion evidence` records author, affiliation, date, observation, and URL, or the specific evidence gap.
- `### New findings and open questions` compares the research with the past seven editions, identifies undisclosed details, and sets a trigger for the next review.

Follow A4 with `## A5 AI candidate selection`, before section B. In `### Vendor coverage`, use all seven canonical names and give the actual searches, source pages, findings, exclusions, or access gaps for each. In `### Top three and exclusions`, consolidate the same event and score all candidates across the five dimensions worth 30, 25, 20, 15, and 10 points. Explain the descending ranking, tie-breaks, and exclusions. Match the three published integer scores to those in A5.

Carry discovery leads into the next research cycle through A4 and A5. Add a qualifying change to `threads.json` using its actual event date. The five-file daily publication excludes source registry changes.

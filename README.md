# Perp DEX Daily

Perp DEX Daily is an independent research publication built and maintained by Doris. New daily editions are written in Simplified Chinese. The archive through November 26, 2026 is available in English. The publication covers perpetual futures markets, crypto trading infrastructure, and AI products. Each edition examines changes in pricing, margin, liquidation, or settlement and explains what traders, product builders, and researchers can do with that information.

[Read the latest edition](https://dorischeyy.github.io/perp-daily/) · [Browse past editions and editorial reviews](docs/archive/)

## Inside an edition

Issue 143, published on November 26, 2026, covered two changes in risk management. Binance added five tokenized securities to its collateral options. KuCoin announced shared insurance funds and described which contracts would face automatic deleveraging first when the new rules take effect on December 1. The edition links to the announcements. Its editorial review records the event dates, the reasons for selecting each story, and questions the announcements leave open. [Read issue 143](https://dorischeyy.github.io/perp-daily/archive/2026-11-26.html) · [Read the editorial review](docs/archive/2026-11-26-review.md)

## Research and publication

- **Sources and dates.** Stories link to exchange notices, regulatory filings, protocol documentation, and research papers. Reports distinguish the date of an event from the date a source was published, data was observed, or a rule was checked.
- **Continuing coverage.** A public ledger tracks the original assessment, new evidence, sources, and the next development to check. [Story ledger](threads.json)
- **Selection.** Candidates are scored for structural impact, relevance, durability, actionability, and evidence quality. An editorial review accompanies each edition and explains the selection. [Editorial methodology](METHODOLOGY.md)
- **Delivery.** A Codex automation researches, drafts, and validates each edition. GitHub Pages hosts the report, and repository workflows distribute summaries to Feishu and Slack. [Operations guide](OPERATIONS.md)

## Local preview

Use Node.js 18 or later. The public repository retains the July 22, 2026 working draft in `content.json`. For a local preview, use the sample in `config/content.sample.json`. From the repository root, run:

```bash
mkdir -p out
node lib/build-html.mjs config/content.sample.json out/preview.html
npm run check
npm test
```

Open `out/preview.html` in a browser. The publishing guide covers research, attribution, and production. The source registry lists the starting points for daily discovery. [Publishing guide](generate.md) · [Source registry](config/sources.json)

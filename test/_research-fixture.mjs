import { baseContent } from "./_helpers.mjs";

export function researchItem(overrides = {}) {
  return {
    kind: "research",
    domain: "crypto",
    relevance: "Wallet distribution changes how traders access the order book.",
    headline: "Example Protocol distributes its order book through a wallet",
    body: "Example Protocol matches orders in a dedicated execution environment and settles trades on chain. Its wallet integration gives traders another way to enter the market. Documentation explains the quote process but does not disclose retention after launch incentives expire.",
    source: "Protocol documentation",
    url: "https://example.com/docs/mechanism",
    date: null,
    checked_at: "2026-06-23",
    references: [{ source: "Independent review", url: "https://example.org/2026/05/01/research", date: "2026-05-01", checked_at: "2026-06-23" }],
    research: {
      project: "Example Protocol",
      category: "perp-protocol",
      why_now: "A newly supported wallet exposes the onboarding process for review.",
      mechanism: "A dedicated matcher processes orders before onchain settlement.",
      gtm: "Wallet distribution and market-maker programs serve different participants.",
      product: "Advanced order types and position controls support frequent traders.",
      implication: "Comparing conversion cost requires consistent reporting windows.",
      unknowns: "Post-incentive retention and market-maker concentration are undisclosed.",
      discussions: [],
      discussion_gap: "The reviewed public sources contained no dated independent trader discussion.",
    },
    ...overrides,
  };
}

export function researchContent(overrides = {}) {
  const content = baseContent({ editorial_version: 2, ...overrides });
  content.sections[0].items[0] = researchItem({ checked_at: content.date });
  content.sections[0].items[0].references[0].checked_at = content.date;
  content.sections[0].items[1] = researchItem({ headline: "A regional frontend distributes perpetual futures through a mobile application", url: "https://example.com/frontend", checked_at: content.date });
  content.sections[0].items[1].body = "The frontend routes signed orders to an external exchange using a mobile interface in the user's language. Its deposit guide describes account setup and an initial trade. The team has not disclosed how many first-time visitors continue trading after the promotion.";
  Object.assign(content.sections[0].items[1].research, {
    project: "Example Frontend",
    category: "trading-frontend",
    why_now: "The new mobile application opens a distinct regional channel.",
    mechanism: "Users sign locally and an external engine executes their orders.",
    gtm: "Regional community partners teach users how to make a first deposit.",
    product: "Localized navigation shortens the mobile order-entry process.",
    implication: "Conversion and retention data would help assess the distribution model.",
    unknowns: "Commercial terms for order revenue and customer data are private.",
  });
  content.sections[0].items[1].references[0].checked_at = content.date;
  const headlineDate = content.date;
  for (const section of content.sections) {
    for (const [index, entry] of section.items.entries()) {
      if (entry.kind !== "research") {
        entry.domain = section.id === "ai" ? "ai" : "crypto";
        if (section.id === "ai") entry.importance_score = 95 - index * 10;
        entry.relevance = "Eligibility and onboarding affect who can adopt the new feature.";
        entry.event_date = content.date;
        entry.date = content.date;
        entry.headline = `${headlineDate} ${section.title} opens feature ${index + 1} to applicants`;
        entry.body = `${section.title} released feature ${index + 1} with published eligibility requirements and setup instructions. Customers can apply directly through the product, while activation, retention and revenue figures are not yet available in the announcement.`;
      }
    }
  }
  return content;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContent } from "../lib/validate-content.mjs";
import { baseContent } from "./_helpers.mjs";
import { researchContent } from "./_research-fixture.mjs";

test("Accepts a valid report", () => {
  const { errors } = validateContent(baseContent());
  assert.equal(errors.length, 0, errors.join("; "));
});

test("Requires sections", () => {
  const c = baseContent(); delete c.sections;
  assert.ok(validateContent(c).errors.some((e) => /sections/.test(e)));
});

test("Rejects empty sections", () => {
  assert.ok(validateContent(baseContent({ sections: [] })).errors.length > 0);
});

test("Checks legacy section coverage and size", () => {
  const valid = baseContent();
  const perpdex = valid.sections.find((s) => s.id === "perpdex");
  perpdex.items.push(
    { headline: "Item 4", body: ["**Event**: Article 4"], source: "S", url: "https://example.com/perpdex-4", date: "2026-06-23" },
    { headline: "Item 5", body: ["**Event**: Article 5"], source: "S", url: "https://example.com/perpdex-5", date: "2026-06-23" },
  );
  assert.equal(validateContent(valid).errors.length, 0);

  const tooFew = baseContent();
  tooFew.sections.find((s) => s.id === "launchpad").items.pop();
  assert.ok(validateContent(tooFew).errors.some((e) => /launchpad.*3–5 news/.test(e)));

  const tooMany = baseContent();
  const crypto = tooMany.sections.find((s) => s.id === "crypto");
  crypto.items.push(
    { headline: "Item 4", body: ["Article 4"], source: "S", url: "https://example.com/crypto-4", date: "2026-06-23" },
    { headline: "Item 5", body: ["Article 5"], source: "S", url: "https://example.com/crypto-5", date: "2026-06-23" },
    { headline: "Item 6", body: ["Article 6"], source: "S", url: "https://example.com/crypto-6", date: "2026-06-23" },
  );
  assert.ok(validateContent(tooMany).errors.some((e) => /crypto.*3–5 news/.test(e)));

  const missing = baseContent();
  missing.sections = missing.sections.filter((s) => s.id !== "ai");
  assert.ok(validateContent(missing).errors.some((e) => /missing required news section: ai/.test(e)));
});

test("Rejects an invalid edition date", () => {
  assert.ok(validateContent(baseContent({ date: "2026/06/23" })).errors.some((e) => /date/.test(e)));
});

test("Requires a source URL", () => {
  const c = baseContent(); delete c.sections[0].items[0].url;
  assert.ok(validateContent(c).errors.some((e) => /url/.test(e)));
});

test("Allows only HTTP(S) sources", () => {
  const c = baseContent(); c.sections[0].items[0].url = "javascript:alert(1)";
  assert.ok(validateContent(c).errors.some((e) => /url/.test(e)));
});

test("Rejects invalid news dates", () => {
  const c = baseContent(); c.sections[0].items[0].date = "Yesterday";
  assert.ok(validateContent(c).errors.some((e) => /date/.test(e)));
});

test("Requires a nonempty body", () => {
  const c = baseContent(); c.sections[0].items[0].body = [];
  assert.ok(validateContent(c).errors.some((e) => /body/.test(e)));
});

test("Warns about unknown legacy sections", () => {
  const c = baseContent();
  c.sections.push({ id: "weird", title: "Weird", items: [] });
  const { errors, warnings } = validateContent(c);
  assert.equal(errors.length, 0);
  assert.ok(warnings.some((w) => /unknown section/.test(w)));
});

test("Rejects retired columns, subheads and kickers", () => {
  const ordinary = baseContent();
  ordinary.sections[0].kicker = "Repeated headline";
  assert.ok(validateContent(ordinary).errors.some((e) => /one section heading/.test(e)));

  const c = baseContent();
  c.sections.push({ id: "legacy-product-view", title: "Product assessment", items: [] });
  assert.ok(validateContent(c).errors.some((e) => /product assessment section was retired/.test(e)));

  const withSecondOrder = baseContent();
  withSecondOrder.sections[0].items[0].body.push("**Second-order effects**: Traders could switch collateral.");
  assert.ok(validateContent(withSecondOrder).errors.some((e) => /second-order effects subheading was retired/.test(e)));
});

test("Checks lead format and rejects retired cards", () => {
  const missing = baseContent();
  delete missing.lead;
  assert.ok(validateContent(missing).errors.some((e) => /lead must contain/.test(e)));

  const multiple = baseContent({ lead: "A new venue opened perpetual markets today. Traders can place orders through its wallet." });
  assert.ok(validateContent(multiple).errors.some((e) => /one sentence/.test(e)));

  const legacy = baseContent({ product_view: { judgment: "Retired field" } });
  assert.ok(validateContent(legacy).errors.some((e) => /product_view has been retired/.test(e)));
});

test("Allows a focused two-sentence lead", () => {
  const content = researchContent({ lead: "Example Protocol offers perpetual futures directly in its wallet. Retention figures after the incentive campaign remain unavailable." });
  assert.deepEqual(validateContent(content).errors, []);
});

test("Limits lead words, sentence count and sentence length", () => {
  for (const lead of ["facts ".repeat(56), `${"fact ".repeat(33)}.`, "A venue listed perpetual futures. Another venue opened a wallet. Both published fee schedules."]) {
    assert.ok(validateContent(researchContent({ lead })).errors.some((e) => /lead/.test(e)));
  }
});

test("Accepts metric context", () => {
  const c = baseContent();
  c.sections[0].items[0].context = { label: "Scale", text: "The venue accounted for about 10% of daily perpetual DEX volume." };
  const { errors } = validateContent(c);
  assert.equal(errors.length, 0, errors.join("; "));
});

test("Checks metric labels and explanation length", () => {
  const c = baseContent();
  c.sections[0].items[0].context = { label: "Unknown label", text: "Short" };
  const { errors } = validateContent(c);
  assert.ok(errors.some((e) => /context\.label/.test(e)));
  assert.ok(errors.some((e) => /context\.text/.test(e)));
});

test("Flags unexplained material metrics", () => {
  const c = baseContent();
  c.sections[0].items[0].body = "Trading volume reached $1.2B in 24 hours.";
  const { warnings } = validateContent(c);
  assert.ok(warnings.some((w) => /context is missing for a material metric/.test(w)));
});

test("Accepts a contextualized metric", () => {
  const c = baseContent();
  c.sections[0].items[0].body = "Trading volume reached $1.2B in 24 hours.";
  c.sections[0].items[0].context = { label: "Scale", text: "The venue accounted for about 1% of daily perpetual DEX volume." };
  const { warnings } = validateContent(c);
  assert.ok(!warnings.some((w) => /context is missing for a material metric/.test(w)));
});

test("Requires independently dated reference URLs", () => {
  const c = baseContent();
  c.sections[0].items[0].references = [
    { source: "Independent source", url: "https://example.com/b", date: "2026-06-22" },
  ];
  assert.equal(validateContent(c).errors.length, 0);

  c.sections[0].items[0].references[0].url = c.sections[0].items[0].url;
  c.sections[0].items[0].references[0].date = "Yesterday";
  const { errors } = validateContent(c);
  assert.ok(errors.some((e) => /duplicat/.test(e)));
  assert.ok(errors.some((e) => /date/.test(e)));
});

test("Flags multiple sources without links", () => {
  const c = baseContent();
  c.sections[0].items[0].source = "Source A / Source B";
  assert.ok(validateContent(c).warnings.some((w) => /multiple sources/.test(w)));
});

test("Requires dated and sourced thread updates", () => {
  const c = baseContent({
    threads: [{
      title: "Wallet distribution and collateral reuse",
      since: "2026-06-20",
      day_n: 4,
      tier: "A",
      status: "active",
      date: "2026-06-23",
      source: "Official announcement",
      url: "https://example.com/thread",
      update: "The wallet added stock tokens as collateral for perpetual futures.",
      watch: "Track adoption and collateral haircuts.",
    }],
  });
  assert.equal(validateContent(c).errors.length, 0);

  delete c.threads[0].date;
  delete c.threads[0].url;
  const { errors } = validateContent(c);
  assert.ok(errors.some((e) => /threads\[0\]\.date/.test(e)));
  assert.ok(errors.some((e) => /threads\[0\]\.url/.test(e)));
});

test("Limits optional thread snapshots", () => {
  assert.ok(validateContent(baseContent({ threads: [] })).errors.some((e) => /omit the entire/.test(e)));
  const item = {
    title: " Line",
    since: "2026-06-20",
    status: "active",
    date: "2026-06-23",
    source: "S",
    url: "https://example.com/thread",
    update: " New real changes.",
    watch: " Next.",
  };
  const threads = Array.from({ length: 5 }, (_, i) => ({ ...item, title: ` Line${i}`, url: `${item.url}/${i}` }));
  assert.ok(validateContent(baseContent({ threads })).errors.some((e) => /at most 4/.test(e)));
});

test("Requires exactly three AI news items", () => {
  const content = researchContent();
  content.sections = content.sections.filter((section) => section.id === "ai");
  assert.deepEqual(validateContent(content).errors, []);
  content.sections[0].items.pop();
  assert.ok(validateContent(content).errors.some((error) => /exactly 3 news/.test(error)));
  content.sections[0].items.push(...researchContent().sections.find((section) => section.id === "ai").items.slice(1));
  assert.ok(validateContent(content).errors.some((error) => /exactly 3 news/.test(error)));
  content.sections = researchContent().sections.filter((section) => section.id !== "ai");
  assert.ok(validateContent(content).errors.some((error) => /missing required AI section/.test(error)));
});

test("Restricts AI coverage by domain and item kind", () => {
  const content = researchContent();
  const ai = content.sections.find((section) => section.id === "ai").items;
  ai[0].kind = "news";
  ai[0].domain = "crypto-ai";
  assert.deepEqual(validateContent(content).errors, []);
  ai[0].kind = "research";
  assert.ok(validateContent(content).errors.some((error) => /must be news, not research/.test(error)));
  ai[0].kind = "news";
  ai[0].domain = "crypto";
  assert.ok(validateContent(content).errors.some((error) => /AI only accepts ai or crypto-ai/.test(error)));
  ai[0].domain = "ai";
  for (const domain of ["ai", "crypto-ai"]) {
    content.sections[0].items[2].domain = domain;
    assert.ok(validateContent(content).errors.some((error) => /only in the AI section/.test(error)));
  }
});

test("Validates ordered AI scores", () => {
  const content = researchContent();
  const ai = content.sections.find((section) => section.id === "ai").items;
  for (const score of [undefined, 74, 101, 75.5, "90", NaN]) {
    ai[0].importance_score = score;
    assert.ok(validateContent(content).errors.some((error) => /integer.*75–100/.test(error)));
  }
  [100, 75, 75].forEach((score, index) => { ai[index].importance_score = score; });
  assert.deepEqual(validateContent(content).errors, []);
  ai[2].importance_score = 80;
  assert.ok(validateContent(content).errors.some((error) => /descending order/.test(error)));
});

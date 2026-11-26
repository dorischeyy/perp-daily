import { test } from "node:test";
import assert from "node:assert/strict";
import { auditEditorial } from "../lib/check-editorial.mjs";
import { baseContent } from "./_helpers.mjs";
import { researchContent } from "./_research-fixture.mjs";

test("Rejects retired product sections", () => {
  const content = baseContent();
  for (const section of [
    { title: "Implications for trading products", kicker: "Product opportunities", items: [] },
    { title: "Product opportunities", items: [] },
    { title: "Product assessment", items: [{ decision_area: "Strategic priorities" }] },
  ]) {
    content.sections = [{ id: "archived-column", ...section }];
    assert.ok(auditEditorial(content).errors.some((e) => /product assessment section was retired/.test(e)));
    assert.ok(!auditEditorial({ ...content, editorial_version: 2 }).errors.some((e) => /product assessment section was retired/.test(e)));
  }
});

test("Rejects retired second-order headings", () => {
  const content = baseContent();
  content.sections[0].items[0].body.push("**Second-order effects**:Further changes depend on collateral adoption.");
  assert.ok(auditEditorial(content).errors.some((e) => /second-order effects subheading was retired/.test(e)));
});

test("Detects repeated paragraphs", () => {
  const content = baseContent({ lead: "Venues are competing for order flow by relaxing their collateral rules." });
  content.sections[0].items[0].body = ["Venues are competing for order flow by relaxing their collateral rules."];
  assert.ok(auditEditorial(content).errors.some((e) => /duplicates/.test(e)));
});

test("Detects context repeating the body", () => {
  const content = baseContent();
  content.sections[0].items[0].body = ["Trading volume reached $10 billion, placing the venue among the largest in the sector."];
  content.sections[0].items[0].context = { label: "Scale", text: "Trading volume reached $10 billion, placing the venue among the largest in the sector." };
  assert.ok(auditEditorial(content).errors.some((e) => /context/.test(e)));
});

test("Rejects unchanged thread updates", () => {
  const content = baseContent({
    threads: [{
      title: "Collateral rules",
      since: "2026-06-01",
      date: "2026-06-23",
      source: "S",
      url: "https://example.com/thread",
      update: "No new developments have been verified since the last review.",
      watch: "Check the next collateral listing.",
    }],
  });
  assert.ok(auditEditorial(content).errors.some((e) => /unchanged status/.test(e)));
});

test("Rejects thread links already used in the edition", () => {
  const content = baseContent({
    threads: [{
      title: "Wallet distribution",
      since: "2026-06-01",
      date: "2026-06-23",
      source: "S",
      url: "https://example.com/a",
      update: "The wallet activated its trading interface.",
      watch: "Watch the next volume report.",
    }],
  });
  assert.ok(auditEditorial(content).errors.some((e) => /already appears in a news/.test(e)));
});

test("Rejects repeated research across sections", () => {
  const content = researchContent();
  const repeated = structuredClone(content.sections[0].items[0]);
  repeated.research.project = "  Example Protocol  ";
  content.sections.find((section) => section.id === "crypto").items[0] = repeated;
  assert.ok(auditEditorial(content).errors.some((error) => /research.project duplicates/.test(error)));
});

test("Distinguishes research fields from restatements", () => {
  const content = researchContent();
  delete content.editorial_version;
  const research = content.sections[0].items[0].research;
  research.implication = research.mechanism;
  assert.ok(auditEditorial(content).errors.some((error) => /implication.*duplicates/.test(error)));
  research.implication = "Retention after incentives expire will determine whether the distribution model can last.";
  content.sections[0].items[0].body = `${research.mechanism} Additional public information needs to be verified.`;
  assert.ok(auditEditorial(content).errors.some((error) => /mechanism.*restates the research summary/.test(error)));
});

test("Allows shared evidence gaps", () => {
  const content = researchContent();
  delete content.editorial_version;
  content.sections[0].items[0].research.unknowns = "Unknown";
  content.sections[0].items[1].research.unknowns = "Unknown";
  assert.deepEqual(auditEditorial(content).errors, []);
  content.sections[0].items[1].research.product = content.sections[0].items[0].research.product;
  assert.ok(auditEditorial(content).errors.some((error) => /research.product.*duplicates/.test(error)));
});

test("Excludes hidden notes from v2 duplicate checks", () => {
  const content = researchContent();
  const item = content.sections[0].items[0];
  item.body = item.research.mechanism;
  item.research.implication = item.research.mechanism;
  item.research.discussions = [{ summary: item.body }];
  assert.deepEqual(auditEditorial(content).errors, []);
});

test("Detects duplicate visible paragraphs", () => {
  const content = researchContent();
  content.sections[0].items[1].body = content.sections[0].items[0].body;
  assert.ok(auditEditorial(content).errors.some((error) => /body.*duplicates/.test(error)));
});

test("Rejects generic introductions", () => {
  for (const phrase of ["It is worth noting", "We will discuss", "In this edition we explore", "The main takeaway is", "Let us examine"]) {
    for (const location of ["lead", "title", "headline", "body"]) {
      const content = researchContent();
      const value = `${phrase} how the project acquires trading users.`;
      if (location === "lead") content.lead = value;
      else if (location === "title") content.sections[0].title = value;
      else content.sections[0].items[0][location] = value;
      assert.ok(auditEditorial(content).errors.some((error) => /introductory phrase/.test(error)), `${location}: ${phrase}`);
    }
  }
});

test("Accepts direct findings and attributed source names", () => {
  const content = researchContent();
  content.lead = "A trading frontend uses an existing order book and offers onboarding in local languages. It has not published retention data.";
  content.sections[0].items[0].headline = "As of June 23, Example Protocol uses an external matching service";
  content.sections[0].items[0].research.implication = "It is worth noting that long-term retention remains an internal research question.";
  content.sections[0].items[0].source = "It is worth noting: The original source title";
  assert.deepEqual(auditEditorial(content).errors, []);
});

test("Keeps legacy editorial wording readable", () => {
  const content = baseContent({ lead: "We will discuss how Example Protocol acquires traders through its mobile wallet." });
  assert.deepEqual(auditEditorial(content).errors, []);
});

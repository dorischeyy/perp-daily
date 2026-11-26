import { test } from "node:test";
import assert from "node:assert/strict";
import { run, tmpJson, baseContent } from "./_helpers.mjs";
import { researchContent } from "./_research-fixture.mjs";

const TODAY = "2026-06-23";
const cf = (content) => run(["lib/check-freshness.mjs", tmpJson(content), TODAY]);

test("Checks the edition date", () => {
  const content = researchContent({ date: "2026-06-22" });
  content.sections = content.sections.filter((section) => section.id === "ai");
  const result = cf(content);
  assert.equal(result.code, 1);
  assert.match(result.out, /report date 2026-06-22 differs from 2026-06-23/);

  const future = baseContent({ date: "2026-06-24" });
  assert.equal(cf(future).code, 1);
});

test("Accepts an explicitly dated historical edition", () => {
  const content = researchContent({ date: "2026-06-22" });
  content.sections = content.sections.filter((section) => section.id === "ai");
  assert.equal(run(["lib/check-freshness.mjs", tmpJson(content), "2026-06-22"]).code, 0);
  assert.equal(run(["lib/check-freshness.mjs", tmpJson(baseContent()), TODAY]).code, 0);
});

test("Accepts news up to three days old", () => {
  const c = baseContent();
  c.sections[0].items[0].date = "2026-06-21"; // 2 days before the edition
  assert.equal(cf(c).code, 0);
});

test("Rejects ordinary news older than three days", () => {
  const c = baseContent();
  c.sections[0].items[0].date = "2026-06-15"; // 8 days before the edition
  assert.equal(cf(c).code, 1);
});

test("Accepts a weekly theme within seven days", () => {
  const c = baseContent();
  c.sections[0].items[0].headline = "Weekly trend | Trading volume";
  c.sections[0].items[0].date = "2026-06-18"; // 5 days before the edition
  assert.equal(cf(c).code, 0);
});

test("Rejects a weekly theme older than seven days", () => {
  const c = baseContent();
  c.sections[0].items[0].headline = "Weekly trend | Previous market update";
  c.sections[0].items[0].date = "2026-06-10"; // 13 days before the edition
  assert.equal(cf(c).code, 1);
});

test("Checks embedded source dates", () => {
  const c = baseContent();
  c.sections[0].items[0].url = "https://x.com/blog/2026/01/29/post";
  c.sections[0].items[0].date = "2026-06-23";
  assert.equal(cf(c).code, 1);
});

test("Applies freshness rules to legacy columns", () => {
  const c = baseContent();
  c.sections = [
    { id: "legacy-product-view", title: "Product assessment", items: [
      { headline: "Archived analysis", body: ["x"], url: "https://x.com/p", date: "2026-05-01" },
    ] },
  ];
  assert.equal(cf(c).code, 1);
});

test("Checks the date of each reference", () => {
  const c = baseContent();
  c.sections[0].items[0].references = [
    { source: "Background", url: "https://example.com/2026/06/01/context", date: "2026-06-01" },
  ];
  assert.equal(cf(c).code, 0);

  c.sections[0].items[0].references[0].date = "2026-06-20";
  assert.equal(cf(c).code, 1);
});

test("Requires recent thread updates", () => {
  const c = baseContent({
    threads: [{
      title: "New developments",
      since: "2026-06-01",
      date: "2026-06-21",
      source: "S",
      url: "https://example.com/thread",
      update: "The exchange published its new fee schedule.",
      watch: "Check trading volume after the fee change.",
    }],
  });
  assert.equal(cf(c).code, 0);
  c.threads[0].date = "2026-06-18";
  assert.equal(cf(c).code, 1);
});

test("Checks embedded thread source dates", () => {
  const c = baseContent({
    threads: [{
      title: "Conflicting publication dates",
      since: "2026-06-01",
      date: "2026-06-23",
      source: "S",
      url: "https://example.com/2026/01/29/thread",
      update: "The exchange published its new fee schedule.",
      watch: "Check trading volume after the fee change.",
    }],
  });
  assert.equal(cf(c).code, 1);
});

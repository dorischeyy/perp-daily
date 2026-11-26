import { test } from "node:test";
import assert from "node:assert/strict";
import { auditReview } from "../lib/check-review.mjs";

const validReview = `# Editorial self-assessment

## A0 Reader value

1. **Why open this edition today?**: A new margin policy changes the assets traders can pledge.
2. **What is the most important finding?**: Stock tokens can now fund a perpetual futures position.
3. **Which prior assessment changed?**: We raised the priority of checking collateral reuse across markets.
4. **What decision can readers make?**: Assess liquidation risks before adding volatile assets as collateral.
5. **What evidence would overturn the conclusion?**: Lower adoption or higher liquidation losses would reverse the assessment.
6. **Which news recap was removed?**: Removed a launch notice with no change to the trading rules.

## A Editorial review
### Freshness audit
### Six reader perspectives
### Ten-dimension assessment
### Top three revisions
## A1 Metric context
## A2 Candidate scores
## A3 Story continuity
## B Excluded items
## C Changelog
`;

test("Accepts a complete review", () => {
  assert.deepEqual(auditReview(validReview).errors, []);
});

const a4 = `## A4 Project discovery and evidence
### Search coverage
We searched Trasia Scout, builder resources and mobile product pages, then checked ecosystem directories and trader accounts for projects outside the registry.
### Project classification
Trasia is a trading frontend. Hyperliquid provides matching and settlement.
### Discussion evidence
A founder interview documents the original distribution strategy. We found no independent trader account confirming adoption.
### New findings and open questions
Trasia distributes existing liquidity through a mobile app. Its market share and retention after incentives end still need verification.
`;
const a5 = `## A5 AI candidate selection
### Vendor coverage
We checked official announcements from Anthropic, OpenAI, Scale AI, xAI, Kimi, DeepSeek and Qwen against independent sources. For vendors with no new event, we recorded the date searched and any access restrictions.
### Top three and exclusions
We ranked candidates by changes in model capabilities, user access and supporting evidence. Three cleared the threshold. We excluded a social post that announced no change in access.
`;

test("Requires a project discovery audit in v2", () => {
  const content = { editorial_version: 2, sections: [{ items: [{ kind: "research", research: { project: "Trasia" } }] }] };
  assert.ok(auditReview(validReview, content).errors.some((error) => /A4/.test(error)));
  const review = validReview.replace("## B Excluded items", `${a4}${a5}## B Excluded items`);
  assert.deepEqual(auditReview(review, content).errors, []);
  assert.ok(auditReview(review.replaceAll("Trasia", "Other projects"), content).errors.some((error) => /missing research project/.test(error)));
});

test("Requires the A5 selection record between A4 and B", () => {
  const content = { editorial_version: 2 };
  const review = validReview.replace("## B Excluded items", `${a4}${a5}## B Excluded items`);
  assert.deepEqual(auditReview(review, content).errors, []);
  assert.ok(auditReview(review.replace(a5, ""), content).errors.some((error) => /A5/.test(error)));
  assert.ok(auditReview(review.replace(`${a4}${a5}`, `${a5}${a4}`), content).errors.some((error) => /sections are out of order/.test(error)));
  const emptySelection = review.replace(/### Top three and exclusions\n[^\n]+/, "### Top three and exclusions\nPending.");
  assert.ok(auditReview(emptySelection, content).errors.some((error) => /A5.Top three and exclusions/.test(error)));
});

test("Requires results for all seven vendors", () => {
  const content = { editorial_version: 2 };
  const review = validReview.replace("## B Excluded items", `${a4}${a5}## B Excluded items`);
  for (const vendor of ["Anthropic", "OpenAI", "Scale AI", "xAI", "Kimi", "DeepSeek", "Qwen"]) {
    assert.ok(auditReview(review.replace(vendor, "Another vendor"), content).errors.some((error) => error.includes(`missing vendor: ${vendor}`)));
  }
  const namesOnly = review.replace(/### Vendor coverage\n[^\n]+/, "### Vendor coverage\nAnthropic / OpenAI / Scale AI / xAI / Kimi / DeepSeek / Qwen");
  assert.ok(auditReview(namesOnly, content).errors.some((error) => /beyond vendor names/.test(error)));
});

test("Requires each fixed review section", () => {
  const review = validReview.replace("## A0 Reader value", "## Start").replace("## A2 Candidate scores", "");
  const { errors } = auditReview(review);
  assert.ok(errors.some((error) => /A0 Reader value/.test(error)));
  assert.ok(errors.some((error) => /A2 Candidate scores/.test(error)));
});

test("Rejects generic and unfalsifiable answers", () => {
  const review = validReview
    .replace("A new margin policy changes the assets traders can pledge.", "Unknown.")
    .replace("Lower adoption or higher liquidation losses would reverse the assessment.", "There is more to study tomorrow.");
  const { errors } = auditReview(review);
  assert.ok(errors.some((error) => /generic answer|answer too short/.test(error)));
  assert.ok(errors.some((error) => /observable event or data threshold/.test(error)));
});

test("Requires a specific excluded recap", () => {
  const review = validReview.replace("Removed a launch notice with no change to the trading rules.", "Nothing to remove.");
  assert.ok(auditReview(review).errors.some((error) => /Removed/.test(error)));
});

test("Checks section and question order", () => {
  const review = validReview
    .replace("## A1 Metric context\n## A2 Candidate scores", "## A2 Candidate scores\n## A1 Metric context")
    .replace(
      /(1\. \*\*Why open[^\n]+)\n(2\. \*\*What is the most[^\n]+)/,
      "$2\n$1"
    );
  const { errors } = auditReview(review);
  assert.ok(errors.some((error) => /sections are out of order/.test(error)));
  assert.ok(errors.some((error) => /answers are out of order/.test(error)));
});

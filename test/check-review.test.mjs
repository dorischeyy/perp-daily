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

test("checks the same editorial evidence in a Chinese A0–A5 review", () => {
  const review = `## A0 读者价值自问
**为什么今天值得点开？**：交易平台调整了账户抵押品的折算规则，改变了可用保证金。
**最值得看的是什么？**：相同资产在两个账户模式下采用不同折扣。
**哪项原有判断被更新？**：已提高复核抵押资产折扣变化的优先级。
**看完后能做出什么更好的决定？**：风控团队可以核对各档抵押品的清算条件。
**什么证据会推翻今天的结论？**：如果交易平台撤回折扣规则，需要重新评估。
**哪条内容只是新闻复述？**：已删除未披露可用时间的合作公告。
## A 体检报告
### 时效自查
### 六视角找茬
### 十维度打分
### 今天必须改的 Top 3
## A1 数字量级检查
## A2 评分表
## A3 故事线连续性检查
## A4 项目发现与证据
### 检索覆盖
检索了交易平台的公开文档与官方公告，并按日期核对版本。
### 项目分类
钱包为交易前端，订单簿撮合和清算分别由外部服务提供。
### 讨论证据
用户讨论中提到资金跨账户划转，平台帮助中心确认了相关规则。
### 研究增量与待查
新公告披露了抵押品限额，各账户适用的折扣还需另行确认。
## A5 AI候选筛选
### 厂商覆盖
Anthropic、OpenAI、Scale AI、xAI、Kimi、DeepSeek、Qwen 的官方公告均已检查，并分别记录了可用日期与访问限制。
### 前三条与取舍
按可用范围、模型能力变化和证据质量选择前三条，排除旧功能转述。
## B 不收录清单
## C changelog`;
  assert.deepEqual(auditReview(review, { editorial_version: 2 }).errors, []);
  assert.ok(auditReview(review.replace("### 前三条与取舍", ""), { editorial_version: 2 }).errors.some(error => /A5/.test(error)));
  assert.ok(auditReview(review.replace("已删除未披露可用时间的合作公告。", "继续观察。")).errors.some(error => /generic answer/.test(error)));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { auditReview } from "../lib/check-review.mjs";

const validReview = `# 编辑自评

## A0 读者价值自问

1. **为什么今天值得点开？**：Lighter 的抵押品变化正在改写用户迁移与资金效率判断。
2. **最值得看的是什么？**：股票代币开始从交易标的转向可复用抵押品，这会改变产品边界。
3. **哪项原有判断被更新？**：从优先扩充标的数量，转向优先验证跨资产抵押的真实需求。
4. **看完后能做出什么更好的决定？**：决定先验证抵押品复用与隔离池，再投入股票永续开发资源。
5. **什么证据会推翻今天的结论？**：若新增抵押品采用率低于现有资产，或清算损失明显上升，该结论失效。
6. **哪条内容只是新闻复述？**：已删除仅罗列上线日期、没有机制变化的旧闻段落。

## A 体检报告
### 时效自查
### 六视角找茬
### 十维度打分
### 今天必须改的 Top 3
## A1 数字量级检查
## A2 评分表
## A3 故事线连续性检查
## B 不收录清单
## C changelog
`;

test("完整且具体的读者价值自评通过", () => {
  assert.deepEqual(auditReview(validReview).errors, []);
});

const a4 = `## A4 项目发现与证据
### 检索覆盖
已检索Trasia的Scout、builder和移动端，并用生态目录、交易员体验两类名单外查询补漏。
### 项目分类
Trasia是交易前端，复用Hyperliquid的撮合和结算，不能算独立永续协议。
### 讨论证据
读取创始人访谈作为历史策略依据，近期独立交易员原帖仍有访问缺口，未夸大热度。
### 研究增量与待查
新增了移动端分发与复用既有流动性的策略判断，下次需验证自有市场和激励后留存。
`;
const a5 = `## A5 AI候选筛选
### 厂商覆盖
已逐一检查 Anthropic、OpenAI、Scale AI、xAI、Kimi、DeepSeek、Qwen 的官方更新与交叉来源；未找到新事件的厂商保留检索日期和访问缺口，不以旧文补数。
### 前三条与取舍
按模型能力变化、用户覆盖与可核验证据给候选排序，选择三条超过高权重门槛的新闻，剔除仅有社交预告、没有实际开放范围的内容。
`;

test("v2必须留下具体项目发现记录，旧自评不能直接冒充研究", () => {
  const content = { editorial_version: 2, sections: [{ items: [{ kind: "research", research: { project: "Trasia" } }] }] };
  assert.ok(auditReview(validReview, content).errors.some((error) => /A4/.test(error)));
  const review = validReview.replace("## B 不收录清单", `${a4}${a5}## B 不收录清单`);
  assert.deepEqual(auditReview(review, content).errors, []);
  assert.ok(auditReview(review.replaceAll("Trasia", "其他项目"), content).errors.some((error) => /缺少研究项目/.test(error)));
});

test("v2 必须在 A4 后 B 前记录 A5 的厂商覆盖与前三条取舍", () => {
  const content = { editorial_version: 2 };
  const review = validReview.replace("## B 不收录清单", `${a4}${a5}## B 不收录清单`);
  assert.deepEqual(auditReview(review, content).errors, []);
  assert.ok(auditReview(review.replace(a5, ""), content).errors.some((error) => /A5/.test(error)));
  assert.ok(auditReview(review.replace(`${a4}${a5}`, `${a5}${a4}`), content).errors.some((error) => /段落顺序错误/.test(error)));
  const emptySelection = review.replace(/### 前三条与取舍\n[^\n]+/, "### 前三条与取舍\n暂无。");
  assert.ok(auditReview(emptySelection, content).errors.some((error) => /A5.前三条与取舍/.test(error)));
});

test("A5 必须覆盖七个标准厂商名，且不能只罗列名称", () => {
  const content = { editorial_version: 2 };
  const review = validReview.replace("## B 不收录清单", `${a4}${a5}## B 不收录清单`);
  for (const vendor of ["Anthropic", "OpenAI", "Scale AI", "xAI", "Kimi", "DeepSeek", "Qwen"]) {
    assert.ok(auditReview(review.replace(vendor, "其他厂商"), content).errors.some((error) => error.includes(`标准厂商名：${vendor}`)));
  }
  const namesOnly = review.replace(/### 厂商覆盖\n[^\n]+/, "### 厂商覆盖\nAnthropic / OpenAI / Scale AI / xAI / Kimi / DeepSeek / Qwen");
  assert.ok(auditReview(namesOnly, content).errors.some((error) => /不能只列厂商名称/.test(error)));
});

test("缺少 A0 或固定审计段落会被阻断", () => {
  const review = validReview.replace("## A0 读者价值自问", "## 开场").replace("## A2 评分表", "");
  const { errors } = auditReview(review);
  assert.ok(errors.some((error) => /A0 读者价值自问/.test(error)));
  assert.ok(errors.some((error) => /A2 评分表/.test(error)));
});

test("空泛答案和不可证伪结论会被阻断", () => {
  const review = validReview
    .replace("Lighter 的抵押品变化正在改写用户迁移与资金效率判断。", "值得关注。")
    .replace("若新增抵押品采用率低于现有资产，或清算损失明显上升，该结论失效。", "需要继续观察后续情况。");
  const { errors } = auditReview(review);
  assert.ok(errors.some((error) => /不能用空泛答案|回答过短/.test(error)));
  assert.ok(errors.some((error) => /可观察事件或数据阈值/.test(error)));
});

test("必须明确写出被删除的新闻复述", () => {
  const review = validReview.replace("已删除仅罗列上线日期、没有机制变化的旧闻段落。", "没有需要删除的内容。");
  assert.ok(auditReview(review).errors.some((error) => /已删除/.test(error)));
});

test("自评段落与六问顺序错误会被阻断", () => {
  const review = validReview
    .replace("## A1 数字量级检查\n## A2 评分表", "## A2 评分表\n## A1 数字量级检查")
    .replace(
      "1. **为什么今天值得点开？**：Lighter 的抵押品变化正在改写用户迁移与资金效率判断。\n2. **最值得看的是什么？**：股票代币开始从交易标的转向可复用抵押品，这会改变产品边界。",
      "2. **最值得看的是什么？**：股票代币开始从交易标的转向可复用抵押品，这会改变产品边界。\n1. **为什么今天值得点开？**：Lighter 的抵押品变化正在改写用户迁移与资金效率判断。"
    );
  const { errors } = auditReview(review);
  assert.ok(errors.some((error) => /段落顺序错误/.test(error)));
  assert.ok(errors.some((error) => /六问必须按固定顺序/.test(error)));
});

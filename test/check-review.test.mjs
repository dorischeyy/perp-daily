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

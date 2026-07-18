import { test } from "node:test";
import assert from "node:assert/strict";
import { auditEditorial } from "../lib/check-editorial.mjs";
import { baseContent } from "./_helpers.mjs";

const withOpportunity = () => {
  const content = baseContent({ lead: "市场扩张的速度不能超过可信定价能力。" });
  content.sections.push({
    id: "hertzflow",
    title: "机会与打法",
    items: [{
      headline: "新标的先做深度压测",
      body: [
        "**判断**：先验证，不直接上线。",
        "**机制对照**：现有隔离池只能限制风险传播。",
        "**动作与验收**：回放深度骤降场景，任一损失边界失效就不上线。",
      ],
      source: "S",
      url: "https://example.com/a",
      date: "2026-06-23",
    }],
  });
  return content;
};

test("合格的机会与打法通过", () => {
  const { errors } = auditEditorial(withOpportunity());
  assert.equal(errors.length, 0, errors.join("; "));
});

test("机会项必须是固定三段并由当期新闻触发", () => {
  const content = withOpportunity();
  content.sections.at(-1).items[0].body = ["建议持续关注。"];
  content.sections.at(-1).items[0].url = "https://example.com/unrelated";
  const { errors } = auditEditorial(content);
  assert.ok(errors.some((e) => /三段格式/.test(e)));
  assert.ok(errors.some((e) => /当期一条新闻来源/.test(e)));
});

test("机会项禁止 context 二次摘要", () => {
  const content = withOpportunity();
  content.sections.at(-1).items[0].context = { label: "口径限制", text: "这是对上面判断的再次概括，不应保留。" };
  assert.ok(auditEditorial(content).errors.some((e) => /不应设置 context/.test(e)));
});

test("完全重复段落会被阻断", () => {
  const content = baseContent({ lead: "这是足够长而且会被复制粘贴的同一句编辑判断。" });
  content.sections[0].items[0].body = ["这是足够长而且会被复制粘贴的同一句编辑判断。"];
  assert.ok(auditEditorial(content).errors.some((e) => /完全重复/.test(e)));
});

test("context 近似复述正文会被阻断", () => {
  const content = baseContent();
  content.sections[0].items[0].body = ["成交量达到一百亿美元，已经属于行业头部水平。"];
  content.sections[0].items[0].context = { label: "量级参照", text: "成交量达到一百亿美元，已经属于行业头部水平。" };
  assert.ok(auditEditorial(content).errors.some((e) => /context/.test(e)));
});

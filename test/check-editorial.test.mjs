import { test } from "node:test";
import assert from "node:assert/strict";
import { auditEditorial } from "../lib/check-editorial.mjs";
import { baseContent } from "./_helpers.mjs";

const withDecision = () => {
  const content = baseContent({ lead: "市场扩张的速度不能超过可信定价能力。" });
  content.sections.push({
    id: "hertzflow",
    title: "产品判断",
    items: [{
      decision_area: "流动性",
      headline: "统一保证金判断从照搬转为先验证",
      body: [
        "**判断变化**：从把统一保证金视为直接升级，转为先验证风险隔离。",
        "**证据与边界**：共享保证金可以提高资金效率，但风险会跨市场传播。",
        "**对 HertzFlow**：适合借鉴资金效率展示，不适合照搬统一清算。",
      ],
      source: "S",
      url: "https://example.com/a",
      date: "2026-06-23",
    }],
  });
  return content;
};

test("合格的产品判断通过", () => {
  const { errors } = auditEditorial(withDecision());
  assert.equal(errors.length, 0, errors.join("; "));
});

test("产品判断必须是固定三段并由当期新闻触发", () => {
  const content = withDecision();
  content.sections.at(-1).items[0].body = ["建议持续关注。"];
  content.sections.at(-1).items[0].url = "https://example.com/unrelated";
  const { errors } = auditEditorial(content);
  assert.ok(errors.some((e) => /判断变化 \/ 证据与边界 \/ 对 HertzFlow/.test(e)));
  assert.ok(errors.some((e) => /当期一条新闻来源/.test(e)));
});

test("产品判断禁止 context 二次摘要", () => {
  const content = withDecision();
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

test("今日进展不能用无变化状态占位", () => {
  const content = baseContent({
    threads: [{
      title: "旧故事",
      since: "2026-06-01",
      date: "2026-06-23",
      source: "S",
      url: "https://example.com/thread",
      update: "本次复盘仍无新的变化，继续关注。",
      watch: "等待下一节点。",
    }],
  });
  assert.ok(auditEditorial(content).errors.some((e) => /只允许可核验的新 delta/.test(e)));
});

test("今日进展与正文使用同一来源会被阻断", () => {
  const content = baseContent({
    threads: [{
      title: "正文已有的故事",
      since: "2026-06-01",
      date: "2026-06-23",
      source: "S",
      url: "https://example.com/a",
      update: "出现新的可核验变化。",
      watch: "观察采用。",
    }],
  });
  assert.ok(auditEditorial(content).errors.some((e) => /新闻正文承载/.test(e)));
});

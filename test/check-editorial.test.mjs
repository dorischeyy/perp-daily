import { test } from "node:test";
import assert from "node:assert/strict";
import { auditEditorial } from "../lib/check-editorial.mjs";
import { baseContent } from "./_helpers.mjs";

test("已取消的产品判断栏会被阻断", () => {
  const content = baseContent();
  content.sections.push({ id: "hertzflow", title: "产品判断", items: [] });
  assert.ok(auditEditorial(content).errors.some((e) => /产品判断栏已取消/.test(e)));
});

test("已取消的二阶效应段会被阻断", () => {
  const content = baseContent();
  content.sections[0].items[0].body.push("**二阶效应**：这段不应再出现。");
  assert.ok(auditEditorial(content).errors.some((e) => /二阶效应段已取消/.test(e)));
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

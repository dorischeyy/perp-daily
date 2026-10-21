import { test } from "node:test";
import assert from "node:assert/strict";
import { auditEditorial } from "../lib/check-editorial.mjs";
import { baseContent } from "./_helpers.mjs";
import { researchContent } from "./_research-fixture.mjs";

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

test("同一期跨栏目也不能重复研究同一个项目", () => {
  const content = researchContent();
  const repeated = structuredClone(content.sections[0].items[0]);
  repeated.research.project = "  示例协议  ";
  content.sections.find((section) => section.id === "crypto").items[0] = repeated;
  assert.ok(auditEditorial(content).errors.some((error) => /重复研究同一项目/.test(error)));
});

test("研究字段不能完全重复或复述摘要中的一句话", () => {
  const content = researchContent();
  delete content.editorial_version;
  const research = content.sections[0].items[0].research;
  research.implication = research.mechanism;
  assert.ok(auditEditorial(content).errors.some((error) => /implication.*完全重复/.test(error)));
  research.implication = "补充观察应独立说明采用条件而非再次描述机制。";
  content.sections[0].items[0].body = `${research.mechanism}另有公开信息需要核实。`;
  assert.ok(auditEditorial(content).errors.some((error) => /mechanism.*近似复述 body/.test(error)));
});

test("不同研究可以共用核验缺口，短未知标记不会触发重复审计", () => {
  const content = researchContent();
  delete content.editorial_version;
  content.sections[0].items[0].research.unknowns = "未知";
  content.sections[0].items[1].research.unknowns = "未知";
  assert.deepEqual(auditEditorial(content).errors, []);
  content.sections[0].items[1].research.product = content.sections[0].items[0].research.product;
  assert.ok(auditEditorial(content).errors.some((error) => /research.product.*完全重复/.test(error)));
});

test("v2正文可以提炼内部研究底稿，未展示字段不参与页面重复检查", () => {
  const content = researchContent();
  const item = content.sections[0].items[0];
  item.body = item.research.mechanism;
  item.research.implication = item.research.mechanism;
  item.research.discussions = [{ summary: item.body }];
  assert.deepEqual(auditEditorial(content).errors, []);
});

test("v2仍阻断实际展示正文之间的重复", () => {
  const content = researchContent();
  content.sections[0].items[1].body = content.sections[0].items[0].body;
  assert.ok(auditEditorial(content).errors.some((error) => /body.*完全重复/.test(error)));
});

test("v2公开文字阻断引言式套话，要求直接给出结果", () => {
  for (const phrase of [
    "更值得研究的是", "值得进一步研究的是", "更值得关注的是", "更有参考价值的是",
    "这期先看", "这一期先看", "本期先看", "今天先看", "今天重点看",
    "本文将", "让我们来看看", "接下来我们来看", "更值得**研究**的是",
  ]) {
    for (const location of ["lead", "title", "headline", "body"]) {
      const content = researchContent();
      const value = `${phrase}项目如何获得交易用户。`;
      if (location === "lead") content.lead = value;
      else if (location === "title") content.sections[0].title = value;
      else content.sections[0].items[0][location] = value;
      assert.ok(auditEditorial(content).errors.some((error) => /引言式套话/.test(error)), `${location}: ${phrase}`);
    }
  }
});

test("v2允许直接结论和研究标题，不误扫底稿与引用来源", () => {
  const content = researchContent();
  content.lead = "该交易前端复用已有撮合系统，把产品重心放在手机开户和本地化服务；用户留存效果尚无公开数据。";
  content.sections[0].items[0].headline = "截至6月23日研究：示例协议复用外部撮合服务";
  content.sections[0].items[0].research.implication = "更值得研究的是其后续留存，但这只是内部研究问题。";
  content.sections[0].items[0].source = "值得关注的是：来源原文标题";
  assert.deepEqual(auditEditorial(content).errors, []);
});

test("旧版存档不因新增措辞规则被阻断", () => {
  const content = baseContent({ lead: "这期先看示例协议如何获取用户，再解释各类交易体验。" });
  assert.deepEqual(auditEditorial(content).errors, []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContent } from "../lib/validate-content.mjs";
import { baseContent } from "./_helpers.mjs";

test("合法 content 无 error", () => {
  const { errors } = validateContent(baseContent());
  assert.equal(errors.length, 0, errors.join("; "));
});

test("缺 sections → error", () => {
  const c = baseContent(); delete c.sections;
  assert.ok(validateContent(c).errors.some((e) => /sections/.test(e)));
});

test("sections 为空数组 → error", () => {
  assert.ok(validateContent(baseContent({ sections: [] })).errors.length > 0);
});

test("date 格式错 → error", () => {
  assert.ok(validateContent(baseContent({ date: "2026/06/23" })).errors.some((e) => /date/.test(e)));
});

test("item 缺 url → error", () => {
  const c = baseContent(); delete c.sections[0].items[0].url;
  assert.ok(validateContent(c).errors.some((e) => /url/.test(e)));
});

test("item url 非 http(s) → error（挡 javascript: 等）", () => {
  const c = baseContent(); c.sections[0].items[0].url = "javascript:alert(1)";
  assert.ok(validateContent(c).errors.some((e) => /url/.test(e)));
});

test("item date 格式错 → error", () => {
  const c = baseContent(); c.sections[0].items[0].date = "昨天";
  assert.ok(validateContent(c).errors.some((e) => /date/.test(e)));
});

test("item body 为空 → error", () => {
  const c = baseContent(); c.sections[0].items[0].body = [];
  assert.ok(validateContent(c).errors.some((e) => /body/.test(e)));
});

test("未知栏目 id → warning 而非 error", () => {
  const c = baseContent(); c.sections[0].id = "weird";
  const { errors, warnings } = validateContent(c);
  assert.equal(errors.length, 0);
  assert.ok(warnings.some((w) => /已知栏目/.test(w)));
});

test("机会与打法栏目使用固定标题，所有栏目都禁用 kicker", () => {
  const ordinary = baseContent();
  ordinary.sections[0].kicker = "重复副标题";
  assert.ok(validateContent(ordinary).errors.some((e) => /只保留一级标题/.test(e)));

  const c = baseContent();
  const item = structuredClone(c.sections[0].items[0]);
  c.sections = [{ id: "hertzflow", title: "机会与打法", items: [item] }];
  assert.equal(validateContent(c).errors.length, 0);

  c.sections[0].title = "对 Hertzflow 的启发";
  c.sections[0].kicker = "机会与打法";
  const { errors } = validateContent(c);
  assert.ok(errors.some((e) => /title 必须固定/.test(e)));
  assert.ok(errors.some((e) => /只保留一级标题/.test(e)));
});

test("合法的数字量级说明通过校验", () => {
  const c = baseContent();
  c.sections[0].items[0].context = { label: "量级参照", text: "约为 DEX 永续日成交盘子的十分之一，属于头部梯队。" };
  const { errors } = validateContent(c);
  assert.equal(errors.length, 0, errors.join("; "));
});

test("数字量级说明的标签与长度受校验", () => {
  const c = baseContent();
  c.sections[0].items[0].context = { label: "很重要", text: "太短" };
  const { errors } = validateContent(c);
  assert.ok(errors.some((e) => /context\.label/.test(e)));
  assert.ok(errors.some((e) => /context\.text/.test(e)));
});

test("可能影响判断的数字没有解释时给提醒", () => {
  const c = baseContent();
  c.sections[0].items[0].body = "24h 交易量达到 $1.2B。";
  const { warnings } = validateContent(c);
  assert.ok(warnings.some((w) => /量级说明/.test(w)));
});

test("有量级说明的数字不再给遗漏提醒", () => {
  const c = baseContent();
  c.sections[0].items[0].body = "24h 交易量达到 $1.2B。";
  c.sections[0].items[0].context = { label: "量级参照", text: "约占 DEX 永续盘子的 1%，属腰部协议的活跃水平。" };
  const { warnings } = validateContent(c);
  assert.ok(!warnings.some((w) => /量级说明/.test(w)));
});

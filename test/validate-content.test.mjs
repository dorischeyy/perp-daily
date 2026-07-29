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

test("产品判断栏目使用固定标题和 decision_area，所有栏目都禁用 kicker", () => {
  const ordinary = baseContent();
  ordinary.sections[0].kicker = "重复副标题";
  assert.ok(validateContent(ordinary).errors.some((e) => /只保留一级标题/.test(e)));

  const c = baseContent();
  const item = structuredClone(c.sections[0].items[0]);
  item.decision_area = "战略优先级";
  c.sections = [{ id: "hertzflow", title: "产品判断", items: [item] }];
  assert.equal(validateContent(c).errors.length, 0);

  c.sections[0].title = "机会与打法";
  c.sections[0].kicker = "产品判断";
  const { errors } = validateContent(c);
  assert.ok(errors.some((e) => /title 必须固定/.test(e)));
  assert.ok(errors.some((e) => /只保留一级标题/.test(e)));
});

test("lead 必须是一句话市场概括，product_view 已停用", () => {
  const missing = baseContent();
  delete missing.lead;
  assert.ok(validateContent(missing).errors.some((e) => /lead 应为/.test(e)));

  const multiple = baseContent({ lead: "第一句市场概括。第二句继续展开。" });
  assert.ok(validateContent(multiple).errors.some((e) => /只保留一句/.test(e)));

  const legacy = baseContent({ product_view: { judgment: "旧字段" } });
  assert.ok(validateContent(legacy).errors.some((e) => /product_view 已停用/.test(e)));
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

test("补充来源 references 必须有独立链接与真实日期", () => {
  const c = baseContent();
  c.sections[0].items[0].references = [
    { source: "补充来源", url: "https://example.com/b", date: "2026-06-22" },
  ];
  assert.equal(validateContent(c).errors.length, 0);

  c.sections[0].items[0].references[0].url = c.sections[0].items[0].url;
  c.sections[0].items[0].references[0].date = "昨天";
  const { errors } = validateContent(c);
  assert.ok(errors.some((e) => /重复/.test(e)));
  assert.ok(errors.some((e) => /date/.test(e)));
});

test("source 写多个来源却没有 references 时提醒", () => {
  const c = baseContent();
  c.sections[0].items[0].source = "来源 A / 来源 B";
  assert.ok(validateContent(c).warnings.some((w) => /多个来源/.test(w)));
});

test("今日进展必须有日期来源链接和新 delta", () => {
  const c = baseContent({
    threads: [{
      title: "钱包分发进入保证金复用",
      since: "2026-06-20",
      day_n: 4,
      tier: "A",
      status: "active",
      date: "2026-06-23",
      source: "官方公告",
      url: "https://example.com/thread",
      update: "钱包新增股票代币作为永续保证金。",
      watch: "观察真实采用与抵押折扣。",
    }],
  });
  assert.equal(validateContent(c).errors.length, 0);

  delete c.threads[0].date;
  delete c.threads[0].url;
  const { errors } = validateContent(c);
  assert.ok(errors.some((e) => /threads\[0\]\.date/.test(e)));
  assert.ok(errors.some((e) => /threads\[0\]\.url/.test(e)));
});

test("今日进展为空或超过四条会被阻断", () => {
  assert.ok(validateContent(baseContent({ threads: [] })).errors.some((e) => /整个省略/.test(e)));
  const item = {
    title: "线",
    since: "2026-06-20",
    status: "active",
    date: "2026-06-23",
    source: "S",
    url: "https://example.com/thread",
    update: "出现新的真实变化。",
    watch: "下一步。",
  };
  const threads = Array.from({ length: 5 }, (_, i) => ({ ...item, title: `线${i}`, url: `${item.url}/${i}` }));
  assert.ok(validateContent(baseContent({ threads })).errors.some((e) => /最多 4 条/.test(e)));
});

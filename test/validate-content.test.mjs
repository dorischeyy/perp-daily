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

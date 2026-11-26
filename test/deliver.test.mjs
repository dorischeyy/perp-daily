import { test } from "node:test";
import assert from "node:assert/strict";
import { ADAPTERS, isDeliverySuccess } from "../lib/deliver.mjs";

test("Accepts Slack's success response", () => {
  assert.equal(isDeliverySuccess(200, "ok"), true);
});

test("Accepts Feishu response code zero", () => {
  assert.equal(isDeliverySuccess(200, '{"code":0,"msg":"success"}'), true);
});

test("Rejects nonzero Feishu application codes", () => {
  assert.equal(isDeliverySuccess(200, '{"code":9499,"msg":"bad"}'), false);
});

test("Accepts legacy Feishu success responses", () => {
  assert.equal(isDeliverySuccess(200, '{"StatusCode":0}'), true);
});

test("Accepts empty success responses", () => {
  assert.equal(isDeliverySuccess(200, ""), true);
});

test("Rejects HTTP 500", () => {
  assert.equal(isDeliverySuccess(500, "err"), false);
});

test("Rejects HTTP 404 even with an empty body", () => {
  assert.equal(isDeliverySuccess(404, ""), false);
});

test("Rejects connection failures", () => {
  assert.equal(isDeliverySuccess(0, ""), false);
});

test("uses the edition language on both channel buttons", () => {
  for (const [title, label] of [["Perp DEX 日报 · 2026-11-27", "阅读日报"], ["Perp DEX Daily · 2026-11-26", "Read the edition"]]) {
    const message = { title, url: "https://example.com/edition", summary: "Summary" };
    const feishu = ADAPTERS.feishu(message).card.elements.at(-1).actions[0];
    const slack = ADAPTERS.slack(message).blocks.at(-1).elements[0];
    assert.equal(feishu.text.content, label);
    assert.equal(slack.text.text, label);
    assert.equal(feishu.url, message.url);
    assert.equal(slack.url, message.url);
  }
});

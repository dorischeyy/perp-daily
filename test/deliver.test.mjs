import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeliverySuccess } from "../lib/deliver.mjs";

test("Slack 200 + 'ok' → 成功", () => {
  assert.equal(isDeliverySuccess(200, "ok"), true);
});

test("飞书 200 + {code:0} → 成功", () => {
  assert.equal(isDeliverySuccess(200, '{"code":0,"msg":"success"}'), true);
});

test("飞书 200 + {code:9499} → 失败（旧逻辑会误判为成功）", () => {
  assert.equal(isDeliverySuccess(200, '{"code":9499,"msg":"bad"}'), false);
});

test("飞书 200 + {StatusCode:0} → 成功（旧格式）", () => {
  assert.equal(isDeliverySuccess(200, '{"StatusCode":0}'), true);
});

test("200 + 空 body → 成功", () => {
  assert.equal(isDeliverySuccess(200, ""), true);
});

test("HTTP 500 → 失败", () => {
  assert.equal(isDeliverySuccess(500, "err"), false);
});

test("HTTP 404 + 空 body → 失败", () => {
  assert.equal(isDeliverySuccess(404, ""), false);
});

test("HTTP 0（连不上）→ 失败", () => {
  assert.equal(isDeliverySuccess(0, ""), false);
});

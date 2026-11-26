import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeliverySuccess } from "../lib/deliver.mjs";

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

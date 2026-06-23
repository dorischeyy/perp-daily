import { test } from "node:test";
import assert from "node:assert/strict";
import { latestFeedDate, classifyFeed } from "../lib/check-feeds.mjs";

const NOW = new Date("2026-06-23T00:00:00Z");

test("latestFeedDate 解析 RSS pubDate", () => {
  const xml = `<rss><channel><item><pubDate>Mon, 22 Jun 2026 07:34:05 +0000</pubDate></item></channel></rss>`;
  assert.equal(latestFeedDate(xml).toISOString().slice(0, 10), "2026-06-22");
});

test("latestFeedDate 解析 Atom updated", () => {
  const xml = `<feed><entry><updated>2026-06-21T10:00:00Z</updated></entry></feed>`;
  assert.equal(latestFeedDate(xml).toISOString().slice(0, 10), "2026-06-21");
});

test("latestFeedDate 多条取最大", () => {
  const xml = `<rss><item><pubDate>Sat, 20 Jun 2026 00:00:00 +0000</pubDate></item><item><pubDate>Mon, 22 Jun 2026 00:00:00 +0000</pubDate></item></rss>`;
  assert.equal(latestFeedDate(xml).toISOString().slice(0, 10), "2026-06-22");
});

test("latestFeedDate 无日期 → null", () => {
  assert.equal(latestFeedDate("<rss><item><title>x</title></item></rss>"), null);
});

test("classifyFeed 新鲜 → ok", () => {
  const xml = `<rss><item><pubDate>Mon, 22 Jun 2026 00:00:00 +0000</pubDate></item></rss>`;
  assert.equal(classifyFeed({ status: 200, xml, now: NOW }).state, "ok");
});

test("classifyFeed 陈旧 → stale", () => {
  const xml = `<rss><item><pubDate>Sat, 01 Jan 2026 00:00:00 +0000</pubDate></item></rss>`;
  assert.equal(classifyFeed({ status: 200, xml, now: NOW }).state, "stale");
});

test("classifyFeed HTTP 404 → unreachable", () => {
  assert.equal(classifyFeed({ status: 404, xml: "", now: NOW }).state, "unreachable");
});

test("classifyFeed 非 feed(HTML) → not-feed", () => {
  assert.equal(classifyFeed({ status: 200, xml: "<!DOCTYPE html><html></html>", now: NOW }).state, "not-feed");
});

test("classifyFeed feed 但无日期 → no-date", () => {
  assert.equal(classifyFeed({ status: 200, xml: "<rss><item><title>x</title></item></rss>", now: NOW }).state, "no-date");
});

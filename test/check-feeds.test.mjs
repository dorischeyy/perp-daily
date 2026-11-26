import { test } from "node:test";
import assert from "node:assert/strict";
import { latestFeedDate, classifyFeed } from "../lib/check-feeds.mjs";

const NOW = new Date("2026-06-23T00:00:00Z");

test("Parses RSS publication dates", () => {
  const xml = `<rss><channel><item><pubDate>Mon, 22 Jun 2026 07:34:05 +0000</pubDate></item></channel></rss>`;
  assert.equal(latestFeedDate(xml).toISOString().slice(0, 10), "2026-06-22");
});

test("Parses Atom update dates", () => {
  const xml = `<feed><entry><updated>2026-06-21T10:00:00Z</updated></entry></feed>`;
  assert.equal(latestFeedDate(xml).toISOString().slice(0, 10), "2026-06-21");
});

test("Uses the most recent entry", () => {
  const xml = `<rss><item><pubDate>Sat, 20 Jun 2026 00:00:00 +0000</pubDate></item><item><pubDate>Mon, 22 Jun 2026 00:00:00 +0000</pubDate></item></rss>`;
  assert.equal(latestFeedDate(xml).toISOString().slice(0, 10), "2026-06-22");
});

test("Returns null for an undated feed", () => {
  assert.equal(latestFeedDate("<rss><item><title>x</title></item></rss>"), null);
});

test("Recognizes current feeds", () => {
  const xml = `<rss><item><pubDate>Mon, 22 Jun 2026 00:00:00 +0000</pubDate></item></rss>`;
  assert.equal(classifyFeed({ status: 200, xml, now: NOW }).state, "ok");
});

test("Recognizes stale feeds", () => {
  const xml = `<rss><item><pubDate>Sat, 01 Jan 2026 00:00:00 +0000</pubDate></item></rss>`;
  assert.equal(classifyFeed({ status: 200, xml, now: NOW }).state, "stale");
});

test("Flags a 404 response", () => {
  assert.equal(classifyFeed({ status: 404, xml: "", now: NOW }).state, "unreachable");
});

test("Rejects HTML as a feed", () => {
  assert.equal(classifyFeed({ status: 200, xml: "<!DOCTYPE html><html></html>", now: NOW }).state, "not-feed");
});

test("Distinguishes an undated feed", () => {
  assert.equal(classifyFeed({ status: 200, xml: "<rss><item><title>x</title></item></rss>", now: NOW }).state, "no-date");
});

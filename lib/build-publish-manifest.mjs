#!/usr/bin/env node
// Record byte lengths and Git object IDs for the five files in a daily release.
// Usage: node lib/build-publish-manifest.mjs YYYY-MM-DD [repo-root]

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const date = process.argv[2];
const root = resolve(process.argv[3] || ".");

function fail(message) {
  console.error(`Invalid publication manifest: ${message}`);
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
  fail("Provide an edition date in YYYY-MM-DD format.");
}

const paths = [
  `docs/archive/${date}-review.md`,
  `docs/archive/${date}.html`,
  "docs/index.html",
  "docs/latest.json",
  "threads.json",
];

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return createHash("sha1").update(header).update(buffer).digest("hex");
}

function load(path) {
  const absolute = resolve(root, path);
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    fail(`Missing file: ${path}`);
  }
  if (!stat.isFile()) fail(`Expected a regular file at ${path}`);
  const buffer = readFileSync(absolute);
  if (buffer.length === 0) fail(`Empty file: ${path}`);
  if (/\p{Script=Han}/u.test(buffer.toString("utf8"))) {
    fail(`Translate the remaining Chinese text in ${path} before publication.`);
  }
  return { path, buffer };
}

const loaded = paths.map(load);
const byPath = new Map(loaded.map((entry) => [entry.path, entry.buffer]));
const archive = byPath.get(`docs/archive/${date}.html`);
const index = byPath.get("docs/index.html");

if (!archive.equals(index)) {
  fail("docs/index.html differs from the dated archive");
}

let latest;
let threads;
try {
  latest = JSON.parse(byPath.get("docs/latest.json").toString("utf8"));
} catch {
  fail("docs/latest.json contains invalid JSON");
}
try {
  threads = JSON.parse(byPath.get("threads.json").toString("utf8"));
} catch {
  fail("threads.json contains invalid JSON");
}

const expectedUrl = `https://dorischeyy.github.io/perp-daily/archive/${date}.html`;
if (latest.date !== date) fail(`docs/latest.json.date must be ${date}`);
if (latest.url !== expectedUrl) fail(`docs/latest.json.url must be ${expectedUrl}`);
if (!Array.isArray(threads.threads)) fail("threads.json is missing the threads array");
if (archive.length < 500) fail("The dated archive is unexpectedly short");
if (byPath.get(`docs/archive/${date}-review.md`).length < 200) fail("The editorial review is unexpectedly short");
if (byPath.get("threads.json").length < 1000) fail("threads.json is unexpectedly short and may have been truncated");

const files = loaded.map(({ path, buffer }) => ({
  path,
  bytes: buffer.length,
  base64_chars: Math.ceil(buffer.length / 3) * 4,
  blob_sha: gitBlobSha(buffer),
}));

const manifest = {
  date,
  commit_message: `report: ${date}`,
  file_count: files.length,
  total_bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  files,
};

console.log(JSON.stringify(manifest, null, 2));

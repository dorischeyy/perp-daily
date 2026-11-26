import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./_helpers.mjs";

const DATE = "2026-07-30";

function fixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "perp-publish-manifest-"));
  mkdirSync(join(root, "docs", "archive"), { recursive: true });
  const html = overrides.html ?? `<!doctype html>${"edition".repeat(300)}`;
  const index = overrides.index ?? html;
  const review = overrides.review ?? `# Editorial review\n${"check ".repeat(120)}`;
  const latest = overrides.latest ?? {
    date: DATE,
    url: `https://dorischeyy.github.io/perp-daily/archive/${DATE}.html`,
    title: `Perp DEX Daily · ${DATE}`,
    lead: "Sample edition lead",
  };
  const threads = overrides.threads ?? { threads: [], padding: "x".repeat(1200) };
  writeFileSync(join(root, "docs", "archive", `${DATE}.html`), html);
  writeFileSync(join(root, "docs", "archive", `${DATE}-review.md`), review);
  writeFileSync(join(root, "docs", "index.html"), index);
  writeFileSync(join(root, "docs", "latest.json"), JSON.stringify(latest));
  writeFileSync(join(root, "threads.json"), JSON.stringify(threads));
  return root;
}

test("lists the five release files with byte lengths and Git blob SHAs", () => {
  const result = run(["lib/build-publish-manifest.mjs", DATE, fixture()]);
  assert.equal(result.code, 0);
  const manifest = JSON.parse(result.out);
  assert.equal(manifest.file_count, 5);
  assert.equal(manifest.commit_message, `report: ${DATE}`);
  assert.deepEqual(
    manifest.files.map((file) => file.path),
    [
      `docs/archive/${DATE}-review.md`,
      `docs/archive/${DATE}.html`,
      "docs/index.html",
      "docs/latest.json",
      "threads.json",
    ],
  );
  for (const file of manifest.files) {
    assert.ok(file.bytes > 0);
    assert.match(file.blob_sha, /^[0-9a-f]{40}$/);
    assert.equal(file.base64_chars, Math.ceil(file.bytes / 3) * 4);
  }
});

test("rejects a homepage that differs from the dated archive", () => {
  const result = run(["lib/build-publish-manifest.mjs", DATE, fixture({ index: "different homepage" })]);
  assert.equal(result.code, 1);
  assert.match(result.out, /index\.html.*differs from the dated archive/);
});

test("rejects an edition date that differs from the latest index", () => {
  const result = run([
    "lib/build-publish-manifest.mjs",
    DATE,
    fixture({ latest: { date: "2026-07-29", url: "https://example.com", title: "x", lead: "x" } }),
  ]);
  assert.equal(result.code, 1);
  assert.match(result.out, /latest\.json\.date/);
});

test("rejects a truncated story ledger", () => {
  const result = run(["lib/build-publish-manifest.mjs", DATE, fixture({ threads: { threads: [] } })]);
  assert.equal(result.code, 1);
  assert.match(result.out, /threads\.json is unexpectedly short/);
});

test("includes the UTF-8 bytes of a Chinese editorial review in the manifest", () => {
  const review = `# 编辑自评\n${"已核实原始来源和事件日期。".repeat(30)}`;
  const result = run(["lib/build-publish-manifest.mjs", DATE, fixture({ review })]);
  assert.equal(result.code, 0);
  const entry = JSON.parse(result.out).files.find(file => file.path.endsWith("-review.md"));
  assert.equal(entry.bytes, Buffer.byteLength(review));
});

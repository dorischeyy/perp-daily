#!/usr/bin/env node

// Validate report structure, dates, sources and edition-specific editorial rules.
// Usage: node lib/validate-content.mjs [content.json]

import { readFileSync } from "node:fs";
import { publicSectionId } from "./legacy-section.mjs";
import { wordCount, sentences, isIsoDate as isDate, isHttpUrl, validateResearchItem, validateV2Item } from "./research.mjs";

const file = process.argv[2] || "content.json";
const KNOWN_SECTIONS = new Set(["perpdex", "launchpad", "crypto", "ai"]);
const NEWS_SECTION_IDS = ["perpdex", "launchpad", "crypto", "ai"];
const NEWS_ITEM_MIN = 3;
const NEWS_ITEM_MAX = 5;
const CONTEXT_LABELS = new Set(["Scale", "Scope", "Implementation", "Measurement limits"]);

// Flag metrics that merit an editorial explanation.
const hasMaterialMetric = (item) => {
  const body = Array.isArray(item.body) ? item.body.join(" ") : String(item.body || "");
  const text = `${item.headline || ""} ${body}`;
  return /(?:[$£¥€]\s?\d[\d,.]*|\b\d[\d,.]*\s*(?:[BMK]\b|%|bps\b|million\b|billion\b|markets\b)|\b(?:TVL|OI|volume|fees|revenue|liquidations|unlocks).{0,12}\d)/i.test(text);
};

export function validateContent(data) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  if (!data || typeof data !== "object") return { errors: ["content must be an object"], warnings };
  const compact = data.editorial_version === 2;

  if (!isDate(data.date)) E(`invalid date, expected YYYY-MM-DD`);
  if (isDate(data.date) && data.date >= "2026-10-21" && data.editorial_version !== 2) {
    E(`reports dated 2026-10-21 or later require editorial_version: 2`);
  }
  if (data.edition != null && typeof data.edition !== "number") E(`edition must be numeric`);
  const leadLength = wordCount(data.lead);
  if (typeof data.lead !== "string" || leadLength < 8 || leadLength > (compact ? 55 : 85)) {
    E(compact ? "lead must contain 8–55 words" : "lead must contain 8–85 words");
  }
  if (typeof data.lead === "string") {
    const parts = sentences(data.lead);
    if (parts.length > (compact ? 2 : 1)) E(compact ? "lead must contain one or two sentences" : "lead must contain one sentence");
    if (compact && parts.some(part => wordCount(part) > 32)) E("lead sentences must contain at most 32 words");
  }
  if (data.product_view != null) E(`product_view has been retired; use the lead`);

  if (data.threads != null) {
    if (data.editorial_version === 2) E(`v2 must not include a threads snapshot`);
    if (!Array.isArray(data.threads)) E(`threads must be an array`);
    else {
      if (data.threads.length === 0) E(`omit the entire threads field when empty`);
      if (data.threads.length > 4) E(`threads supports at most 4 entries`);
      const threadTitles = new Set();
      const threadUrls = new Set();
      data.threads.forEach((t, i) => {
        const tag = `threads[${i}]`;
        if (!t || typeof t !== "object") return E(`${tag} must be an object`);
        if (!t.title || typeof t.title !== "string") E(`${tag}.title is missing`);
        else if (threadTitles.has(t.title)) E(`${tag}.title duplicates another thread`);
        else threadTitles.add(t.title);
        if (!isDate(t.since)) E(`${tag}.since is not a valid date`);
        if (!isDate(t.date)) E(`${tag}.date is invalid`);
        if (!t.source || typeof t.source !== "string") E(`${tag}.source is missing`);
        if (!isHttpUrl(t.url)) E(`${tag}.url must be an HTTP(S) URL`);
        else if (threadUrls.has(t.url)) E(`${tag}.url duplicates another thread`);
        else threadUrls.add(t.url);
        if (!t.update || typeof t.update !== "string") E(`${tag}.update is missing`);
        if (!t.watch || typeof t.watch !== "string") E(`${tag}.watch is missing`);
        if (t.status != null && t.status !== "active") E(`${tag}.status must be active`);
      });
    }
  }

  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    E(`sections must be a nonempty array`);
    return { errors, warnings };
  }
  const seenIds = new Set();
  data.sections.forEach((s, i) => {
    const tag = `sections[${i}]${s && s.id ? `(${s.id})` : ""}`;
    if (!s || typeof s !== "object") return E(`${tag} must be an object`);
    if (!s.id || typeof s.id !== "string") E(`${tag} is missing id`);
    else {
      if (seenIds.has(s.id)) E(`${tag} duplicate id`);
      seenIds.add(s.id);
      if (compact && !/^[a-z][a-z0-9-]{0,63}$/.test(s.id)) E(`${tag} id must be a lowercase slug of up to 64 characters`);
      if (!compact && publicSectionId(s, data.editorial_version) === "legacy-product-view") E(`${tag} the product assessment section was retired`);
      else if (!compact && !KNOWN_SECTIONS.has(s.id)) W(`${tag} unknown section; placed last in legacy editions`);
    }
    if (!s.title || typeof s.title !== "string" || !s.title.trim()) E(`${tag} missing title`);
    if (typeof s.kicker === "string" && s.kicker.trim()) E(`${tag} should contain one section heading; omit kicker`);
    if (!Array.isArray(s.items)) return E(`${tag}.items must be an array`);
    if (compact && s.items.length === 0) E(`${tag}.items must not be empty`);
    if (compact && s.id === "ai" && s.items.length !== 3) {
      E(`${tag} AI must contain exactly 3 news items`);
    }
    if (!compact && s.items.length === 0 && !NEWS_SECTION_IDS.includes(s.id)) W(`${tag} omit empty optional sections`);
    if (!compact && NEWS_SECTION_IDS.includes(s.id) && (s.items.length < NEWS_ITEM_MIN || s.items.length > NEWS_ITEM_MAX)) {
      E(`${tag} needs ${NEWS_ITEM_MIN}–${NEWS_ITEM_MAX} news items`);
    }

    s.items.forEach((it, j) => {
      const itag = `${tag}.items[${j}]`;
      if (!it || typeof it !== "object") return E(`${itag} must be an object`);
      if (it.kind !== undefined && it.kind !== "news" && it.kind !== "research") E(`${itag}.kind must be news or research`);
      const research = it.kind === "research";
      if (compact) errors.push(...validateV2Item(it, data.date, itag));
      if (compact && s.id === "ai") {
        if (!["ai", "crypto-ai"].includes(it.domain)) E(`${itag}.domain AI only accepts ai or crypto-ai`);
        if (it.kind !== undefined && it.kind !== "news") E(`${itag}.kind must be news, not research`);
        if (!Number.isInteger(it.importance_score) || it.importance_score < 75 || it.importance_score > 100) {
          E(`${itag}.importance_score must be an integer in the range 75–100`);
        }
        const previousScore = s.items[j - 1]?.importance_score;
        if (j > 0 && Number.isInteger(previousScore) && Number.isInteger(it.importance_score) && it.importance_score > previousScore) {
          E(`${itag}.importance_score must be in descending order`);
        }
      } else if (compact && ["ai", "crypto-ai"].includes(it.domain)) {
        E(`${itag}.domain ai and crypto-ai belong only in the AI section`);
      }
      if (research) errors.push(...validateResearchItem(it, data.date, itag, data.editorial_version));
      if (!it.headline || typeof it.headline !== "string") E(`${itag} missing headline`);
      const bodyOk = typeof it.body === "string"
        ? it.body.trim().length > 0
        : Array.isArray(it.body) && it.body.length > 0 && it.body.every((p) => typeof p === "string");
      if (!bodyOk) E(`${itag} body must be a nonempty string or array of nonempty strings`);
      if (bodyOk) {
        const parts = Array.isArray(it.body) ? it.body : [it.body];
        if (parts.some((part) => /\*\*Second-order effects\*\*/.test(part))) E(`${itag} second-order effects subheading was retired`);
      }
      if (!isHttpUrl(it.url)) E(`${itag} url must be HTTP(S)`);
      if (!research && !isDate(it.date)) E(`${itag} invalid date`);
      if (it.source != null && typeof it.source !== "string") E(`${itag} source must be a string`);
      if (!research && it.references != null) {
        if (!Array.isArray(it.references) || it.references.length === 0 || it.references.length > 3) {
          E(`${itag} references requires 1–3 additional sources`);
        } else {
          const urls = new Set([it.url]);
          it.references.forEach((ref, k) => {
            const rtag = `${itag}.references[${k}]`;
            if (!ref || typeof ref !== "object" || Array.isArray(ref)) return E(`${rtag} must be an object`);
            if (!ref.source || typeof ref.source !== "string") E(`${rtag}.source is missing`);
            if (!isHttpUrl(ref.url)) E(`${rtag}.url must be HTTP(S)`);
            else if (urls.has(ref.url)) E(`${rtag}.url duplicates a source`);
            else urls.add(ref.url);
            if (!isDate(ref.date)) E(`${rtag}.date is invalid`);
          });
        }
      } else if (!research && typeof it.source === "string" && /\s\/\s|,/.test(it.source.normalize("NFKC"))) {
        W(`${itag} source lists multiple sources without references`);
      }
      if (!compact && it.context != null) {
        if (!it.context || typeof it.context !== "object" || Array.isArray(it.context)) {
          E(`${itag} context must be an object`);
        } else {
          if (!CONTEXT_LABELS.has(it.context.label)) {
            E(`${itag} invalid context.label`);
          }
          if (typeof it.context.text !== "string" || it.context.text.trim().length < 8 || it.context.text.trim().length > 160) {
            E(`${itag} context.text must contain 8–160 characters`);
          }
        }
      } else if (!compact && hasMaterialMetric(it)) {
        W(`${itag} context is missing for a material metric`);
      }
    });
  });
  for (const id of NEWS_SECTION_IDS) {
    if (!compact && !seenIds.has(id)) E(`missing required news section: ${id}`);
  }
  if (compact && !seenIds.has("ai")) E(`missing required AI section`);

  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`Cannot read content.json: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings } = validateContent(data);
  for (const w of warnings) console.warn(`  ⚠️ ${w}`);
  if (errors.length) {
    console.error(`Content validation failed with ${errors.length} errors:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`Content validation passed with ${warnings.length} warnings.`);
}

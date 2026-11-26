#!/usr/bin/env node

// Check that the editorial review records evidence, decisions and open questions.
// Usage: node lib/check-review.mjs [review.draft.md] [content.json]

import { readFileSync } from "node:fs";

const REQUIRED_SECTIONS = [
  "## A0 Reader value",
  "## A Editorial review",
  "### Freshness audit",
  "### Six reader perspectives",
  "### Ten-dimension assessment",
  "### Top three revisions",
  "## A1 Metric context",
  "## A2 Candidate scores",
  "## A3 Story continuity",
  "## B Excluded items",
  "## C Changelog",
];

const QUESTIONS = [
  "Why open this edition today",
  "What is the most important finding",
  "Which prior assessment changed",
  "What decision can readers make",
  "What evidence would overturn the conclusion",
  "Which news recap was removed",
];

const compact = (value) => String(value || "").replace(/\s/g, "");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function auditReview(markdown, content = {}) {
  const errors = [];
  const E = (message) => errors.push(message);
  const text = String(markdown || "");
  const sections = [...REQUIRED_SECTIONS];
  if (content.editorial_version === 2) sections.splice(sections.indexOf("## B Excluded items"), 0, "## A4 Project discovery and evidence", "## A5 AI candidate selection");

  for (const section of sections) {
    if (!text.includes(section)) E(`missing review section: ${section}`);
  }
  const sectionPositions = sections.map((section) => text.indexOf(section));
  if (sectionPositions.every((position) => position >= 0)) {
    for (let i = 1; i < sectionPositions.length; i += 1) {
      if (sectionPositions[i] <= sectionPositions[i - 1]) {
        E(`review sections are out of order`);
        break;
      }
    }
  }

  const answers = new Map();
  const answerPositions = [];
  for (const question of QUESTIONS) {
    const pattern = new RegExp(`\\*\\*${escapeRegExp(question)}\\??\\*\\*:\\s*([^\\n]+)`);
    const match = text.match(pattern);
    const answer = match?.[1]?.trim() || "";
    if (!answer) {
      E(`A0 missing answer: ${question}`);
      continue;
    }
    answerPositions.push(match.index);
    answers.set(question, answer);
    if (compact(answer).length < 12) E(`A0 answer too short: ${question}`);
    if (/^(?:none|unknown|unsure|worth watching|wait and see|same as above)\.?$/i.test(answer)) {
      E(`A0 generic answer: ${question}`);
    }
  }
  if (answerPositions.length === QUESTIONS.length) {
    for (let i = 1; i < answerPositions.length; i += 1) {
      if (answerPositions[i] <= answerPositions[i - 1]) {
        E(`A0 answers are out of order`);
        break;
      }
    }
  }

  const changed = answers.get("Which prior assessment changed") || "";
  if (changed && !/\b(?:from .+ to|shift\w*|maintain\w*|retain\w*|increase\w*|decrease\w*|add\w*|rais\w*|lower\w*|paus\w*|cancel\w*|no longer|priorit\w*|confidence|upgrad\w*|downgrad\w*|revis\w*)\b/i.test(changed)) {
    E(`A0 must describe how the prior assessment or confidence changed`);
  }

  const decision = answers.get("What decision can readers make") || "";
  if (decision && !/\b(?:priorit\w*|pause|whether|launch|delist|resources?|risk|product|trad\w*|user|assets?|liquidity|margin|liquidation|distribution|compliance|verif\w*|validat\w*|collateral)\b/i.test(decision)) {
    E(`A0 must identify a specific decision`);
  }

  const falsifier = answers.get("What evidence would overturn the conclusion") || "";
  if (falsifier && !/\b(?:emerg\w*|reach\w*|exceed\w*|below|above|fall\w*|rise\w*|increas\w*|decreas\w*|fail\w*|withdraw\w*|cancel\w*|no|data|adoption|conversion|churn|incident\w*|loss\w*|delay\w*|deviat\w*)\b/i.test(falsifier)) {
    E(`A0 must specify an observable event or data threshold`);
  }

  const deleted = answers.get("Which news recap was removed") || "";
  if (deleted && !/^Removed\b/i.test(deleted)) E(`A0 must identify the Removed news recap`);

  if (content.editorial_version === 2) {
    const start = text.indexOf("## A4 Project discovery and evidence");
    const a5Start = text.indexOf("## A5 AI candidate selection", start);
    const end = a5Start >= 0 ? a5Start : text.indexOf("## B Excluded items", start);
    const audit = start >= 0 && end > start ? text.slice(start, end) : "";
    const headings = ["Search coverage", "Project classification", "Discussion evidence", "New findings and open questions"];
    let previous = -1;
    for (const heading of headings) {
      const pos = audit.indexOf(`### ${heading}`);
      const match = audit.match(new RegExp(`### ${heading}\\s*\\n([\\s\\S]*?)(?=\\n### |$)`));
      if (pos < 0 || !match || compact(match[1]).length < 20) E(`A4.${heading} needs a substantive record`);
      if (pos >= 0 && pos <= previous) E(`A4 subsections are out of order`);
      previous = pos;
    }
    const projects = (content.sections || []).flatMap((s) => s.items || []).filter((i) => i.kind === "research").map((i) => i.research?.project).filter(Boolean);
    for (const project of projects) if (!audit.includes(project)) E(`A4 missing research project: ${project}`);

    const a5End = text.indexOf("## B Excluded items", a5Start);
    const aiAudit = a5Start >= 0 && a5End > a5Start ? text.slice(a5Start, a5End) : "";
    const aiHeadings = ["Vendor coverage", "Top three and exclusions"];
    const aiParts = new Map();
    let aiPrevious = -1;
    for (const heading of aiHeadings) {
      const pos = aiAudit.indexOf(`### ${heading}`);
      const match = aiAudit.match(new RegExp(`### ${heading}\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`));
      const body = match?.[1] || "";
      aiParts.set(heading, body);
      if (pos < 0 || compact(body).length < 20) E(`A5.${heading} needs a substantive record`);
      if (pos >= 0 && pos <= aiPrevious) E(`A5 subsections are out of order`);
      aiPrevious = pos;
    }
    const vendors = ["Anthropic", "OpenAI", "Scale AI", "xAI", "Kimi", "DeepSeek", "Qwen"];
    const coverage = aiParts.get("Vendor coverage") || "";
    for (const vendor of vendors) {
      if (!new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegExp(vendor)}(?=$|[^A-Za-z0-9])`).test(coverage)) {
        E(`A5.Vendor coverage missing vendor: ${vendor}`);
      }
    }
    const coverageDetails = vendors.reduce((body, vendor) => body.replaceAll(vendor, ""), coverage);
    if (compact(coverageDetails).replace(/[\p{P}\p{S}]/gu, "").length < 20) {
      E(`A5.Vendor coverage must describe findings beyond vendor names`);
    }
  }

  return { errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] || "review.draft.md";
  let markdown;
  let content = {};
  try {
    markdown = readFileSync(file, "utf8");
    if (process.argv[3]) content = JSON.parse(readFileSync(process.argv[3], "utf8"));
  } catch (e) {
    console.error(`Cannot read review inputs: ${e.message}`);
    process.exit(1);
  }
  const { errors } = auditReview(markdown, content);
  if (errors.length) {
    console.error(`Review failed with ${errors.length} errors:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("Editorial review passed.");
}

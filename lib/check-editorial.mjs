#!/usr/bin/env node

// Check the visible copy for repeated claims and retired sections.
// Usage: node lib/check-editorial.mjs [content.json]

import { readFileSync } from "node:fs";
import { publicSectionId } from "./legacy-section.mjs";

const normalized = (value) =>
  String(value || "")
    .replace(/\*\*/g, "")
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .toLowerCase();

const bigrams = (value) => {
  const text = normalized(value);
  const out = [];
  for (let i = 0; i < text.length - 1; i += 1) out.push(text.slice(i, i + 2));
  return out;
};

const dice = (a, b) => {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (!aa.length || !bb.length) return 0;
  const counts = new Map();
  for (const token of aa) counts.set(token, (counts.get(token) || 0) + 1);
  let overlap = 0;
  for (const token of bb) {
    const left = counts.get(token) || 0;
    if (left > 0) {
      overlap += 1;
      counts.set(token, left - 1);
    }
  }
  return (2 * overlap) / (aa.length + bb.length);
};

const bodyParts = (item) => (Array.isArray(item.body) ? item.body : [item.body]).filter(Boolean);

const introductoryPhrases = [
  /(?:更)?值得(?:进一步)?(?:研究|关注|探讨|思考|评估|核实|比较)的(?:是|在于|地方是)/,
  /可借鉴的是|(?:更)?有参考价值的是|本文将/,
  /(?:这(?:一)?期|本期|今天)(?:我们)?(?:先看|重点看|将介绍)/,
  /让我们(?:一起)?(?:来)?看看|接下来(?:我们)?(?:来看|看看)/,
  /\b(?:it is|what is) worth (?:noting|watching|researching|investigating)\b/i,
  /\b(?:in this edition(?: we)?|in this issue(?: we)?|today we|we will|let us|let's) (?:look|explore|examine|discuss|start|review)\b/i,
  /\bthe (?:key|main) takeaway is\b/i,
  /\bwhat deserves (?:further )?(?:attention|study) is\b/i,
];

export function auditEditorial(data) {
  const errors = [];
  const warnings = [];
  const E = (message) => errors.push(message);
  const W = (message) => warnings.push(message);
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const compactV2 = data?.editorial_version === 2;
  const news = sections.flatMap((section) => section.items || []);
  const newsUrls = new Set(news.map((item) => item.url).filter(Boolean));
  const threads = !compactV2 && Array.isArray(data?.threads) ? data.threads : [];
  const seen = new Map();
  const researchProjects = new Map();
  const checkConclusionFirst = (value, label) => {
    if (!compactV2) return;
    const text = String(value || "").replace(/\*\*/g, "").trim();
    const phrase = introductoryPhrases.map((pattern) => text.match(pattern)?.[0]).find(Boolean);
    if (phrase) E(`${label} contains an introductory phrase: ${phrase}`);
  };

  const register = (value, label, minimum = 14) => {
    const key = normalized(value);
    if (key.length < minimum) return;
    const previous = seen.get(key);
    if (previous) E(`${label} duplicates ${previous}`);
    else seen.set(key, label);
  };

  if (data?.lead) {
    register(data.lead, "lead");
    checkConclusionFirst(data.lead, "lead");
  }

  for (const [index, thread] of threads.entries()) {
    const tag = `threads[${index}]`;
    register(thread.title, `${tag}.title`);
    register(thread.update, `${tag}.update`);
    if (newsUrls.has(thread.url)) E(`${tag}.url already appears in a news item`);
    if (/(?:no (?:new|change|update)|unchanged|still waiting|continue (?:to )?(?:watch|monitor)|awaiting|not yet|尚未|暂无|未发现|仍无|没有新|等待|继续关注|变化尚未发生|待观察)/i.test(String(thread.update || ""))) {
      E(`${tag}.update describes an unchanged status`);
    }
  }

  for (const section of sections) {
    if (publicSectionId(section, data.editorial_version) === "legacy-product-view") E(`the product assessment section was retired`);
    checkConclusionFirst(section.title, `${section.id}.title`);
    for (const [index, item] of (section.items || []).entries()) {
      const tag = `${section.id}.items[${index}]`;
      const isResearch = item.kind === "research";
      register(item.headline, `${tag}.headline`);
      checkConclusionFirst(item.headline, `${tag}.headline`);
      for (const [p, paragraph] of bodyParts(item).entries()) {
        register(paragraph, `${tag}.body[${p}]`, isResearch ? 12 : 14);
        checkConclusionFirst(paragraph, `${tag}.body[${p}]`);
        if (/\*\*(?:Second-order effects|二阶效应)\*\*/.test(String(paragraph))) E(`${tag}.body[${p}] second-order effects subheading was retired`);
      }
      if (!compactV2 && item.context?.text) register(item.context.text, `${tag}.context`);

      if (isResearch && item.research && typeof item.research === "object") {
        const research = item.research;
        const project = normalized(research.project);
        if (project) {
          const previous = researchProjects.get(project);
          if (previous) E(`${tag}.research.project duplicates ${previous}`);
          else researchProjects.set(project, `${tag}.research.project`);
        }

        // Only legacy editions display the underlying research notes.
        if (!compactV2) {
          const summary = bodyParts(item).join("");
          const summaryKey = normalized(summary);
          for (const field of ["why_now", "mechanism", "gtm", "product", "implication", "unknowns"]) {
            const value = research[field];
            const label = `${tag}.research.${field}`;
            register(value, label, 12);
            const key = normalized(value);
            if (key.length >= 12 && summaryKey.length >= 12 &&
                (summaryKey.includes(key) || key.includes(summaryKey) || dice(value, summary) >= 0.88)) {
              E(`${label} restates the research summary`);
            }
          }
          for (const [discussionIndex, discussion] of (Array.isArray(research.discussions) ? research.discussions : []).entries()) {
            register(discussion?.summary, `${tag}.research.discussions[${discussionIndex}].summary`, 12);
          }
        }
        // Multiple projects may share the same documented access restrictions.
      }

      if (data?.lead && normalized(data.lead).length >= 16) {
        const comparison = `${item.headline || ""}${bodyParts(item)[0] || ""}`;
        if (dice(data.lead, comparison) >= 0.82) E(`lead restates the heading or first paragraph: ${tag}`);
      }
      if (!compactV2 && item.context?.text) {
        const main = `${item.headline || ""}${bodyParts(item).join("")}`;
        const context = normalized(item.context.text);
        if (context.length >= 14 && (normalized(main).includes(context) || dice(item.context.text, main) >= 0.88)) {
          E(`${tag}.context restates the heading or body`);
        }
      }
    }
  }

  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] || "content.json";
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`Cannot read the edition: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings } = auditEditorial(data);
  for (const warning of warnings) console.warn(`  ⚠️ ${warning}`);
  if (errors.length) {
    console.error(`Editorial audit failed with ${errors.length} errors:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`Editorial audit passed with ${warnings.length} warnings.`);
}

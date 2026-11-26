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

// Daily reviews use the established Chinese headings. Archived English reviews remain valid.
const chineseLabels = {
  "## A0 Reader value": "## A0 读者价值自问",
  "## A Editorial review": "## A 体检报告",
  "### Freshness audit": "### 时效自查",
  "### Six reader perspectives": "### 六视角找茬",
  "### Ten-dimension assessment": "### 十维度打分",
  "### Top three revisions": "### 今天必须改的 Top 3",
  "## A1 Metric context": "## A1 数字量级检查",
  "## A2 Candidate scores": "## A2 评分表",
  "## A3 Story continuity": "## A3 故事线连续性检查",
  "## A4 Project discovery and evidence": "## A4 项目发现与证据",
  "## A5 AI candidate selection": "## A5 AI候选筛选",
  "## B Excluded items": "## B 不收录清单",
  "## C Changelog": "## C changelog",
  "Why open this edition today": "为什么今天值得点开",
  "What is the most important finding": "最值得看的是什么",
  "Which prior assessment changed": "哪项原有判断被更新",
  "What decision can readers make": "看完后能做出什么更好的决定",
  "What evidence would overturn the conclusion": "什么证据会推翻今天的结论",
  "Which news recap was removed": "哪条内容只是新闻复述",
  "Search coverage": "检索覆盖",
  "Project classification": "项目分类",
  "Discussion evidence": "讨论证据",
  "New findings and open questions": "研究增量与待查",
  "Vendor coverage": "厂商覆盖",
  "Top three and exclusions": "前三条与取舍",
};

const compact = (value) => String(value || "").replace(/\s/g, "");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function auditReview(markdown, content = {}) {
  const errors = [];
  const E = (message) => errors.push(message);
  const text = String(markdown || "");
  const chinese = /^## (?:A0 读者价值自问|A 体检报告|B 不收录清单)/m.test(text);
  const label = (english) => chinese ? chineseLabels[english] : english;
  const sections = REQUIRED_SECTIONS.map(label);
  if (content.editorial_version === 2) {
    const end = sections.indexOf(label("## B Excluded items"));
    sections.splice(end, 0, label("## A4 Project discovery and evidence"), label("## A5 AI candidate selection"));
  }

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
    const pattern = new RegExp(`\\*\\*${escapeRegExp(label(question))}[?？]?\\*\\*[:：]\\s*([^\\n]+)`);
    const match = text.match(pattern);
    const answer = match?.[1]?.trim() || "";
    if (!answer) {
      E(`A0 missing answer: ${question}`);
      continue;
    }
    answerPositions.push(match.index);
    answers.set(question, answer);
    if (compact(answer).length < 12) E(`A0 answer too short: ${question}`);
    if (/^(?:none|unknown|unsure|worth watching|wait and see|same as above|无|暂无|不知道|不确定|值得关注|继续观察|持续关注|同上)[.。]?$/i.test(answer)) {
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
  if (changed &&
      !/(?:从.{2,}(?:到|改为|转向)|维持|提高|降低|新增|上调|下调|暂停|取消|不再|优先级|置信度)/.test(changed) &&
      !/\b(?:from .+ to|shift\w*|maintain\w*|retain\w*|increase\w*|decrease\w*|add\w*|rais\w*|lower\w*|paus\w*|cancel\w*|no longer|priorit\w*|confidence|upgrad\w*|downgrad\w*|revis\w*)\b/i.test(changed)) {
    E(`A0 must describe how the prior assessment or confidence changed`);
  }

  const decision = answers.get("What decision can readers make") || "";
  if (decision &&
      !/(?:优先|暂停|不做|先做|是否|上线|下线|资源|风控|产品|交易|用户|资产|流动性|保证金|清算|分发|合规|验证)/.test(decision) &&
      !/\b(?:priorit\w*|pause|whether|launch|delist|resources?|risk|product|trad\w*|user|assets?|liquidity|margin|liquidation|distribution|compliance|verif\w*|validat\w*|collateral)\b/i.test(decision)) {
    E(`A0 must identify a specific decision`);
  }

  const falsifier = answers.get("What evidence would overturn the conclusion") || "";
  if (falsifier &&
      !/(?:出现|达到|超过|低于|高于|下降|上升|失败|撤回|取消|没有|未能|数据|采用|转化|流失|事故|损失|延迟|偏离)/.test(falsifier) &&
      !/\b(?:emerg\w*|reach\w*|exceed\w*|below|above|fall\w*|rise\w*|increas\w*|decreas\w*|fail\w*|withdraw\w*|cancel\w*|no|data|adoption|conversion|churn|incident\w*|loss\w*|delay\w*|deviat\w*)\b/i.test(falsifier)) {
    E(`A0 must specify an observable event or data threshold`);
  }

  const deleted = answers.get("Which news recap was removed") || "";
  if (deleted && !/^(?:Removed\b|已删除)/i.test(deleted)) E(`A0 must identify the Removed news recap`);

  if (content.editorial_version === 2) {
    const start = text.indexOf(label("## A4 Project discovery and evidence"));
    const a5Start = text.indexOf(label("## A5 AI candidate selection"), start);
    const end = a5Start >= 0 ? a5Start : text.indexOf(label("## B Excluded items"), start);
    const audit = start >= 0 && end > start ? text.slice(start, end) : "";
    const headings = ["Search coverage", "Project classification", "Discussion evidence", "New findings and open questions"].map(label);
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

    const a5End = text.indexOf(label("## B Excluded items"), a5Start);
    const aiAudit = a5Start >= 0 && a5End > a5Start ? text.slice(a5Start, a5End) : "";
    const aiHeadings = ["Vendor coverage", "Top three and exclusions"].map(label);
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
    const coverage = aiParts.get(label("Vendor coverage")) || "";
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

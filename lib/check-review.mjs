#!/usr/bin/env node
// check-review.mjs — 发布前读者价值关卡：确保编辑自评真的回答“为什么值得读”。
// 用法: node lib/check-review.mjs [review.draft.md] [content.json]
import { readFileSync } from "node:fs";

const REQUIRED_SECTIONS = [
  "## A0 读者价值自问",
  "## A 体检报告",
  "### 时效自查",
  "### 六视角找茬",
  "### 十维度打分",
  "### 今天必须改的 Top 3",
  "## A1 数字量级检查",
  "## A2 评分表",
  "## A3 故事线连续性检查",
  "## B 不收录清单",
  "## C changelog",
];

const QUESTIONS = [
  "为什么今天值得点开",
  "最值得看的是什么",
  "哪项原有判断被更新",
  "看完后能做出什么更好的决定",
  "什么证据会推翻今天的结论",
  "哪条内容只是新闻复述",
];

const compact = (value) => String(value || "").replace(/\s/g, "");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function auditReview(markdown, content = {}) {
  const errors = [];
  const E = (message) => errors.push(message);
  const text = String(markdown || "");
  const sections = [...REQUIRED_SECTIONS];
  if (content.editorial_version === 2) sections.splice(sections.indexOf("## B 不收录清单"), 0, "## A4 项目发现与证据", "## A5 AI候选筛选");

  for (const section of sections) {
    if (!text.includes(section)) E(`缺少固定自评段落：${section}`);
  }
  const sectionPositions = sections.map((section) => text.indexOf(section));
  if (sectionPositions.every((position) => position >= 0)) {
    for (let i = 1; i < sectionPositions.length; i += 1) {
      if (sectionPositions[i] <= sectionPositions[i - 1]) {
        E("编辑自评段落顺序错误，必须按 A0 → A → A1 → A2 → A3 → A4 → A5（v2）→ B → C");
        break;
      }
    }
  }

  const answers = new Map();
  const answerPositions = [];
  for (const question of QUESTIONS) {
    const pattern = new RegExp(`\\*\\*${escapeRegExp(question)}[？?]?\\*\\*[：:]\\s*([^\\n]+)`);
    const match = text.match(pattern);
    const answer = match?.[1]?.trim() || "";
    if (!answer) {
      E(`A0 缺少回答：${question}`);
      continue;
    }
    answerPositions.push(match.index);
    answers.set(question, answer);
    if (compact(answer).length < 12) E(`A0 回答过短，必须具体：${question}`);
    if (/^(?:无|暂无|不知道|不确定|值得关注|继续观察|持续关注|同上)[。.]?$/.test(answer)) {
      E(`A0 不能用空泛答案应付：${question}`);
    }
  }
  if (answerPositions.length === QUESTIONS.length) {
    for (let i = 1; i < answerPositions.length; i += 1) {
      if (answerPositions[i] <= answerPositions[i - 1]) {
        E("A0 六问必须按固定顺序回答");
        break;
      }
    }
  }

  const changed = answers.get("哪项原有判断被更新") || "";
  if (changed && !/(?:从.{2,}(?:到|改为|转向)|维持|提高|降低|新增|上调|下调|暂停|取消|不再|优先级|置信度)/.test(changed)) {
    E("A0 必须明确写出原判断如何变化，或为何维持并改变置信度");
  }

  const decision = answers.get("看完后能做出什么更好的决定") || "";
  if (decision && !/(?:优先|暂停|不做|先做|是否|上线|下线|资源|风控|产品|交易|用户|资产|流动性|保证金|清算|分发|合规|验证)/.test(decision)) {
    E("A0 必须落到一项真实的产品、风控或资源决策");
  }

  const falsifier = answers.get("什么证据会推翻今天的结论") || "";
  if (falsifier && !/(?:出现|达到|超过|低于|高于|下降|上升|失败|撤回|取消|没有|未能|数据|采用|转化|流失|事故|损失|延迟|偏离)/.test(falsifier)) {
    E("A0 的反证必须是可观察事件或数据阈值");
  }

  const deleted = answers.get("哪条内容只是新闻复述") || "";
  if (deleted && !/^已删除/.test(deleted)) E("A0 必须明确写出已删除的新闻复述");

  if (content.editorial_version === 2) {
    const start = text.indexOf("## A4 项目发现与证据");
    const a5Start = text.indexOf("## A5 AI候选筛选", start);
    const end = a5Start >= 0 ? a5Start : text.indexOf("## B 不收录清单", start);
    const audit = start >= 0 && end > start ? text.slice(start, end) : "";
    const headings = ["检索覆盖", "项目分类", "讨论证据", "研究增量与待查"];
    let previous = -1;
    for (const heading of headings) {
      const pos = audit.indexOf(`### ${heading}`);
      const match = audit.match(new RegExp(`### ${heading}\\s*\\n([\\s\\S]*?)(?=\\n### |$)`));
      if (pos < 0 || !match || compact(match[1]).length < 20) E(`A4.${heading} 缺少实际记录，不能只有标题`);
      if (pos >= 0 && pos <= previous) E("A4 小节顺序应为检索覆盖、项目分类、讨论证据、研究增量与待查");
      previous = pos;
    }
    const projects = (content.sections || []).flatMap((s) => s.items || []).filter((i) => i.kind === "research").map((i) => i.research?.project).filter(Boolean);
    for (const project of projects) if (!audit.includes(project)) E(`A4 缺少研究项目：${project}`);

    const a5End = text.indexOf("## B 不收录清单", a5Start);
    const aiAudit = a5Start >= 0 && a5End > a5Start ? text.slice(a5Start, a5End) : "";
    const aiHeadings = ["厂商覆盖", "前三条与取舍"];
    const aiParts = new Map();
    let aiPrevious = -1;
    for (const heading of aiHeadings) {
      const pos = aiAudit.indexOf(`### ${heading}`);
      const match = aiAudit.match(new RegExp(`### ${heading}\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`));
      const body = match?.[1] || "";
      aiParts.set(heading, body);
      if (pos < 0 || compact(body).length < 20) E(`A5.${heading} 缺少具体筛选记录，不能只有标题或空泛答案`);
      if (pos >= 0 && pos <= aiPrevious) E("A5 小节顺序应为厂商覆盖、前三条与取舍");
      aiPrevious = pos;
    }
    const vendors = ["Anthropic", "OpenAI", "Scale AI", "xAI", "Kimi", "DeepSeek", "Qwen"];
    const coverage = aiParts.get("厂商覆盖") || "";
    for (const vendor of vendors) {
      if (!new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegExp(vendor)}(?=$|[^A-Za-z0-9])`).test(coverage)) {
        E(`A5.厂商覆盖 缺少标准厂商名：${vendor}`);
      }
    }
    const coverageDetails = vendors.reduce((body, vendor) => body.replaceAll(vendor, ""), coverage);
    if (compact(coverageDetails).replace(/[\p{P}\p{S}]/gu, "").length < 20) {
      E("A5.厂商覆盖 必须记录实际检索结果或缺口，不能只列厂商名称");
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
    console.error(`⛔ 读者价值关卡读取失败: ${e.message}`);
    process.exit(1);
  }
  const { errors } = auditReview(markdown, content);
  if (errors.length) {
    console.error(`⛔ 读者价值关卡未通过（${errors.length} 项）：`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("✅ 读者价值自问与编辑自评关卡通过");
}

#!/usr/bin/env node
// check-editorial.mjs — 发布前编辑关卡：阻断视觉/语义重复与已取消栏目。
// 用法: node lib/check-editorial.mjs [content.json]
import { readFileSync } from "node:fs";

const normalized = (value) =>
  String(value || "")
    .replace(/\*\*/g, "")
    .replace(/[\s，。！？；：、,.!?;:（）()「」『』《》“”'"·｜|/\\\-—–_]/g, "")
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

// v2只审查公开文字。底稿和来源标题可能引用原文，不能因引用而误阻断。
const introductoryPhrases = [
  /(?:更)?值得(?:进一步)?(?:研究|关注|探讨|思考|评估|核实|比较)的(?:是|在于|地方是)/,
  /可借鉴的是/,
  /(?:更)?有参考价值的是/,
  /(?:这(?:一)?期|本期|今天)(?:我们)?(?:先看|重点看|将介绍)/,
  /本文将/,
  /让我们(?:一起)?(?:来)?看看/,
  /接下来(?:我们)?(?:来看|看看)/,
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
    const text = String(value || "").replace(/\*\*|\s/g, "");
    const phrase = introductoryPhrases.map((pattern) => text.match(pattern)?.[0]).find(Boolean);
    if (phrase) E(`${label} 含引言式套话“${phrase}”；直接写已核实的发现、分析结论及边界`);
  };

  const register = (value, label, minimum = 14) => {
    const key = normalized(value);
    if (key.length < minimum) return;
    const previous = seen.get(key);
    if (previous) E(`${label} 与 ${previous} 完全重复`);
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
    if (newsUrls.has(thread.url)) E(`${tag}.url 已由当期新闻正文承载，不应在今日进展重复出现`);
    if (/(?:尚未|暂无|未发现|仍无|没有新|等待|继续关注|变化尚未发生|待观察)/.test(String(thread.update || ""))) {
      E(`${tag}.update 看起来只是“无变化/等待”状态；今日进展只允许可核验的新 delta`);
    }
  }

  for (const section of sections) {
    if (section.id === "hertzflow") E("产品判断栏已取消，请删除整个栏目");
    checkConclusionFirst(section.title, `${section.id}.title`);
    for (const [index, item] of (section.items || []).entries()) {
      const tag = `${section.id}.items[${index}]`;
      const isResearch = item.kind === "research";
      register(item.headline, `${tag}.headline`);
      checkConclusionFirst(item.headline, `${tag}.headline`);
      for (const [p, paragraph] of bodyParts(item).entries()) {
        register(paragraph, `${tag}.body[${p}]`, isResearch ? 12 : 14);
        checkConclusionFirst(paragraph, `${tag}.body[${p}]`);
        if (/\*\*二阶效应\*\*/.test(String(paragraph))) E(`${tag}.body[${p}] 二阶效应段已取消`);
      }
      if (!compactV2 && item.context?.text) register(item.context.text, `${tag}.context`);

      if (isResearch && item.research && typeof item.research === "object") {
        const research = item.research;
        const project = normalized(research.project);
        if (project) {
          const previous = researchProjects.get(project);
          if (previous) E(`${tag}.research.project 与 ${previous} 重复研究同一项目，请合并证据与分析`);
          else researchProjects.set(project, `${tag}.research.project`);
        }
        // v2底稿不在页面展示，正文从中提炼事实是正常写作，不是页面重复。
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
              E(`${label} 近似复述 body 研究摘要，请只保留新增证据或分析`);
            }
          }
          for (const [discussionIndex, discussion] of (Array.isArray(research.discussions) ? research.discussions : []).entries()) {
            register(discussion?.summary, `${tag}.research.discussions[${discussionIndex}].summary`, 12);
          }
        }
        // discussion_gap 可以重复说明同一访问或检索限制，不当作重复观点。
      }

      if (data?.lead && normalized(data.lead).length >= 16) {
        const comparison = `${item.headline || ""}${bodyParts(item)[0] || ""}`;
        if (dice(data.lead, comparison) >= 0.82) E(`lead 与 ${tag} 的标题/首段近似复述`);
      }
      if (!compactV2 && item.context?.text) {
        const main = `${item.headline || ""}${bodyParts(item).join("")}`;
        const context = normalized(item.context.text);
        if (context.length >= 14 && (normalized(main).includes(context) || dice(item.context.text, main) >= 0.88)) {
          E(`${tag}.context 近似复述 headline/body，应只补参照或边界`);
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
    console.error(`⛔ 编辑关卡读取/解析失败: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings } = auditEditorial(data);
  for (const warning of warnings) console.warn(`  ⚠️ ${warning}`);
  if (errors.length) {
    console.error(`⛔ 编辑关卡未通过（${errors.length} 项）：`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`✅ 编辑去重与版式关卡通过${warnings.length ? `（${warnings.length} 条提醒）` : ""}`);
}

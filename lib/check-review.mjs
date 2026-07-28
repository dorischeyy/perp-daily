#!/usr/bin/env node
// check-review.mjs — 发布前读者价值关卡：确保编辑自评真的回答“为什么值得读”。
// 用法: node lib/check-review.mjs [review.draft.md]
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

export function auditReview(markdown) {
  const errors = [];
  const E = (message) => errors.push(message);
  const text = String(markdown || "");

  for (const section of REQUIRED_SECTIONS) {
    if (!text.includes(section)) E(`缺少固定自评段落：${section}`);
  }
  const sectionPositions = REQUIRED_SECTIONS.map((section) => text.indexOf(section));
  if (sectionPositions.every((position) => position >= 0)) {
    for (let i = 1; i < sectionPositions.length; i += 1) {
      if (sectionPositions[i] <= sectionPositions[i - 1]) {
        E("编辑自评段落顺序错误，必须按 A0 → A → A1 → A2 → A3 → B → C");
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

  return { errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] || "review.draft.md";
  let markdown;
  try {
    markdown = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`⛔ 读者价值关卡读取失败: ${e.message}`);
    process.exit(1);
  }
  const { errors } = auditReview(markdown);
  if (errors.length) {
    console.error(`⛔ 读者价值关卡未通过（${errors.length} 项）：`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("✅ 读者价值自问与编辑自评关卡通过");
}

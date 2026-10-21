import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateContent } from "../lib/validate-content.mjs";
import { validateResearchItem, isIsoDate, visibleCharCount } from "../lib/research.mjs";
import { run, tmpJson, baseContent } from "./_helpers.mjs";
import { researchContent, researchItem } from "./_research-fixture.mjs";

const TODAY = "2026-06-23";
const freshness = (content, today = TODAY) => run(["lib/check-freshness.mjs", tmpJson(content), today]);
const item = (content) => content.sections[0].items[0];
const errors = (content) => validateContent(content).errors;

test("项目研究允许旧文档和未标日期文档，通过完整性及时效关卡", () => {
  const content = researchContent();
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  delete item(content).date;
  item(content).references[0] = { source: "无日期补充文档", url: "https://example.org/docs", date: null, checked_at: TODAY };
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
});

test("2026-10-21 起必须使用新版，旧版归档仍兼容", () => {
  assert.deepEqual(errors(baseContent({ date: "2026-10-20" })), []);
  assert.ok(errors(baseContent({ date: "2026-10-21" })).some((error) => /editorial_version/.test(error)));
  assert.ok(errors(baseContent({ date: "2026-10-22", editorial_version: 1 })).some((error) => /editorial_version/.test(error)));
  assert.deepEqual(errors(researchContent({ date: "2026-10-21" })), []);
});

test("新版除 AI 外的栏目动态选择，不要求固定栏目、条数或研究配额", () => {
  const content = researchContent();
  const ai = content.sections.find((section) => section.id === "ai");
  content.sections = [{ id: "wallet-distribution", title: "钱包分发", items: [content.sections[0].items[2]] }, ai];
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  content.sections[0].items = [];
  assert.ok(errors(content).some((error) => /items 不能为空/.test(error)));
});

test("新版研究分类不限制所在栏目，但必须明确 Crypto 或 AI 关联", () => {
  for (const category of ["spot-infrastructure", "prediction-market", "other"]) {
    const content = researchContent();
    content.sections[0].items[1].research.category = category;
    assert.deepEqual(errors(content), []);
  }
  const content = researchContent();
  item(content).domain = "finance";
  item(content).relevance = "有关联";
  assert.ok(errors(content).some((error) => /domain/.test(error)));
  assert.ok(errors(content).some((error) => /relevance/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("未知 kind 在结构和时效关卡均阻断", () => {
  for (const kind of ["analysis", "Research", null]) {
    const content = baseContent();
    item(content).kind = kind;
    assert.ok(errors(content).some((error) => /kind/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("仅修改 kind 不能绕过时效，旧版本的 research 同样必须完整", () => {
  const content = baseContent();
  item(content).kind = "research";
  item(content).date = "2026-01-01";
  assert.ok(errors(content).some((error) => /research 应为对象/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("研究内部证据仍完整，新版正文不限两句且旧版继续限制摘要", () => {
  for (const field of ["why_now", "mechanism", "gtm", "product", "implication", "unknowns"]) {
    const content = researchContent();
    item(content).research[field] = "待确认";
    assert.ok(errors(content).some((error) => error.includes(`research.${field}`)));
    assert.equal(freshness(content).code, 1);
  }
  const content = researchContent();
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  const legacy = baseContent();
  legacy.sections[0].items[0] = researchItem({ body: "第一句。第二句。第三句。" });
  assert.ok(errors(legacy).some((error) => /1–2 句/.test(error)));
});

test("新版栏目 id 必须唯一合理，title 不得空白", () => {
  const content = researchContent();
  content.sections[1].id = content.sections[0].id;
  assert.ok(errors(content).some((error) => /id 重复/.test(error)));
  content.sections[1].id = "<script>";
  content.sections[1].title = "  ";
  assert.ok(errors(content).some((error) => /slug/.test(error)));
  assert.ok(errors(content).some((error) => /缺 title/.test(error)));
});

test("新版正文须为 70–150 个可见 Unicode 字符的单一字符串", () => {
  const content = researchContent();
  for (const length of [69, 151]) {
    item(content).body = "字".repeat(length);
    assert.ok(errors(content).some((error) => /70–150/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  for (const length of [70, 150]) {
    item(content).body = "字".repeat(length);
    assert.deepEqual(errors(content), []);
  }
  item(content).body = ["字".repeat(80)];
  assert.ok(errors(content).some((error) => /单一字符串/.test(error)));
  assert.equal(visibleCharCount("**甲乙** A 1。😀"), 6);
  const literalLink = "[A](https://example.com)";
  assert.equal(visibleCharCount(literalLink), Array.from(literalLink).length);
  item(content).body = `**${"字".repeat(69)}** 😀`;
  assert.deepEqual(errors(content), []);
});

test("新版正文不使用标签式小标题，context 的事实必须并入正文", () => {
  for (const prefix of ["机制：", "**影响**：", "【事件】", "### 背景\n"]) {
    const content = researchContent();
    item(content).body = `${prefix}${"说明".repeat(40)}`;
    assert.ok(errors(content).some((error) => /标签式小标题/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  const content = researchContent();
  item(content).context = { label: "口径限制", text: "重要限制需要进入正文，不能另列隐藏字段。" };
  assert.ok(errors(content).some((error) => /context 已停用/.test(error)));
});

test("新版正文必须是单段，换行和项目符号均会阻断", () => {
  for (const separator of ["\n", "\r\n", "\u2028", "\u2029"]) {
    const content = researchContent();
    item(content).body = `${"甲".repeat(40)}${separator}${"乙".repeat(40)}`;
    assert.ok(errors(content).some((error) => /单段连续正文/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  for (const marker of ["• ", "- ", "+ ", "* ", "1. "]) {
    const content = researchContent();
    item(content).body = `${marker}${"说明".repeat(40)}`;
    assert.ok(errors(content).some((error) => /项目符号/.test(error)));
  }
});

test("新版新闻标题须包含真实事件日期，不能只提供来源日期", () => {
  const content = researchContent();
  const news = content.sections[0].items[2];
  delete news.event_date;
  assert.ok(errors(content).some((error) => /event_date/.test(error)));
  news.event_date = "2026-06-22";
  assert.ok(errors(content).some((error) => /headline 必须包含/.test(error)));
  news.headline = "6月22日示例协议上线钱包集成并开放用户申请";
  assert.deepEqual(errors(content), []);
  news.headline = "2026-06-22 示例协议上线钱包集成并开放用户申请";
  assert.deepEqual(errors(content), []);
  news.event_date = "2026-06-24";
  news.headline = "6月24日示例协议上线钱包集成并开放用户申请";
  assert.ok(errors(content).some((error) => /不能晚于/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("新版机制研究使用无日期标题，核验日仍在来源字段记录", () => {
  const content = researchContent();
  item(content).headline = "示例协议共享订单簿深度并在单池隔离保证金风险";
  assert.equal(item(content).checked_at, TODAY);
  assert.equal(item(content).event_date, undefined);
  assert.equal(item(content).snapshot_date, undefined);
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
});

test("新版机制研究不能把 checked_at 写成研究或截至日期标题", () => {
  for (const headline of [
    "6月23日研究示例协议的订单簿与钱包分发策略",
    "截至6月23日示例协议的钱包分发仍缺留存证据",
    "截至2026-06-23示例协议的钱包分发仍缺留存证据",
    "截至2026/06/23示例协议的钱包分发仍缺留存证据",
    "6月23日示例协议上线钱包集成并开放用户申请",
  ]) {
    const content = researchContent();
    item(content).headline = headline;
    assert.ok(errors(content).some((error) => /checked_at 核验日不能作为标题时间/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("无时间字段的机制研究拒绝相对核验日与简写日期包装", () => {
  for (const headline of [
    "截至今天示例协议的钱包分发仍缺留存证据",
    "今天研究示例协议的订单簿与钱包分发策略",
    "今日核验示例协议的订单簿与钱包分发策略",
    "10-21研究示例协议的订单簿与钱包分发策略",
    "10/21研究示例协议的订单簿与钱包分发策略",
    "截至10-21示例协议的钱包分发仍缺留存证据",
  ]) {
    const content = researchContent();
    item(content).headline = headline;
    assert.ok(errors(content).some((error) => /checked_at 核验日不能作为标题时间/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("研究时间检查不泛禁有实义的今天、数值区间或正文不等于", () => {
  for (const headline of [
    "示例协议允许今天买入的份额在结算前转让",
    "示例协议的10-21个交易池各自隔离保证金风险",
  ]) {
    const content = researchContent();
    item(content).headline = headline;
    item(content).body = "示例协议复用现货订单簿承接杠杆交易，但抵押物与债务按单个交易池隔离，不能跨池抵消风险。共享深度不等于共享保证金，接入应用仍需处理借贷、喂价和清算提醒，也需核验各池当前参数与真实交易体验。";
    assert.deepEqual(errors(content), []);
    assert.equal(freshness(content).code, 0);
  }
});

test("新版事件研究保留真实 event_date 与标题日期匹配校验", () => {
  const content = researchContent();
  item(content).event_date = "2026-06-20";
  item(content).headline = "6月20日示例协议上线钱包集成并开放用户申请";
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  item(content).headline = "2026-06-20示例协议上线钱包集成并开放用户申请";
  assert.deepEqual(errors(content), []);
  item(content).headline = "6月21日示例协议上线钱包集成并开放用户申请";
  assert.ok(errors(content).some((error) => /headline 必须包含/.test(error)));
  assert.equal(freshness(content).code, 1);
  item(content).event_date = "2026-06-24";
  item(content).headline = "6月24日示例协议上线钱包集成并开放用户申请";
  assert.ok(errors(content).some((error) => /event_date 不能晚于/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("新版数据快照研究可用真实 snapshot_date，核验日仍为报告日", () => {
  for (const [snapshot_date, headline] of [
    [TODAY, "截至6月23日示例协议的公开交易样本仍缺留存数据"],
    ["2026-06-20", "截至2026-06-20示例协议的公开交易样本仍缺留存数据"],
  ]) {
    const content = researchContent();
    Object.assign(item(content), { snapshot_date, headline });
    assert.equal(item(content).checked_at, TODAY);
    assert.deepEqual(errors(content), []);
    assert.equal(freshness(content).code, 0);
  }
});

test("新版 snapshot_date 不接受未来或非法日期，也不能和事件日并存", () => {
  for (const snapshot_date of ["2026-06-24", "2026-02-30", "昨天", "", null]) {
    const content = researchContent();
    Object.assign(item(content), { snapshot_date, headline: "截至6月24日示例协议的公开交易样本仍缺留存数据" });
    assert.ok(errors(content).some((error) => /snapshot_date/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  const content = researchContent();
  Object.assign(item(content), { event_date: TODAY, snapshot_date: TODAY, headline: "截至6月23日示例协议的公开交易样本仍缺留存数据" });
  assert.ok(errors(content).some((error) => /snapshot_date 与 event_date 互斥/.test(error)));
  assert.equal(freshness(content).code, 1);
});

test("新版数据快照标题必须明确截至并对应 snapshot_date", () => {
  for (const headline of [
    "截至6月22日示例协议的公开交易样本仍缺留存数据",
    "6月23日研究示例协议的公开交易样本与留存数据",
    "截至本次核验示例协议的公开交易样本仍缺留存数据",
  ]) {
    const content = researchContent();
    Object.assign(item(content), { snapshot_date: TODAY, headline });
    assert.ok(errors(content).some((error) => /headline 数据快照标题/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("新版新闻不能以 snapshot_date 代替或附加到事件日期", () => {
  for (const hasEventDate of [true, false]) {
    const content = researchContent();
    const news = content.sections[0].items[2];
    news.snapshot_date = TODAY;
    news.headline = "截至6月23日示例协议的公开交易样本仍缺留存数据";
    if (!hasEventDate) delete news.event_date;
    assert.ok(errors(content).some((error) => /snapshot_date 仅用于 research/.test(error)));
    if (!hasEventDate) assert.ok(errors(content).some((error) => /event_date 应为真实/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
});

test("新版新闻的事件日也受时效限制，研究可核验较早事件", () => {
  const content = researchContent();
  const news = content.sections[0].items[2];
  news.event_date = "2026-06-19";
  news.headline = "6月19日示例协议上线钱包集成并开放用户申请";
  assert.equal(news.date, TODAY);
  assert.match(freshness(content).out, /event_date=2026-06-19/);
  assert.equal(freshness(content).code, 1);
  news.event_date = "2026-06-20";
  news.headline = "6月20日示例协议上线钱包集成并开放用户申请";
  assert.equal(freshness(content).code, 0);
  news.event_date = "2026-06-16";
  news.headline = "本周主线：6月16日示例协议的钱包集成为分发竞争提供新样本";
  assert.equal(freshness(content).code, 0);
  news.event_date = "2026-06-15";
  news.headline = "本周主线：6月15日示例协议的钱包集成为分发竞争提供新样本";
  assert.equal(freshness(content).code, 1);
  content.sections[0].items.pop();
  item(content).event_date = "2026-01-01";
  item(content).headline = "2026-01-01 示例协议上线钱包集成后的分发路径研究";
  assert.equal(freshness(content).code, 0);
});

test("正文不受支持的Markdown链接按页面原样计数，不能隐藏超长URL", () => {
  const content = researchContent();
  item(content).body = "核验事实".repeat(20) + `[详情](https://example.com/${"a".repeat(120)})`;
  assert.ok(errors(content).some((error) => /body 应为 70/.test(error)));
});

test("v2不接受不会展示的threads快照，台账单独维护", () => {
  const content = researchContent();
  content.threads = [];
  assert.ok(errors(content).some((error) => /v2 不应生成 threads/.test(error)));
});

test("研究主来源与每个补充来源均须当天核验", () => {
  for (const target of ["primary", "reference"]) {
    const content = researchContent();
    const source = target === "primary" ? item(content) : item(content).references[0];
    source.checked_at = "2026-06-22";
    assert.ok(errors(content).some((error) => /checked_at/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  assert.equal(freshness(researchContent(), "2026-06-24").code, 1);
});

test("研究至少需要两个不同 URL，来源名称和链接不能缺失", () => {
  const content = researchContent();
  item(content).references[0].url = item(content).url;
  assert.ok(errors(content).some((error) => /重复|两个/.test(error)));
  item(content).references = [];
  assert.equal(freshness(content).code, 1);
  const invalid = researchItem();
  invalid.source = "";
  invalid.references[0].url = "javascript:alert(1)";
  const result = validateResearchItem(invalid, TODAY);
  assert.ok(result.some((error) => /source/.test(error)));
  assert.ok(result.some((error) => /url/.test(error)));
});

test("研究来源不能未来、伪造 URL 日期或藏起已知日期", () => {
  for (const [date, url] of [
    ["2026-06-24", "https://example.com/docs"],
    ["2026-06-23", "https://example.com/2026/06/22/post"],
    [null, "https://example.com/2026/06/22/post"],
    ["2026-02-30", "https://example.com/docs"],
  ]) {
    for (const reference of [false, true]) {
      const content = researchContent();
      Object.assign(reference ? item(content).references[0] : item(content), { date, url });
      assert.ok(errors(content).length > 0);
      assert.equal(freshness(content).code, 1);
    }
  }
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2028-02-29"), true);
});

test("讨论需明确人物、关系、原文日期，最近 30 天以外的观点不能作热度证据", () => {
  const content = researchContent();
  const discussion = { speaker: "研究员", affiliation: "independent", summary: "讨论了钱包分发的获客成本和做市商激励。", url: "https://example.net/comment", date: "2026-05-24" };
  item(content).research.discussions = [discussion];
  assert.deepEqual(errors(content), []);
  assert.equal(freshness(content).code, 0);
  for (const date of ["2026-05-23", "2026-06-24", "昨天"]) {
    discussion.date = date;
    assert.ok(errors(content).some((error) => /discussions.*date/.test(error)));
    assert.equal(freshness(content).code, 1);
  }
  discussion.date = TODAY;
  discussion.affiliation = "influencer";
  assert.ok(errors(content).some((error) => /affiliation/.test(error)));
  discussion.affiliation = "unknown";
  delete discussion.speaker;
  assert.ok(errors(content).some((error) => /speaker/.test(error)));
});

test("没有可核验讨论时必须交代具体检索缺口", () => {
  const content = researchContent();
  item(content).research.discussion_gap = "没有";
  assert.ok(errors(content).some((error) => /discussion_gap/.test(error)));
  assert.equal(freshness(content).code, 1);
  item(content).research.discussions = "未找到";
  assert.ok(errors(content).some((error) => /discussions/.test(error)));
});

test("新闻及补充来源的未来日期会阻断", () => {
  const content = baseContent();
  item(content).date = "2026-06-24";
  assert.equal(freshness(content).code, 1);
  item(content).date = TODAY;
  item(content).references = [{ source: "来源", url: "https://example.com/future", date: "2026-06-24" }];
  assert.equal(freshness(content).code, 1);
});

test("AI 高权重分值不会放宽来源日期和事件日期的时效", () => {
  const content = researchContent();
  const ai = content.sections.find((section) => section.id === "ai").items[0];
  ai.importance_score = 100;
  ai.date = "2026-06-19";
  assert.equal(freshness(content).code, 1);
  ai.date = TODAY;
  ai.event_date = "2026-06-19";
  ai.headline = "6月19日示例AI团队发布开发者模型并开放申请";
  assert.equal(freshness(content).code, 1);
});

const render = (content) => {
  const path = join(mkdtempSync(join(tmpdir(), "research-render-")), "research.html");
  assert.equal(run(["lib/build-html.mjs", tmpJson(content), path]).code, 0);
  return readFileSync(path, "utf8");
};

test("v2 研究正文沿用紧凑条目，来源行保留真实发布日期与核验日", () => {
  const html = render(researchContent());
  for (const label of ["核验 2026-06-23", "未标发布日期", "发布 2026-05-01"]) {
    assert.ok(html.includes(label), label);
  }
  for (const label of ["项目研究 · 永续协议", "项目研究 · 交易前端", "选题理由", "GTM 策略", "产品策略", "讨论核验缺口", "判断（分析推断）", "尚未确认"]) {
    assert.ok(!html.includes(label), label);
  }
  assert.ok(!html.includes('<dl class="research-details">'));
  assert.ok(!html.includes("发布 2026-06-23 · 核验 2026-06-23"));
});

test("v2 内部研究不显示，讨论来源会转义且危险链接不渲染", () => {
  const content = researchContent();
  const research = item(content).research;
  research.mechanism = '<img src=x onerror="alert(1)">';
  research.project = '<script>alert(1)</script>';
  research.discussions = [
    { speaker: '<b>研究员</b>', affiliation: "sponsored", summary: '<script>alert(2)</script>', url: "https://example.net/comment", date: TODAY },
    { speaker: "危险来源", affiliation: "unknown", summary: "内部观点", url: "javascript:alert(3)", date: TODAY },
  ];
  item(content).references[0].source = `https://example.com/${"long".repeat(80)}`;
  const html = render(content);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;b&gt;研究员&lt;/b&gt;'));
  assert.ok(html.includes('赞助内容'));
  assert.match(html, /overflow-wrap:anywhere/);
  assert.ok(!html.includes('危险来源'));
  assert.ok(!html.includes('&lt;script&gt;alert(2)&lt;/script&gt;'));
});

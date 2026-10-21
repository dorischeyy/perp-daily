import { baseContent } from "./_helpers.mjs";

export function researchItem(overrides = {}) {
  return {
    kind: "research",
    domain: "crypto",
    relevance: "该项目的撮合机制与钱包分发路径直接影响永续产品竞争。",
    headline: "示例协议以订单簿撮合并通过钱包入口分发",
    body: "示例协议以专用执行环境处理撮合，并通过钱包入口争取交易用户。文档说明了报价与结算流程，但没有披露补贴结束后的独立交易者数量。现有宣传覆盖面尚不能证明自然留存，因此需要持续检查活动结束后的入金与持仓变化。",
    source: "官方机制文档",
    url: "https://example.com/docs/mechanism",
    date: null,
    checked_at: "2026-06-23",
    references: [{ source: "独立机制复核", url: "https://example.org/2026/05/01/research", date: "2026-05-01", checked_at: "2026-06-23" }],
    research: {
      project: "示例协议",
      category: "perp-protocol",
      why_now: "钱包新增入口使该协议的获客方式出现可核验变化。",
      mechanism: "订单在专用执行环境撮合并由链上清算流程结算。",
      gtm: "项目通过钱包集成和做市商计划同时吸引交易与报价。",
      product: "界面强调专业订单类型和持仓管理以服务高频交易者。",
      implication: "分析推断：可比较入口转化成本但不能直接照搬执行架构。",
      unknowns: "尚未公布补贴结束后的自然留存以及做市商集中度。",
      discussions: [],
      discussion_gap: "已检查公开讨论索引，但未找到可访问且有日期的独立观点。",
    },
    ...overrides,
  };
}

export function researchContent(overrides = {}) {
  const content = baseContent({ editorial_version: 2, ...overrides });
  content.sections[0].items[0] = researchItem({ checked_at: content.date });
  content.sections[0].items[0].references[0].checked_at = content.date;
  content.sections[0].items[1] = researchItem({ headline: "交易前端用本地化入口分发永续订单", url: "https://example.com/frontend", checked_at: content.date });
  content.sections[0].items[1].body = "示例前端连接外部永续交易后台，以本地语言和移动端体验降低操作门槛。应用说明展示了首次入金和下单流程，适合比较地区获客中的操作阻力。目前尚未披露合作渠道带来的净新增交易用户，也无法区分活动用户与持续交易用户。";
  Object.assign(content.sections[0].items[1].research, {
    project: "示例前端",
    category: "trading-frontend",
    why_now: "新开放的移动应用提供了检查开户路径和区域分发的入口。",
    mechanism: "用户签名交由外部订单系统执行，前端不维护独立清算引擎。",
    gtm: "团队借助地区社区合作组织首次入金教程以争取新用户。",
    product: "采用本地语言导航和简化下单页减少手机交易的操作层级。",
    implication: "分析推断：本地化入口的竞争价值需要以转化和留存验证。",
    unknowns: "目前还不知道外部执行方对订单收入和用户数据的分配约束。",
  });
  content.sections[0].items[1].references[0].checked_at = content.date;
  const headlineDate = `${Number(content.date.slice(5, 7))}月${Number(content.date.slice(8, 10))}日`;
  for (const section of content.sections) {
    for (const [index, entry] of section.items.entries()) {
      if (entry.kind !== "research") {
        entry.domain = section.id === "ai" ? "ai" : "crypto";
        if (section.id === "ai") entry.importance_score = 95 - index * 10;
        entry.relevance = "这项功能变化能够用于比较产品采用门槛和真实用户转化。";
        entry.event_date = content.date;
        entry.date = content.date;
        entry.headline = `${headlineDate}${section.title}团队上线第${index + 1}项示例功能并开放申请`;
        entry.body = `${section.title}团队推出第${index + 1}项示例功能，公告提供了申请范围、接入条件和操作说明。公开资料可以确认功能已经开放，但尚未提供活跃用户留存与收入数据，需要把试用资格和正式使用情况分别核验，才能判断产品实际采用程度。`;
      }
    }
  }
  return content;
}

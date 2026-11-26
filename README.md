# Perp DEX 日报

Perp DEX 日报是 Doris 开发并维护的中文研究产品，面向关注加密衍生品的产品经理、研究者和交易者。日报追踪永续合约交易所的变化，从定价、保证金、清算与结算规则入手，解释这些变化如何影响交易者。独立的 AI 栏目记录模型发布、产品能力与实际应用。

[阅读最新一期](https://dorischeyy.github.io/perp-daily/) · [浏览往期日报与编辑记录](docs/archive/)

## 从一期日报读起

2026 年 11 月 26 日，第 143 期跟踪了两项保证金与风险管理规则的变化。Binance 将五只代币化证券纳入保证金范围。KuCoin 公布了将于 12 月 1 日生效的共享保险基金规则，并说明哪些合约会优先触发自动减仓。正文可直接打开公告原文，同期编辑记录列出了事件日期、入选依据及尚待确认的问题。[第 143 期](https://dorischeyy.github.io/perp-daily/archive/2026-11-26.html) · [本期编辑记录](docs/archive/2026-11-26-review.md)

## 研究与发布

- **来源与日期。** 新闻条目注明事件发生时间，并链接至交易所公告、监管文件、项目文档或论文。机制研究区分规则生效时间、数据快照时间与资料核验时间。
- **持续跟踪。** 同一主题的进展保存在公开记录中，包含此前判断、新证据、来源与下次复核日期。读者可以沿记录了解一个市场或机制如何演变。[主题跟踪记录](threads.json)
- **选题与核验。** 编辑流程按结构影响、相关性、持续性、可行动性和证据质量筛选候选。每期公开编辑记录，保留选题取舍和核验结果。[编辑方法](METHODOLOGY.md)
- **交付。** Codex 自动化流程负责调研、撰稿与校验。每期以静态网页发布到 GitHub Pages，并由仓库工作流向飞书和 Slack 分发摘要。[运行说明](OPERATIONS.md)

## 本地预览

使用 Node.js 18 或以上版本，在仓库根目录执行以下命令，即可将示例数据渲染为 HTML 并运行检查。

```bash
mkdir -p out
node lib/build-html.mjs config/content.sample.json out/preview.html
npm run check
npm test
```

在浏览器中打开 `out/preview.html` 即可预览页面。选题范围、引用规则与生成步骤见[编发规范](generate.md)，候选资料入口见[来源目录](config/sources.json)。

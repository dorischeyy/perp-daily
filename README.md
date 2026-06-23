# perp-daily · Perp DEX 每日杂志风日报

> **不是逐日新闻搬运，是一个分析者在持续追一组叙事。** 系统给每条新闻打分、维护跨日的"故事线台账"、把分散在各天的进展串成连续判断，并用机械关卡守住时效、防造假、防重复、漏报告警。
>
> 📐 **编辑方法论（为什么这样产出）→ [METHODOLOGY.md](METHODOLOGY.md)** ｜ 🛠 **运维 / 排错 → [OPERATIONS.md](OPERATIONS.md)**

每天**北京时间 08:03** 自动：联网调研 → 评分与建线 → 生成中文杂志风 HTML → GitHub Pages 发布 + GitHub Actions 发飞书 + Slack 卡片；10:30 watchdog 自检漏报。
栏目：**持续追踪 Story Threads → Perp DEX（主）→ Launchpad → Crypto → AI →「对 Hertzflow 的启发」**。

### 凭什么说"有水平"，不是一句话喂模型的日报
- **信号评分**：每条新闻按 结构性/相关度/持续性/可行动性/量级×可信度 5 维打分(0-100)，决定取舍、排序、是否长期追踪。
- **故事线串联**：S 级(≥90)事件建成 `threads.json` 台账，按节奏复盘、跨日 recall，读者不会因漏看某天而断线。反冗余铁律保证"串联"而非"复读"。
- **机械守门**：时效(≤72h)、防日期造假(URL+WebFetch 双校验)、台账结构校验、投递去重、漏报告警、投递重试，全部脚本强制。
- **可审计**：每期产出《编辑自评》(评分表 + 时效逐条核对 + 故事线连续性 + 六视角找茬)，公开存档。

## 设计原则：渠道可迁移

系统分 4 层，每层与具体渠道解耦，所以"飞书 → 以后加 Slack/团队"零改动：

| 层 | 文件 | 渠道无关性 |
|----|------|-----------|
| 内容层 | `generate.md` + `build-html.mjs` | 产出内容 JSON + HTML，与渠道无关 |
| 托管层 | 静态托管（见下） | 产出**一个公网 URL**，任何渠道都能发 |
| 交付层 | `deliver.mjs` + `channels.json` | 按配置发到所有启用渠道；**加渠道=改配置不改码** |
| 调度层 | 云端 Routine（`/schedule`） | 渠道增减无感 |

> 为什么不用「飞书云文档」：那是飞书私有形态，搬不到 Slack，且要建飞书应用。
> 静态托管 HTML = 一个链接，飞书/Slack/邮件通用，杂志排版还 100% 保留。
> `feishu.mjs`（云文档导入）作为可选保留，主链路不用它。

## 文件

| 文件 | 作用 |
|------|------|
| `generate.md` | 云端 Routine 每天执行的完整指令（调研→评分→建线→串联→自检→渲染→发布→交付） |
| `METHODOLOGY.md` | 编辑方法论：评分体系 + 故事线串联 + 守门机制（说明"为什么这样产出"） |
| `sources.json` | 信源注册表（四层：official/founder/media/kol/data × 中英区 × 主题）+ feeds RSS 实时源层 |
| `threads.json` | **故事线台账**：跨日叙事追踪的持久状态（评分/论点/复盘节奏/进展日志） |
| `threads.mjs` | 台账机械 QA：结构校验 + 提醒今日到期该复盘的线 |
| `check-freshness.mjs` | 时效 + 防日期造假关卡（新闻≤72h、URL 内嵌日期 vs date 交叉校验） |
| `build-html.mjs` | 内容 JSON → 杂志风单页 HTML（含「持续追踪」块渲染，无依赖） |
| `deliver.mjs` | 渠道无关交付：读 `channels.json` 发到所有启用渠道（飞书/Slack 适配器 + 重试） |
| `.github/workflows/` | `feishu-notify.yml`(去重投递) + `daily-watchdog.yml`(漏报兜底告警) |
| `channels.sample.json` / `content.sample.json` | 渠道 / 内容 JSON 结构样例 |
| `feishu.mjs` | （可选）飞书云文档导入 / 私信 |
| `out/` | 每日产物（HTML） |

## 本地测试（无需任何凭证）

```bash
node build-html.mjs content.sample.json   # → out/perp-daily-2026-06-20.html
open out/perp-daily-2026-06-20.html
```

## 交付层：现在配飞书，以后加 Slack

1. 拷配置：`cp channels.sample.json channels.json`
2. **飞书**：目标群 → 设置 → 群机器人 → 添加「自定义机器人」→ 复制 Webhook：
   ```bash
   export FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxx"
   ```
3. 测试：`node deliver.mjs "测试" "https://example.com" "一条测试"`
4. **以后加 Slack（团队用）**：Slack → Apps → Incoming Webhooks → 建一个 → 复制 URL：
   ```bash
   export SLACK_WEBHOOK="https://hooks.slack.com/services/xxx/xxx/xxx"
   ```
   再把 `channels.json` 里 slack 那条 `"enabled"` 改成 `true`。**不用改任何代码。**

> 凭证不写进 `channels.json`（webhook 字段用 `"env:VAR"` 从环境变量读）；`channels.json` 已 gitignore。

## 托管层：静态托管 HTML

任选其一（都给纯公网 URL，杂志排版完整保留）：
- **Cloudflare Pages**：可连私有仓库，免费，自定义域。
- **GitHub Pages**：公开仓库免费；每天提交新 HTML 即自动发布。

发布动作接进 `generate.md` 步骤 4（待选定托管后我补上具体发布命令）。

## 调度层：云端 10:00 定时

由 `/schedule` 创建云端 Routine，cron `3 10 * * *`（北京时间，避开整点拥堵），
执行内容＝按 `generate.md` 全流程跑一遍。云端需要：① 能拉到本项目代码（私有仓库）
② 注入 `FEISHU_WEBHOOK` 等环境变量。

## 注意
- 不收录无来源内容，每条要点必须有真实 URL，不做投资建议。
- 板块顺序固定：Perp DEX 第一，再 AI、Crypto。

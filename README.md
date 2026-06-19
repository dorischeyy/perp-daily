# perp-daily · Perp DEX 每日杂志风日报

每天早上 10:00（北京时间）自动：联网调研 → 生成极简杂志风 HTML → 发布到静态托管 → 把公网链接交付到各渠道。
板块：**Perp DEX（主类别，置顶）** + AI + Crypto，全中文。

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
| `generate.md` | 云端 Routine 每天执行的完整指令（调研→渲染→发布→交付） |
| `sources.json` | 信源注册表（四层：official/founder/media/kol/data × 中英区 × 主题），含 core_pool 核心池 |
| `build-html.mjs` | 内容 JSON → 杂志风单页 HTML（已跑通，无依赖） |
| `deliver.mjs` | 渠道无关交付：读 `channels.json`，发到所有启用渠道（飞书/Slack 已内置适配器） |
| `channels.sample.json` | 渠道配置样例（拷成 `channels.json` 用） |
| `content.sample.json` | 内容 JSON 结构样例 |
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

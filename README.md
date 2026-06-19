# perp-daily · Perp DEX 每日杂志风日报

每天早上 10:00（北京时间）自动：联网调研 → 生成极简杂志风 HTML → 导入飞书云文档 → 群机器人 Webhook 把链接发给你。
板块：**Perp DEX（主类别，置顶）** + AI + Crypto，全中文。

## 文件

| 文件 | 作用 |
|------|------|
| `generate.md` | 云端 Routine 每天执行的完整指令（调研→渲染→导入→发送） |
| `build-html.mjs` | 内容 JSON → 杂志风单页 HTML（已跑通，无依赖） |
| `feishu.mjs` | 飞书集成：`doc` 导入云文档 / `webhook` 发链接 / `dm` 私信 |
| `content.sample.json` | 内容 JSON 结构样例 |
| `out/` | 每日产物（HTML / MD） |

## 本地测试（无需任何凭证）

```bash
node build-html.mjs content.sample.json   # → out/perp-daily-2026-06-20.html
open out/perp-daily-2026-06-20.html
```

## 接入飞书（需要你提供凭证）

### A. 群机器人 Webhook（发链接，必需）
1. 飞书目标群 → 设置 → 群机器人 → 添加「自定义机器人」→ 复制 Webhook 地址。
2. 设环境变量：`export FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxx"`
3. 测试：`node feishu.mjs webhook "测试" "https://example.com" "这是一条测试"`

### B. 自建应用（创建飞书云文档，必需）
> Webhook 无法创建云文档，必须用自建应用。
1. https://open.feishu.cn → 开发者后台 → 创建企业自建应用 → 拿到 **App ID / App Secret**。
2. 开通权限（权限管理）：
   - `drive:drive`（云空间读写，含导入）
   - `docx:document`（文档读写）
   - `im:message`（如需私信 `dm` 子命令）
3. 发布应用版本并通过审核（自建应用通常企业内即时生效）。
4. 设环境变量：
   ```bash
   export FEISHU_APP_ID="cli_xxx"
   export FEISHU_APP_SECRET="xxx"
   # 可选：导入到指定文件夹（否则进「我的空间」根目录）
   export FEISHU_FOLDER_TOKEN="fldcnxxx"
   ```
5. 测试：`node feishu.mjs doc out/perp-daily-2026-06-20.html "测试日报"`

## 定时（云端 10:00）

由 Claude 的 `/schedule` 创建云端 Routine，cron `3 10 * * *`（北京时间，避开整点），
执行内容＝读取并按 `generate.md` 全流程跑一遍。凭证需配置在 Routine 的环境中。

## 注意
- 飞书云文档不渲染自定义 CSS，杂志排版会被转成飞书原生样式（结构保留、视觉简化）。
  若想保留完整杂志视觉，另选静态托管（GitHub/Cloudflare Pages）host HTML，再发链接。
- 不收录无来源内容，不做投资建议。

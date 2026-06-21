# perp-daily 运维手册（OPERATIONS）

> **给未来的我 / 新会话 / 新设备**：这份文件是这套"每日 Perp DEX 日报自动化"的完整运行说明 + 排错指南。
> 任何新的 Claude 会话只要读完本文件，就能接手运维。**本仓库公开，本文件不含任何密钥明文**（密钥位置见 §7）。

---

## 0. 一句话

每天**北京时间 08:03**，一个云端 Claude 定时任务自动：联网调研 → 写中文杂志风日报 → 推到 GitHub → GitHub Pages 发布网页 + GitHub Actions 发飞书卡片到群。

## 1. 架构与数据流

```
[云端定时 Routine (claude.ai)]  每天 08:03 北京时间
   │  git clone 本仓库(公开) → 按 generate.md 调研+写作 → 写 content.json
   │  跑 bash publish.sh：
   │     ├─ build-html.mjs  : content.json → docs/archive/<date>.html + docs/index.html
   │     ├─ 把 review.draft.md 改名为 docs/archive/<date>-review.md（编辑自评，可审计）
   │     ├─ 写 docs/latest.json {date,url,title,lead}
   │     └─ git push（用内嵌的 GitHub token）
   ▼
[GitHub 仓库 dorischeyy/perp-daily]  push 触发两件事：
   ├─ GitHub Pages：从 main 分支 /docs 发布 → 网页
   └─ GitHub Actions (.github/workflows/feishu-notify.yml)：
         docs/latest.json 变更 → 跑 deliver.mjs → 发飞书卡片
   ▼
[飞书群]  收到卡片（标题+导语+「打开今日日报」按钮，链到 Pages）
```

**为什么飞书要绕道 GitHub Actions**：云端沙箱有**网络出口白名单**，`open.feishu.cn` 和 `api.coingecko.com` 都不在内，云端**连不上飞书域名**。GitHub Actions 的 runner 没有这个限制，所以发飞书的活儿交给它。（详见 §6 已知限制）

## 2. 关键坐标（出问题先看这些）

| 项 | 值 / 位置 |
|----|----------|
| GitHub 仓库 | https://github.com/dorischeyy/perp-daily （公开；owner=dorischeyy，协作者 doris7527=admin） |
| 网页（最新一期） | https://dorischeyy.github.io/perp-daily/ |
| 网页（某天永久页） | https://dorischeyy.github.io/perp-daily/archive/YYYY-MM-DD.html |
| 云端定时任务管理页 | https://claude.ai/code/routines/trig_01LyfiMiKQpNnaRHUsNoiv4B |
| 定时任务 ID | `trig_01LyfiMiKQpNnaRHUsNoiv4B` |
| 时间表 | cron `3 0 * * *`（UTC）= **北京每天 08:03** |
| 模型 / 环境 | claude-sonnet-4-6 / env `env_01NA7ZixfHx5Mru4RWEMwuBT` |
| GitHub Actions（发飞书） | 仓库 Actions 页 → 工作流 "Feishu Notify" |
| 飞书机器人 | 飞书目标群里的「自定义机器人」，webhook 存为 repo secret（见 §7） |

## 3. 文件清单（仓库内）

| 文件 | 作用 |
|------|------|
| `generate.md` | **核心**：云端每天执行的完整指令（身份/标准/时效门槛/分段/自检/发布全流程） |
| `sources.json` | 信源注册表（四层：官方/创始人/媒体/KOL/数据 × 中英区），含核心池 + data_pages + sourcing_rule |
| `benchmarks.md` | perp DEX 量/OI/费用的高中低梯队，数字判读用 |
| `build-html.mjs` | 内容 JSON → 杂志风 HTML（支持 body 分段数组 + **加粗**标签） |
| `fetch-data.mjs` | 拉 CoinGecko 免费数据 → data/market.json（curl 底层；云端常被白名单拦，见 §6） |
| `deliver.mjs` | 渠道无关交付：读 channels(.sample).json，curl POST 飞书/Slack 卡片 |
| `channels.sample.json` | 渠道配置样例（feishu 启用、slack 待命；webhook 用 `env:VAR` 引用） |
| `publish.sh` | 发布脚本：渲染 + 写 latest.json + push（**不再在云端发飞书**） |
| `.github/workflows/feishu-notify.yml` | push 到 docs/latest.json 时，由 GitHub 发飞书 |
| `docs/` | GitHub Pages 发布目录：index.html(最新) + archive/<date>.html + <date>-review.md(自评) + latest.json |
| `content.sample.json` | 内容结构样例 |

## 4. 每天发生什么（正常时序）

1. 08:03 北京，云端 Routine 触发。
2. 约 5–15 分钟后，仓库出现新 commit `report: YYYY-MM-DD`（含当天 html + 自评 + latest.json）。
3. GitHub Pages 约 1 分钟后更新网页。
4. GitHub Actions "Feishu Notify" 触发（绿勾），飞书群收到卡片。

## 5. 排错手册（症状 → 去哪查 → 怎么修）

### A. 飞书群没收到卡片
1. **看仓库今天有没有新 commit `report: <today>`**（github 仓库首页）：
   - **没有** → 是云端那次跑**自身失败/没跑**。去 §2 的定时任务管理页，看最近一次 run 的日志卡在哪（常见：克隆失败 / 调研超时 / 模型中断）。可手动重跑（§6 操作）。
   - **有 commit** → 进下一步。
2. **看 GitHub Actions "Feishu Notify" 这次运行**（仓库 Actions 页）：
   - **红叉** → 点开看错误。常见：`FEISHU_WEBHOOK secret 未设置`（去 §7 重设）/ 飞书返回非 0（webhook 失效或机器人被移出群 → 重建机器人拿新 webhook，更新 secret）。
   - **没有运行** → 说明这次 push 没改 `docs/latest.json`（publish.sh 没正常跑或没写 latest.json）。检查 publish.sh、手动重跑。
   - **绿勾但群里还是没有** → 极可能是**看错群**：webhook 只发到「创建那个自定义机器人的群」。确认你看的是那个群；或机器人已被移出群。
3. 兜底：本机 `cd ~/perp-daily && node deliver.mjs "标题" "链接" "导语"`（本机能连飞书）手动补发。

### B. 报告没生成 / 仓库没新 commit
→ 云端 Routine 跑挂了。去管理页看 run 日志。常见原因：GitHub token 失效（§7 轮换）、调研步骤超时。可手动重跑。

### C. 报告里有很久以前的旧闻
→ 时效门槛没生效。看 `generate.md` 的「时效门槛（混合制）」：新闻条目须 ≤72h，只允许 ≤1-2 条「本周主线」趋势条目（≤7 天）。也看当天 `docs/archive/<date>-review.md` 的"时效自查"表，确认 agent 有没有自查。

### D. 数字不准 / 写着"待核实"
→ `fetch-data.mjs` 在云端被出口白名单拦了（连不上 CoinGecko），agent 只能靠网页/标"待核实"兜底。这是已知限制（§6）。本机跑 fetch-data.mjs 是正常的。

### E. 自评文件(review)日期和报告对不上
→ 已修：agent 写 `review.draft.md`（不带日期），publish.sh 按权威日期改名。若又出现，检查 publish.sh 的改名逻辑和 agent 是否写了 review.draft.md。

## 6. 已知限制 / 约束（重要）

- **云端出口白名单**：云端沙箱只能访问白名单内的域名。**github.com 可以**（所以能 push），**open.feishu.cn、api.coingecko.com 不可以**。
  → 飞书已用 GitHub Actions 绕开；CoinGecko 数据在云端仍拉不到（agent 标"待核实"兜底）。
  → 彻底解法：在 claude.ai 的环境设置里把这两个域名加进 egress 白名单（若平台支持）。
- **无 X/Twitter API**：sources.json 的 handle 只是搜索线索，读不到原始推文。要真读推文需付费 X API（$100/mo）或第三方。
- **DefiLlama 衍生品 API 已转付费**，弃用，用 CoinGecko 免费替代。

## 7. 凭证清单（值不在本文件，本仓库公开）

| 凭证 | 用途 | 存在哪 | 怎么轮换 |
|------|------|--------|----------|
| GitHub Token | 云端 git clone/push | ① 云端 Routine 指令里（claude.ai 私有配置）② 本机 `~/perp-daily/.env` 的 `GITHUB_TOKEN` | 在 github.com/settings/tokens 重建（classic, `public_repo` 即可），更新这两处 |
| Feishu Webhook | 发飞书卡片 | ① **repo secret `FEISHU_WEBHOOK`**（GitHub Actions 用）② 本机 `~/perp-daily/.env` | 飞书群重建自定义机器人拿新 URL；`gh secret set FEISHU_WEBHOOK --repo dorischeyy/perp-daily --body "<新URL>"`；更新本机 .env |

> `~/perp-daily/.env` 和 `channels.json`、`content.json`、`data/` 都已 gitignore，不会进公开仓库。

## 8. 常见运维操作（命令）

```bash
# 改运行时间（例：改回每天北京 10:03 = UTC 02:03）——用 Claude 的 /schedule 或 RemoteTrigger 改 cron "3 2 * * *"
# 手动立即跑一次（验证）——用 RemoteTrigger run trigger_id=trig_01LyfiMiKQpNnaRHUsNoiv4B
# 手动补发某天飞书：
cd ~/perp-daily && node deliver.mjs "Perp DEX 日报 · 2026-06-21" "https://dorischeyy.github.io/perp-daily/archive/2026-06-21.html" "导语"
# 本地预览渲染：
node build-html.mjs content.sample.json /tmp/p.html && open /tmp/p.html
# 手动触发发飞书 Action（需 latest.json 已存在）：
gh workflow run feishu-notify.yml --repo dorischeyy/perp-daily
```

## 9. 改需求去改哪

- **日报内容标准 / 栏目 / 时效 / 自检规则** → `generate.md`（云端每天读它）
- **盯哪些账号/项目** → `sources.json`
- **量级判读基准** → `benchmarks.md`
- **网页样式/排版** → `build-html.mjs`（CSS 在文件内 `<style>`）
- **加交付渠道（如 Slack）** → `channels.json` 加一条 + 配 secret；deliver.mjs 已内置 slack 适配器
- **改这些后云端下次跑自动生效**（云端每次 clone 最新仓库），无需动定时任务；只有改"时间/模型/凭证"才需要改 Routine 本身。

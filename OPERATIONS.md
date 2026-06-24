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
   │     ├─ lib/build-html.mjs  : content.json → docs/archive/<date>.html + docs/index.html
   │     ├─ 把 review.draft.md 改名为 docs/archive/<date>-review.md（编辑自评，可审计）
   │     ├─ 写 docs/latest.json {date,url,title,lead}
   │     └─ git push（用内嵌的 GitHub token）
   ▼
[GitHub 仓库 dorischeyy/perp-daily]  push 触发两件事：
   ├─ GitHub Pages：从 main 分支 /docs 发布 → 网页
   └─ GitHub Actions (.github/workflows/feishu-notify.yml)：
         docs/latest.json 变更 → 跑 lib/deliver.mjs → 发飞书卡片
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
| `config/sources.json` | 信源注册表（四层：官方/创始人/媒体/KOL/数据 × 中英区），含核心池 + data_pages + sourcing_rule |
| `config/benchmarks.md` | perp DEX 量/OI/费用的高中低梯队，数字判读用 |
| `lib/build-html.mjs` | 内容 JSON → 杂志风 HTML（支持 body 分段数组 + **加粗**标签） |
| `lib/fetch-data.mjs` | 拉 CoinGecko 免费数据 → data/market.json（curl 底层；云端常被白名单拦，见 §6） |
| `lib/deliver.mjs` | 渠道无关交付：读 channels(.sample).json，curl POST 飞书/Slack 卡片 |
| `config/channels.sample.json` | 渠道配置样例（feishu 启用、slack 待命；webhook 用 `env:VAR` 引用） |
| `publish.sh` | 发布脚本：渲染 + 写 latest.json + push（**不再在云端发飞书**） |
| `.github/workflows/feishu-notify.yml` | push 到 docs/latest.json 时，由 GitHub 发飞书 |
| `docs/` | GitHub Pages 发布目录：index.html(最新) + archive/<date>.html + <date>-review.md(自评) + latest.json |
| `config/content.sample.json` | 内容结构样例 |

## 4. 每天发生什么（正常时序）

0. 07:30 北京，`market-data` Action 在 runner 上拉 CoinGecko 快照、提交 `docs/market.json`（绕过云端出口墙，让日报有真实数字）。
1. 08:03 北京，云端 Routine 触发（clone 时即读到 07:30 提交的 docs/market.json）。
2. 约 5–15 分钟后，仓库出现新 commit `report: YYYY-MM-DD`（含当天 html + 自评 + latest.json）。
3. GitHub Pages 约 1 分钟后更新网页。
4. GitHub Actions "Notify (Feishu + Slack)" 触发（绿勾），飞书 + Slack 收到卡片。
5. 10:30 北京，"Daily Watchdog" 自动自检：若今天没出报告，发告警卡到飞书+Slack。正常出报则静默不打扰。

## 4.5 可靠性兜底（自动，无需人工）

| 机制 | 在哪 | 作用 |
|------|------|------|
| **内容结构校验** | lib/validate-content.mjs（publish.sh validate 第一步） | 校验 content.json 字段齐全/URL 合法/日期格式，**坏结构阻断发布**，防漏到渲染崩溃 |
| **单元测试 + CI** | test/ + ci.yml | 每次代码 push 自动跑语法检查+单测+关卡冒烟，**坏提交进不了云端** |
| **行情预拉** | market-data.yml（cron 07:30 北京） | runner 拉 CoinGecko 提交 `docs/market.json`，**绕过云端出口墙**，让日报有真实数字（agent 读时先查 fetched_at，非今天按待核实） |
| **去重** | feishu-notify.yml 的 Gate 步 | 只在 `report:` 提交或手动触发(workflow_dispatch)时投递；对 latest.json 的其它改动跳过，**防一天多条**。再加 `concurrency` 防并发双发 |
| **漏报兜底** | daily-watchdog.yml（cron 10:30 北京） | 检查 `latest.json.date == 今天`，否则**让 Action 失败 → GitHub 自动邮件通知 owner**（不发飞书/Slack——那俩只接收日报）。防云端 Routine 静默失败漏一天 |
| **源健康监控** | feed-health.yml（cron 周一 09:00 北京） | 抓 feeds.rss，失活/陈旧/不可达就**让 Action 失败 → GitHub 通知**（同样不发飞书/Slack）。防源静默失活、日报少一路 |
| **投递重试** | lib/deliver.mjs send() | curl 瞬时失败自动重试 3 次，**防飞书/Slack 抖动丢卡** |
| **push 防假成功** | publish.sh | docs 无变更 / rebase 失败 / push 失败 都 `exit 1` 报错，**不再谎报「✅ 完成」** |

> **告警渠道原则**：飞书/Slack **只发日报**；所有运维告警（漏报、源失活、CI 失败）走 **GitHub Action 失败 → GitHub 邮件/Actions 页**，不污染日报渠道。
> 手动强制补发一次（绕过去重）：仓库 Actions 页 → "Notify (Feishu + Slack)" → Run workflow。

## 4.6 阶段化 resume（哪步坏跑哪步，不浪费 token）

管线解耦成「昂贵的 LLM 生成阶段」与「廉价的机械发布阶段」，交接物是 `content.json` / `threads.json` / `review.draft.md`。**机械阶段任何一步失败，只重跑那一步，绝不回去重新调研。**

| 失败在哪 | 现象 | 怎么 resume（零或极小 token） |
|----------|------|------------------------------|
| 时效/防造假关卡 | `bash publish.sh` 在 validate 卡住、exit 1 | **只改 content.json 对应条目**(砍/改 date)，`bash publish.sh validate` 复验，过了再 render+push。不重新调研 |
| 台账结构 | lib/threads.mjs 报字段错 | 按报错修 `threads.json`，`bash publish.sh validate` |
| 渲染 | build-html 报错 | `bash publish.sh render` |
| 提交/推送 | rebase/push 失败 | 修网络/token/冲突后 `bash publish.sh push`（已 render 不重做） |
| 飞书/Slack 没到 | 报告已 push 但群里没卡 | 交付层(Action)问题：Actions 页 "Run workflow" 重发，**不碰生成** |
| 云端 Routine 整体跑挂 | 没有 `report:` 提交 | 只有这种情况才需回步骤 1 重做内容（LLM 单程无中间 checkpoint，这是唯一不可避免的重跑点） |

> 阶段单独调用：`bash publish.sh validate | render | push | all`。每个机械脚本也能独立单跑：`node lib/check-freshness.mjs content.json` / `node lib/threads.mjs` / `node lib/build-html.mjs content.json out.html` / `node lib/deliver.mjs 标题 链接 摘要`。

## 5. 排错手册（症状 → 去哪查 → 怎么修）

### A. 飞书群没收到卡片
1. **看仓库今天有没有新 commit `report: <today>`**（github 仓库首页）：
   - **没有** → 是云端那次跑**自身失败/没跑**。去 §2 的定时任务管理页，看最近一次 run 的日志卡在哪（常见：克隆失败 / 调研超时 / 模型中断）。可手动重跑（§6 操作）。
   - **有 commit** → 进下一步。
2. **看 GitHub Actions "Feishu Notify" 这次运行**（仓库 Actions 页）：
   - **红叉** → 点开看错误。常见：`FEISHU_WEBHOOK secret 未设置`（去 §7 重设）/ 飞书返回非 0（webhook 失效或机器人被移出群 → 重建机器人拿新 webhook，更新 secret）。
   - **没有运行** → 说明这次 push 没改 `docs/latest.json`（publish.sh 没正常跑或没写 latest.json）。检查 publish.sh、手动重跑。
   - **绿勾但群里还是没有** → 极可能是**看错群**：webhook 只发到「创建那个自定义机器人的群」。确认你看的是那个群；或机器人已被移出群。
3. 兜底：本机 `cd ~/perp-daily && node lib/deliver.mjs "标题" "链接" "导语"`（本机能连飞书）手动补发。

### B. 报告没生成 / 仓库没新 commit
→ 云端 Routine 跑挂了。去管理页看 run 日志。常见原因：GitHub token 失效（§7 轮换）、调研步骤超时。可手动重跑。

### C. 报告里有很久以前的旧闻
→ 时效门槛没生效。看 `generate.md` 的「时效门槛（混合制）」：新闻条目须 ≤72h，只允许 ≤1-2 条「本周主线」趋势条目（≤7 天）。也看当天 `docs/archive/<date>-review.md` 的"时效自查"表，确认 agent 有没有自查。

### D. 数字不准 / 写着"待核实"
→ `lib/fetch-data.mjs` 在云端被出口白名单拦了（连不上 CoinGecko），agent 只能靠网页/标"待核实"兜底。这是已知限制（§6）。本机跑 lib/fetch-data.mjs 是正常的。

### E. 自评文件(review)日期和报告对不上
→ 已修：agent 写 `review.draft.md`（不带日期），publish.sh 按权威日期改名。若又出现，检查 publish.sh 的改名逻辑和 agent 是否写了 review.draft.md。

### F. 云端 push 被 403 拦 / 当天漏发（relay proxy 仓库授权，2026-06-24 事故）
**症状**：云端 Routine 日志显示**内容生成成功**（content.json/threads.json/commit 都在），但最后 `git push` 报
`Anthropic relay proxy 403` 或 `{"type":"permission_error","message":"Not authorized to access repository dorischeyy/perp-daily"}`；
GitHub 上没有 `report:` 提交，feishu-notify 不触发，群里漏发。

**根因（平台侧机制变更，重要）**：原方案靠**内嵌 GITHUB_TOKEN 直推 github.com**（不依赖 GitHub App）。
但平台已强制把云端 session 所有 git 流量经 `url.insteadOf` 改道到 **Anthropic git relay proxy**（`http://127.0.0.1:41729/git/`），
代理按**会话级仓库白名单**放行，白名单 = **Claude GitHub App 的安装仓库授权**，与内嵌 token 无关（token 没用上就被代理 403）。
即旧的「内嵌 token 直推」被代理架空了。

**真正缺口**：Claude 在该账号只做了 **OAuth 授权**（`github.com/settings/installations` 的 *Authorized GitHub Apps* tab 有 Claude）
但 **GitHub App 没安装**（*Installed GitHub Apps* tab 空）。OAuth 只给读、App 安装才给仓库级写/push（参考 anthropics/claude-code issue #57009）。
注意 claude.ai → Customize → Connectors 里 GitHub 显示「已连接」是**假象**，只连了 OAuth 半边、漏了 App 安装。

**修复（一次性，已于 2026-06-24 完成）**：
1. 浏览器登录 **dorischeyy**（perp-daily 所有者，别用工作号 doris7527）。
2. 打开 `https://github.com/apps/claude` → 绿色 **Install**（已装则显示 Configure）。
3. 选 **dorischeyy** 账号 → Repository access 选 **All repositories**（或 Only select + 勾 perp-daily），需含 *read+write to code* → **Save**。
4. 装完 `Installed GitHub Apps` tab 应出现 Claude；relay proxy 拿到 App 安装令牌后云端 push 恢复。
5. 验证：**不要当天手动重跑 Routine**（会重复出报），等次日 08:03 自动跑那次验证；watchdog（北京 10:30）失败会发邮件兜底。

**当天漏发的应急补发（本地全流程重做，云端内容捞不回）**：
Resumed session 会起新沙箱重新 clone、又被 403，旧沙箱已回收，所以**生成好的 content.json 找不回**，只能本地重做：
```bash
cd ~/perp-daily && git pull --ff-only           # 取当天 docs/market.json（market-data Action 北京07:30预拉，fetched_at 须为当天）
# 按 generate.md：WebFetch config/sources.json 的 feeds.rss 逐条核 verbatim 发布日，砍 >72h（警惕旧文被搜索索引）
# 写 content.json / threads.json / review.draft.md
bash publish.sh validate && bash publish.sh render && bash publish.sh push   # 本机推送不过 relay proxy、无此限制
# push 触发 feishu-notify.yml 自动发飞书+Slack
```
本机 push 不走 relay proxy，所以本地补发不受此 bug 影响（这是漏发当天的可靠兜底通道）。

## 6. 已知限制 / 约束（重要）

- **云端出口白名单**：云端沙箱只能访问白名单内的域名。**github.com 可以**（所以能 push），**open.feishu.cn、api.coingecko.com 不可以**。
  → 飞书已用 GitHub Actions 绕开；CoinGecko 数据在云端仍拉不到（agent 标"待核实"兜底）。
  → 彻底解法：在 claude.ai 的环境设置里把这两个域名加进 egress 白名单（若平台支持）。
- **无 X/Twitter API**：config/sources.json 的 handle 只是搜索线索，读不到原始推文。要真读推文需付费 X API（$100/mo）或第三方。
- **DefiLlama 衍生品 API 已转付费**，弃用，用 CoinGecko 免费替代。
- **云端 git 走 relay proxy（仓库授权前置）**：平台强制云端 session 的 git 经 Anthropic relay proxy，按 **Claude GitHub App 安装授权**放行，不再认内嵌 token。前置条件：Claude App 必须**安装**（非仅 OAuth 授权）在 perp-daily 所有者账号 dorischeyy 上并有写权限。详见 §5.F。本机 push 不受此限制。

## 7. 凭证清单（值不在本文件，本仓库公开）

| 凭证 | 用途 | 存在哪 | 怎么轮换 |
|------|------|--------|----------|
| GitHub Token | 云端 git clone/push | ① 云端 Routine 指令里（claude.ai 私有配置）② 本机 `~/perp-daily/.env` 的 `GITHUB_TOKEN` | 在 github.com/settings/tokens 重建（classic, `public_repo` 即可），更新这两处 |
| Feishu Webhook | 发飞书卡片 | ① **repo secret `FEISHU_WEBHOOK`**（GitHub Actions 用）② 本机 `~/perp-daily/.env` | 飞书群重建自定义机器人拿新 URL；`gh secret set FEISHU_WEBHOOK --repo dorischeyy/perp-daily --body "<新URL>"`；更新本机 .env |

> `~/perp-daily/.env`、`content.json`、`data/` 已 gitignore，不会进公开仓库。`config/channels.json` 已提交（只含 `env:VAR` 引用，无明文密钥），供 GitHub Action 读取渠道开关。

## 8. 常见运维操作（命令）

```bash
# 改运行时间（例：改回每天北京 10:03 = UTC 02:03）——用 Claude 的 /schedule 或 RemoteTrigger 改 cron "3 2 * * *"
# 手动立即跑一次（验证）——用 RemoteTrigger run trigger_id=trig_01LyfiMiKQpNnaRHUsNoiv4B
# 手动补发某天飞书：
cd ~/perp-daily && node lib/deliver.mjs "Perp DEX 日报 · 2026-06-21" "https://dorischeyy.github.io/perp-daily/archive/2026-06-21.html" "导语"
# 本地预览渲染：
node lib/build-html.mjs config/content.sample.json /tmp/p.html && open /tmp/p.html
# 手动触发发飞书 Action（需 latest.json 已存在）：
gh workflow run feishu-notify.yml --repo dorischeyy/perp-daily
```

## 9. 改需求去改哪

- **日报内容标准 / 栏目 / 时效 / 评分 / 串联 / 自检规则** → `generate.md`（云端每天读它）
- **编辑方法论（评分体系/故事线/守门，对外说明）** → `METHODOLOGY.md`
- **故事线台账（在追哪些线、节奏、进展）** → `threads.json`（agent 每天读写；`lib/threads.mjs` 校验+提醒）
- **盯哪些账号/项目** → `config/sources.json`
- **量级判读基准** → `config/benchmarks.md`
- **网页样式/排版（含「持续追踪」块）** → `lib/build-html.mjs`（CSS 在文件内 `<style>`）
- **加交付渠道（如 Slack）** → `config/channels.json` 加一条 + 配 secret；lib/deliver.mjs 已内置 slack 适配器
- **改这些后云端下次跑自动生效**（云端每次 clone 最新仓库），无需动定时任务；只有改"时间/模型/凭证"才需要改 Routine 本身。

## 10. 编辑机制速查（评分 + 故事线）

- **评分**：每条新闻按 结构性30/相关度25/持续性20/可行动性15/量级×可信度10 打分(0-100)。S≥90 建线追踪，A 75-89 重点，B 60-74 收录，<60 砍。明细落在当天 `<date>-review.md`。
- **故事线**：S 级或多周叙事事件进 `threads.json`，按 cadence 复盘、跨日 recall。`lib/threads.mjs` 每天列"到期该复盘的线"。呈现=报告顶部「持续追踪」块 + 新闻内联回扣，反冗余铁律(只写 delta、≤3-4 条)。
- **排错**：报告里故事线串得冗余/漏串 → 看当天 review 的「故事线连续性检查」；台账写坏导致发布被 `lib/threads.mjs` 拦 → 看报错字段修 `threads.json`。完整说明见 `METHODOLOGY.md`。

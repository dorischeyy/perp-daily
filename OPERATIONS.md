# Perp DEX 日报运维手册

这份文档描述当前 Codex 日报工作流。仓库公开，不记录密钥、Token、Webhook 或账号认证方式。

## 1. 固定边界

- 唯一仓库：`dorischeyy/perp-daily`
- 唯一发布分支：`main`
- 北京日期为日报权威日期
- 日常发布只使用 GitHub 连接器，不使用 `gh`、PAT、本地 Git 凭证、`.env` 或其他账号
- 不改 GitHub Actions、仓库设置、Secrets、定时计划、渠道配置和技能
- Pages、飞书和 Slack 由仓库现有工作流处理，日报任务不直接访问 Webhook
- 工作区若有无法解释的改动，立即停止，不覆盖、不清理

## 2. 当前数据流

```text
Codex Automation
  运行前检查
  调研与来源核实
  评分、故事线、写作、自评
  结构、编辑、时效、台账校验
  本地渲染
  GitHub 连接器提交 main
      GitHub Pages
      Feishu / Slack delivery workflow
```

日常提交信息固定为 `report: YYYY-MM-DD`。维护类修改使用 `fix:`、`feat:` 或 `chore:`，不会冒充日报提交。

## 3. 每日标准流程

### 3.1 先检查，不联网

读取：

- `OPERATIONS.md`
- `generate.md`
- `METHODOLOGY.md`
- `config/sources.json`
- `config/benchmarks.md`
- `threads.json`
- `docs/latest.json`
- `docs/market.json`
- 最近最多 3 天的日报与编辑自评

然后运行：

```bash
node lib/check-run-state.mjs YYYY-MM-DD
```

结果：

- `ALREADY_PUBLISHED`，退出码 10：今天已发布，无改动停止
- `READY`，退出码 0：可以调研
- 行情陈旧或缺失：允许继续，但不得使用 `docs/market.json` 数字
- 状态文件异常，退出码 1：停止并报告预检阶段失败

这个检查必须发生在昂贵研究之前。

### 3.2 调研与写作

严格执行 `generate.md`：

1. 打开真实来源页核实发布日期，搜索摘要不能作为日期证据。
2. 独立新闻不超过 72 小时，本周主线不超过 7 天。
3. 每条候选按五维评分，低于 B 级原则上不收。
4. 只给真实 delta 更新 `threads.json`。
5. 产出 `content.json`、`threads.json`、`review.draft.md`。
6. 一条内容混用多份材料时，主来源写 `source/url/date`，补充材料写 `references`。
7. 「机会与打法」最多 3 条，严格使用好处、限制、对 HertzFlow 三段，且必须由当期新闻触发；不强行制造“现在做”或动作项。
8. lead 用 1-2 句概括当期最重要的 2-3 个新闻主体、动作与阶段；可以补总判断，但不得只写脱离新闻要点的抽象概括。

### 3.3 校验与渲染

```bash
bash publish.sh validate
bash publish.sh render
npm test
npm run check
cmp -s docs/index.html docs/archive/YYYY-MM-DD.html
```

`validate` 顺序：

1. `lib/validate-content.mjs`：结构、日期、URL、补充来源
2. `lib/check-editorial.mjs`：语义重复、context 重复、机会项格式与相关性
3. `lib/check-freshness.mjs`：时效与 URL 日期一致性
4. `lib/threads.mjs`：故事线结构与到期提醒

还要检查：

- 页面无横向溢出
- 首页与当日归档一致
- 页面没有 `kicker`、旧标题「对 Hertzflow 的启发」或重复双语标签
- lead 能独立说明当期最重要的新闻要点，不是“竞争升级、格局变化”式抽象口号
- lead 只保留摘要层事实，没有复制持续追踪、正文、context 或机会与打法的精确数字和机制细节
- 全文没有禁用长破折号

### 3.4 发布

所有关卡通过后，使用 GitHub 连接器：

1. 再读远端 `main`，确认没有竞态。
2. 上传完整日报产物与必要的规则、台账变更。
3. 创建一次 `report: YYYY-MM-DD` 提交并快进 `main`。
4. 远端核验 commit、`docs/latest.json`、归档 HTML 和关键栏目。
5. 报告 commit URL、公开日报 URL、验证结果和投递是否被触发。

不得使用本地 `git push` 代替连接器。`publish.sh push` 仅供仓库里的手动 Legacy GitHub Actions fallback 使用，不是 Codex 日常路径。

## 4. 幂等、竞态和本地状态

- `docs/latest.json.date` 已等于北京今天：无改动停止。
- 发布前远端 `main` 已变化：重新读取变更，只合并本任务范围；无法安全合并则停止。
- GitHub 连接器更新远端后不会移动当前本地 `.git/HEAD`。因此本地可能继续显示本轮已发布文件为 modified/untracked。
- 遇到这种情况，先用远端 commit 和文件 blob 核验是否正是本轮产物。只有确认完全对应后，才把它视为已发布基线；任何额外文件仍按无关改动停止处理。
- 不用 `git reset`、`git checkout` 或删除文件来伪造干净状态。

## 5. 分阶段恢复

昂贵研究与机械发布之间的持久交接物是 `content.json`、`threads.json`、`review.draft.md`。失败时只修失败阶段。

| 失败阶段 | 恢复动作 |
|---|---|
| 运行前检查 | 修复或确认 `latest.json`、日期、行情状态，不开始研究 |
| 来源核实 | 只重做未核实来源；来源日期不明就砍条目 |
| 内容结构或编辑关卡 | 只改报错 item，再跑 `bash publish.sh validate` |
| 时效关卡 | 砍掉旧闻或修正真实日期，不重做其他研究 |
| 台账关卡 | 只修 `threads.json` 对应字段 |
| 渲染 | 只跑 `bash publish.sh render` |
| GitHub 连接器发布 | 保留本地产物，只重试远端 publication |
| Pages 或投递 | 查看仓库既有工作流，不重做日报，不直接调用渠道 Webhook |

失败时保留生成产物，并准确报告失败阶段、错误和已经通过的关卡。

## 6. 关键文件

| 文件 | 作用 |
|---|---|
| `generate.md` | 每日研究、筛选、写作、自评和发布约束 |
| `METHODOLOGY.md` | 对外编辑方法论 |
| `config/sources.json` | 信源注册表 |
| `config/benchmarks.md` | 量、OI、费用的判读锚点 |
| `threads.json` | 跨日故事线台账 |
| `lib/check-run-state.mjs` | 调研前幂等和行情状态检查 |
| `lib/validate-content.mjs` | 内容结构与来源字段校验 |
| `lib/check-editorial.mjs` | 编辑去重与机会项关卡 |
| `lib/check-freshness.mjs` | 时效和日期防造假 |
| `lib/threads.mjs` | 台账校验与到期提醒 |
| `lib/build-html.mjs` | HTML 渲染 |
| `publish.sh` | 分阶段机械校验、渲染与 Legacy fallback |
| `docs/latest.json` | 最新日报索引 |
| `docs/archive/` | 每日 HTML 和编辑自评 |

## 7. 关键地址

- 仓库：https://github.com/dorischeyy/perp-daily
- 最新日报：https://dorischeyy.github.io/perp-daily/
- 日期归档：`https://dorischeyy.github.io/perp-daily/archive/YYYY-MM-DD.html`
- Actions：https://github.com/dorischeyy/perp-daily/actions

## 8. 修改边界

- 内容标准、栏目和自检：改 `generate.md`
- 编辑方法论：改 `METHODOLOGY.md`
- 结构和编辑硬关卡：改 `lib/` 并补 `test/`
- 页面样式：改 `lib/build-html.mjs` 并做桌面、移动端渲染检查
- 定时、Actions、仓库设置、Secrets、渠道：不属于日报日常维护，必须单独明确授权

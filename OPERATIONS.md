# Perp DEX 日报运维手册

这份文档描述当前 Codex 日报工作流。仓库公开，不记录密钥、Token、Webhook 或账号认证方式。

## 1. 固定边界

- 唯一仓库：`dorischeyy/perp-daily`
- 唯一发布分支：`main`
- 连接器可使用固定内部组装分支 `codex-report-staging`；该分支不触发交付，不能作为公开发布结果
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
4. Perp DEX、Launchpad、Crypto、AI 四个新闻栏目每天都必须有 3–5 条；某栏不足 3 条时阻断发布，不用旧闻或低分内容凑数。
5. 只给真实 delta 更新 `threads.json`。
6. 产出 `content.json`、`threads.json`、`review.draft.md`。
7. 一条内容混用多份材料时，主来源写 `source/url/date`，补充材料写 `references`。
8. 不再生成或展示顶部 `product_view`；导语后直接进入「今日进展」或新闻栏目。
9. 不生成「二阶效应」独立段，也不生成末尾「产品判断」栏目；必要的事实边界并入事件、机制或 context。
10. lead 只用一句话概括近期市场情况，必须由当期最重要的 2-3 个新闻主体、动作与阶段归纳而来，不得写脱离新闻要点的抽象口号。
11. 顶部「今日进展」只展示当天有可核验新事实、且未由正文承载的故事线；到期无新闻不展示，同日多条线有变化就同时展示。
12. 每日竞争扫描必须覆盖直接 Perp DEX、CEX、钱包/经纪商、预测市场与传统衍生品、代币化资产、清算/预言机等基础设施和新交易项目，不能把竞品等同于同类协议。

### 3.3 校验与渲染

```bash
bash publish.sh validate
bash publish.sh render
bash publish.sh manifest
npm test
npm run check
cmp -s docs/index.html docs/archive/YYYY-MM-DD.html
```

`validate` 顺序：

1. `lib/validate-content.mjs`：结构、日期、URL、补充来源
2. `lib/check-editorial.mjs`：语义重复、context 重复、已取消版式回归
3. `lib/check-review.mjs`：读者价值自问与编辑自评完整性
4. `lib/check-freshness.mjs`：时效与 URL 日期一致性
5. `lib/threads.mjs`：故事线结构与到期提醒

还要检查：

- 页面无横向溢出
- 首页与当日归档一致
- 页面没有 `kicker`、旧标题「对 Hertzflow 的启发」或重复双语标签
- lead 只有一句，能独立说明近期市场情况和当期最重要的新闻要点，不是“竞争升级、格局变化”式抽象口号
- lead 只保留摘要层事实，没有复制今日进展、正文或 context 的精确数字和机制细节
- 页面不含 `product_view`、「二阶效应」或「产品判断」，导语后直接进入新闻内容
- 今日进展每条都有 `date/source/url`，没有“尚未变化”“等待某日”“继续关注”等占位状态
- 全文没有禁用长破折号

### 3.4 发布

所有关卡通过后，使用 GitHub 连接器。发布采用「远端 staging 分支组装，`main` 只更新一次」协议：

1. 运行 `bash publish.sh manifest`，保存固定五文件的 `bytes`、`base64_chars` 和 `blob_sha`。清单之外的文件不得进入日报发布。
2. 用连接器读取远端 `main` 的当前 commit SHA，并从这个精确 SHA 创建或重置固定分支 `codex-report-staging`。禁止从本地 `HEAD`、本地 `origin/main` 或本地根 tree 重建远端仓库。
3. 只在 staging 分支依次写入清单中的五个文件。写入前必须确认读取到的完整字节数等于 manifest 的 `bytes`；若通过 base64 中转，去掉空白后的字符数必须等于 `base64_chars`。不得把被终端截断的输出交给连接器。
4. 每写完一个文件，立即核对连接器返回的 blob SHA 等于 manifest 的 `blob_sha`。不相等就停止，不能更新 `main`。
5. `docs/latest.json` 最后写入，最后一条 staging commit 的信息固定为 `report: YYYY-MM-DD`。之前的 staging commit 使用 `chore: stage report YYYY-MM-DD`。
6. 用连接器比较原 `main` 与 staging：必须恰好只有 manifest 的五个文件发生变化，不能删除或改动 `content.json`、`docs/market.json`、工作流、规则或其他路径。
7. 再读一次远端 `main`。它仍等于步骤 2 的父 SHA 时，才用非 force 快进把 `main` 更新到 staging 头；远端若已变化，重新基于新 `main` 组装 staging，不能覆盖竞态。
8. 更新 `main` 后，回读五个文件并再次逐项核对 blob SHA；同时确认 `docs/latest.json.date` 等于北京今天。全部一致才算发布成功。
9. 远端 blob 与本地产物逐项一致后，只暂存本轮已发布文件，在本地创建同名 `report: YYYY-MM-DD` 镜像提交，使工作区恢复干净。这个本地提交不推送，远端连接器状态仍是发布权威。
10. 报告 commit URL、公开日报 URL、验证结果和投递是否被触发。

### 3.4.1 发布硬禁令与时间预算

- 禁止用本地目录树作为远端 `base_tree`，也禁止从本地文件列表重建远端根树。远端可能有本地镜像没有的行情快照或历史跟踪文件。
- 禁止未核对长度和 blob SHA 就上传大文件。`threads.json` 必须同时通过本地台账校验、manifest 长度检查和远端 blob 校验。
- 禁止在连接器超时后盲目重放写操作。先回读 staging 或 `main` 判断上一次调用是否已经生效；未生效时最多重试一次。
- 连接器发布阶段时间预算为 20 分钟。超过预算就保留本地产物，准确报告停在 staging、快进或远端核验哪一步，不重新研究，也不继续无限重试。
- `main` 只能在 staging 五文件完整、比较结果精确、远端父 SHA 未变化后更新一次。这样 Pages、CI 和飞书/Slack 只看到完整日报状态。

不得使用本地 `git push` 代替连接器。`publish.sh push` 仅供仓库里的手动 Legacy GitHub Actions fallback 使用，不是 Codex 日常路径。

## 4. 幂等、竞态和本地状态

- `docs/latest.json.date` 已等于北京今天：无改动停止。
- 发布前远端 `main` 已变化：重新读取变更，只合并本任务范围；无法安全合并则停止。
- GitHub 连接器更新远端后不会移动当前本地 `.git/HEAD`。因此本地可能继续显示本轮已发布文件为 modified/untracked。
- 遇到这种情况，先用远端 commit 和文件 blob 核验是否正是本轮产物。只有确认完全对应后，才把本轮已发布文件提交为本地镜像基线；任何额外文件仍按无关改动停止处理，不能混入镜像提交。
- 本地镜像提交只用于保持工作区干净，可以与连接器创建的远端提交拥有不同 SHA。不得把它推到 GitHub，也不得用本地 `origin/main` 是否新鲜代替连接器远端核验。
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
| `lib/check-editorial.mjs` | 编辑去重与版式回归关卡 |
| `lib/check-review.mjs` | 读者价值自问与编辑自评完整性关卡 |
| `lib/check-freshness.mjs` | 时效和日期防造假 |
| `lib/threads.mjs` | 台账校验与到期提醒 |
| `lib/build-html.mjs` | HTML 渲染 |
| `lib/build-publish-manifest.mjs` | 固定五文件发布清单、长度与 Git blob SHA 关卡 |
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

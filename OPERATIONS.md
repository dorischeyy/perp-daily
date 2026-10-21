# Perp DEX 日报运维手册

这份文档描述当前 Codex 日报工作流。仓库公开，不记录密钥、Token、Webhook 或账号认证方式。

## 1. 固定边界

- 唯一仓库：`dorischeyy/perp-daily`
- 唯一发布分支：`main`
- 连接器通过 Git 对象 API 基于当前远端 `main` 组装并原子快进，不依赖 staging 分支
- 北京日期为日报权威日期
- 日常发布只使用 GitHub 连接器，不使用 `gh`、PAT、本地 Git 凭证、`.env` 或其他账号
- 不改 GitHub Actions、仓库设置、Secrets、定时计划、渠道配置和技能
- Pages、飞书和 Slack 由仓库现有工作流处理，日报任务不直接访问 Webhook
- 工作区既有改动先识别并可恢复地保存或隔离，不混入日报提交，不因可恢复的本地脏状态停止整个任务

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

2026-10-20用户指定：当天所有日报升级不向Slack发送新消息。本轮仅修改本地规则、程序、测试与预览，不重发今天报告、不推送`docs/latest.json`、不手动触发通知或Legacy生成流程，不直接运行交付脚本。此要求不代表关闭以后正常日报投递，也不修改渠道配置。

## 3. 每日标准流程

### 3.1 先检查，不联网

读取：

- `OPERATIONS.md`
- `generate.md`
- `METHODOLOGY.md`
- `config/sources.json`
- `config/project-radar.json`
- `config/research-playbook.md`
- `config/benchmarks.md`
- `threads.json`
- `docs/latest.json`
- `docs/market.json`
- 最近 3 期正文与最近 7 期自评 A4 项目发现、A5 AI候选筛选记录

然后运行：

```bash
node lib/check-run-state.mjs YYYY-MM-DD
```

结果：

- `ALREADY_PUBLISHED`，退出码 10：今天已发布，无改动停止
- `READY`，退出码 0：可以调研
- 行情陈旧或缺失：允许继续，但不得使用 `docs/market.json` 数字
- 状态文件异常，退出码1：暂停研究，先诊断并修复可恢复状态，再重跑预检；仅在授权边界内无法解决时报告精确阻断和恢复点

这个检查必须发生在昂贵研究之前。

### 3.2 调研与写作

严格执行 `generate.md`：

1. 打开真实来源页核实发布日期，搜索摘要不能作为日期证据。
2. 独立新闻不超过72小时，真实多事件本周主线沿用7天例外，AI同样适用。AI固定3条不能靠单一旧事件或研究改名补足。非AI项目研究保留来源真实发布日期、单列当天核验日，允许无日期机制文档，讨论证据最多30天。
3. 每条候选按结构性30、相关度25、持续性20、可行动性15、证据质量10评分。非AI低于B级原则上不收；AI合并同事件后选最高分的3条，整数`importance_score`须为75至100并降序。
4. 2026-10-21起使用`editorial_version:2`。非AI按当天材料动态分类，不固定栏目、每栏条数或研究配额；AI固定唯一`id: "ai"`，恰好3条`kind: "news"`，所有`domain: "ai"`或`"crypto-ai"`条目均归此栏。候选不足3条继续检索，不降门槛、不凑低价值内容或假日期。每条声明Crypto/AI关联及具体价值。
5. 只给真实 delta 更新 `threads.json`。
6. 产出 `content.json`、`threads.json`、`review.draft.md`。
7. 一条内容混用多份材料时，主来源写`source/url/date`，补充材料写`references`。主源、补源和讨论原文的所有URL合并去重，页面只显示一行“来源 1 2 3…”，完整名称、真实日期、核验日及已有作者关系保留在链接`title`和`aria-label`，不另显示“补充”行。
8. 导语后直接进入动态栏目，不生成`product_view`或`threads`展示快照；台账独立维护。
9. 每条为完整标题和70至150字单段正文，不生成机制、事件、影响等小抬头或context。新闻先说明真实变化和适用范围，再补必要机制；研究先写用户怎么操作，再解释与有来源的主流同类模式有什么差别。用具体行为和结果说明特点，不以抽象对仗或夸大复杂性代替说明。内部研究底稿不渲染。
10. lead聚焦一个主重点，直接给事实支撑的结论或分析结果及必要边界。1至2短句共20至120字，单句不超过70字，不写导读或研究计划。禁“更值得研究的是”“更值得关注的是”“这期先看”“这一期先看”“今天先看”“本文将”“让我们来看看”等；不堆机构名、术语或不相关事件，旧机制不包装成当天变化。
11. 标题12至90字。新闻交代时间、项目、真实事件，event_date与标题对应；无新事件的机制研究标题不带日期。仅真正的数据快照研究使用snapshot_date及“截至”对应日期，该字段与event_date互斥，不晚于报告日。checked_at只留在底稿或来源元数据，不冒充内容变化或数据日。
12. 每日竞争扫描必须覆盖直接 Perp DEX、CEX、钱包/经纪商、预测市场与传统衍生品、代币化资产、清算/预言机等基础设施和新交易项目，不能把竞品等同于同类协议。
13. 先运行`node lib/research-plan.mjs YYYY-MM-DD`，按项目、别名、讨论者、GTM与机制搜索，再RSS补漏；至少两条名单外发现查询写入自评A4。
14. 区分现货基础设施、预测市场和交易前端等内部类型，但不把这些类型固定成栏目。研究底稿保留比较判断、讨论证据及未知项，成稿按价值取舍并标清推断。
15. 执行计划中的`ai_daily_scan`，Anthropic、OpenAI、Scale AI、xAI、Kimi、DeepSeek、Qwen每天全部扫描，不参与Perp轮换，不要求每家每天发一条。精确名与别名做中英两组搜索，3天窗口覆盖发布/模型能力/API可用性及定价/安全/真实采用；先发现再读取官方页，不凭印象写URL。
16. 自评在A4后、B前使用精确标题`## A5 AI候选筛选`，含`### 厂商覆盖`、`### 前三条与取舍`。按七个标准名称记录具体查询、来源、结果及未入选原因；列候选五维得分与合计、同事件合并、降序排序、前三条胜出和其他候选排除理由，核对正文3条与`importance_score`一致。评分和真实价值必须人工审计，不能只写已覆盖。
17. 以2026-10-21确认的约9条为篇幅参考，AI固定3条，非AI约6条按材料浮动，不设凑数硬门槛。主动覆盖当日合约成交走势、产品变化和用户活动，避免只剩既有机制研究；数据须有实际快照时间及同口径参照，不把成交额当净入金或重复旧榜单。

### 3.3 校验与渲染

```bash
bash publish.sh validate
bash publish.sh render
bash publish.sh manifest
npm test
npm run check
cmp -s docs/index.html docs/archive/YYYY-MM-DD.html
```

本地若存在`.env`，不要直接运行全量`npm test`，交付模块的导入会自动尝试读取它。使用不含`.env`、渠道配置或凭证的临时目录，显式复制`lib/`、`test/`、`package.json`及所需公开测试fixture后运行；不要执行交付CLI。只运行编辑/结构/渲染相关测试时不涉及交付模块。

`validate` 顺序：

1. `lib/validate-content.mjs`：非AI动态栏目、AI固定3条news及75至100整数降序、domain归栏、Crypto/AI关联声明、事件/快照/无日期机制标题区分、70至150字正文、URL与内部研究证据
2. `lib/check-editorial.mjs`：可见正文去重、重复项目与已取消版式回归，不将v2内部底稿与正文误判为页面重复
3. `lib/check-review.mjs`：读者价值自问与编辑自评完整性，传入content.json检查v2项目发现A4及其后、B前的AI筛选A5，七家覆盖与前三条取舍
4. `lib/check-freshness.mjs`：新闻时效、研究当日核验、URL日期一致性，拒绝未来日期
5. `lib/threads.mjs`：故事线结构与到期提醒

还要检查：

- 页面无横向溢出
- 首页与当日归档一致
- 页面没有 `kicker`、旧标题「对 Hertzflow 的启发」或重复双语标签
- lead直接给出已获事实支持的结论或分析结果，必要时第二句补边界；不是导读、研究计划或多条新闻目录，不使用未解释术语或抽象口号，旧机制没有被包装成当天事件
- lead为1至2短句、20至120字、单句不超过70字，保留结论必要事实但不复制正文细节，也不含禁用引导语
- 页面不含 `product_view`、「二阶效应」或「产品判断」，导语后直接进入新闻内容
- 非AI栏目名称、数量和顺序由当天有效材料决定；AI仅一个`id: "ai"`栏目且恰好3条真实新闻，ai/crypto-ai不流入其他栏目，分数75至100整数降序，无同事件重复
- 每条仅完整标题、70至150字单段正文和一行“来源 1 2 3…”，无机制/影响等小抬头、context或内部研究字段，不另显示“补充”行
- 新闻先讲清新增、取消或调整了什么，再解释机制；没有新事件的研究不硬加核验日期，快照日期对应真实数据。机制说明用用户动作、资金去向和同类模式对照，不靠“X不等于Y”式口号制造深度；不得无证据概括所有主流平台或夸大独特性
- 所有出处URL去重后保留；来源完整名称、真实发布日期、核验日与已有作者关系可从链接title/aria-label读取，无日期机制文档不伪装成当日发布；顶部不额外展示今日进展
- 全文没有禁用长破折号

### 3.4 发布

所有关卡通过后，使用 GitHub 连接器对象 API，基于当前远端父提交组装完整报告，`main` 只更新一次，不依赖 staging 分支：

1. 运行 `bash publish.sh manifest`，保存固定五文件的 `bytes`、`base64_chars` 和 `blob_sha`。清单之外的文件不得进入日报发布。
2. 用连接器读取远端 `main` 的当前 commit SHA 及其 tree SHA。禁止从本地 `HEAD`、本地 `origin/main` 或本地根 tree 重建远端仓库。
3. 为清单五文件创建 blob。写入前确认完整字节数等于 manifest 的 `bytes`；base64中转去空白后的字符数必须等于 `base64_chars`。不得上传被终端截断的内容。
4. 每个创建或回读的 blob SHA 必须等于 manifest 的 `blob_sha`；不一致时修复该文件传输并重验，不得更新 `main`。
5. 以步骤2的远端 tree 为 base tree，只覆盖五个清单路径，再创建一个以步骤2 commit为唯一父提交、信息为 `report: YYYY-MM-DD` 的提交。
6. 用连接器比较父提交与新提交：必须恰好只有 manifest 的五个文件变化，不能删除或改动 `content.json`、`docs/market.json`、工作流、规则或其他路径。
7. 再读远端 `main`，仍等于步骤2父SHA时，用 `force:false` 和 `expected_sha` 快进至新提交。远端若变化，读取变更并基于新main重建tree/commit，复用已验证blob，重做比较，不覆盖竞态。若今日已由其他运行发布，回读验证后停止重复发布。
8. 更新 `main` 后，回读五个文件并再次逐项核对 blob SHA；同时确认 `docs/latest.json.date` 等于北京今天。全部一致才算发布成功。
9. 远端 blob 与本地产物逐项一致后，只暂存本轮已发布文件，在本地创建同名 `report: YYYY-MM-DD` 镜像提交，使工作区恢复干净。这个本地提交不推送，远端连接器状态仍是发布权威。
10. 报告 commit URL、公开日报 URL、验证结果和投递是否被触发。

### 3.4.1 发布硬禁令与恢复

- 禁止用本地目录树作为远端 `base_tree`，也禁止从本地文件列表重建远端根树。远端可能有本地镜像没有的行情快照或历史跟踪文件。
- 禁止未核对长度和 blob SHA 就上传大文件。`threads.json` 必须同时通过本地台账校验、manifest 长度检查和远端 blob 校验。
- 禁止在连接器超时后盲目重放写操作。先回读远端ref、提交或预期blob判断上次是否生效，复用已完成对象，再重试准确的失败阶段。
- 可恢复的校验、传输或竞态问题应在本轮修复并继续，保留研究、产物与恢复记录，不因20分钟预算或单次超时放弃。只有在安全范围内已无可行恢复路径、必须使用被禁止的凭证/其他仓库账号/秘密设置变更，或外部服务确实不可用时，才报告准确阻断与恢复点。
- `main` 只能在五文件完整、比较精确、远端父SHA未变化后更新一次，使Pages、CI和飞书/Slack只看到完整报告。成功以回读远端五blob一致且latest日期为今天为准。

不得使用本地 `git push` 代替连接器。`publish.sh push` 仅供仓库里的手动 Legacy GitHub Actions fallback 使用，不是 Codex 日常路径。

## 4. 幂等、竞态和本地状态

- `docs/latest.json.date` 已等于北京今天：无改动停止。
- 发布前远端 `main` 已变化：重新读取变更，只合并本任务范围，保留其他路径，重建并复验；不能安全自动解决的外部冲突才报告精确阻断。
- GitHub 连接器更新远端后不会移动当前本地 `.git/HEAD`。因此本地可能继续显示本轮已发布文件为 modified/untracked。
- 遇到这种情况，先用远端 commit 和文件 blob 核验是否正是本轮产物。只有确认完全对应后，才把本轮已发布文件提交为本地镜像基线；额外文件可恢复地保留或隔离，不能混入镜像提交，也不能据此放弃已经可完成的日报。
- 本地镜像提交只用于保持工作区干净，可以与连接器创建的远端提交拥有不同 SHA。不得把它推到 GitHub，也不得用本地 `origin/main` 是否新鲜代替连接器远端核验。
- 不用 `git reset`、`git checkout` 或删除文件来伪造干净状态。

## 5. 分阶段恢复

昂贵研究与机械发布之间的持久交接物是 `content.json`、`threads.json`、`review.draft.md`。失败时只修失败阶段。

| 失败阶段 | 恢复动作 |
|---|---|
| 运行前检查 | 修复或确认 `latest.json`、日期、行情状态，不开始研究 |
| 来源核实 | 只重做未核实来源；新闻来源日期不明就砍条目，AI不足3条时继续补查合格候选，不编日期 |
| 内容结构或编辑关卡 | 只改报错 item，再跑 `bash publish.sh validate` |
| 时效关卡 | 砍掉旧闻或修正真实日期；若AI不足3条只补查缺位候选，不重做其他有效研究 |
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
| `config/project-radar.json` | 项目、别名、分类、问题与定向查询入口，以及七家AI每日必扫名单 |
| `config/research-playbook.md` | 发现、讨论证据、GTM、机制拆解与研究日期规则 |
| `lib/research-plan.mjs` | 无需API的Perp轮换检索计划与七家AI每日必扫计划，缺家即报错 |
| `lib/research.mjs` | 项目研究结构与来源核验的共享校验 |
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

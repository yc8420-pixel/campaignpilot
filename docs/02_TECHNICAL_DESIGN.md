> 设计基线归档：本文件保留规划时点的内容与待办表述。当前实现与实测结果请见 [实现决策](05_IMPLEMENTATION_NOTES.md)、[验证报告](06_VERIFICATION_REPORT.md)、[任务台账](09_TASK_STATUS.md)。

# AI 营销活动工作台 技术与数据设计

状态：实施规格，尚未编码或部署。以下路径、表名、接口和配置为计划合同；编码调整时须同步本文件、任务及测试。

## 1 技术路线

选择单仓库、单 Web 应用，以减少个人项目的部署和联调负担。

| 层次 | 选择 | 作用与边界 |
| --- | --- | --- |
| 页面与服务端 | Next.js App Router、TypeScript | 页面、表单、服务端接口放在一个应用 |
| 样式与组件 | Tailwind CSS、少量可访问组件 | 优先统一按钮、表单、弹窗、状态与表格 |
| 数据与身份 | Supabase Postgres、Auth | 账号、持久化、行级权限、事务；不开放自助注册 |
| 数据访问 | Supabase SDK、SQL migrations、少量事务 RPC | 一套迁移来源，不并行引入另一套 ORM 迁移系统 |
| 输入输出验证 | Zod 与显式业务校验 | 复用 TypeScript 类型、表单和服务端合同 |
| AI 接口 | 服务端 provider adapter；首个实现用 OpenAI Responses API | 模型 ID 配置化，不把供应商格式散落在页面 |
| CSV | 成熟 CSV 解析器配合自定义校验 | 支持引号、BOM、换行；不手写 split 解析 |
| 图表 | 简单表格和少量 SVG/图表组件 | 数值与公式优先，图表作为比较辅助手段 |
| 自动验证 | Vitest、数据库集成测试、Playwright | 分别验证纯逻辑、事务权限和完整页面路径 |
| CI | GitHub Actions | 安装锁定依赖、lint、类型检查、测试、构建 |
| 部署候选 | Vercel 加 Supabase | 实施时核对目标地区可达性、配额、函数超时与费用 |

Next.js 与 Supabase 有官方集成路线，可用于这一单体方案。[Supabase Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)。具体包版本在 S1 时选择彼此兼容的稳定版本并锁定，不在规划中固定未经安装验证的版本组合。

本期不引入微服务、消息队列、Redis、向量数据库或复杂 Agent 框架。工作流由明确步骤驱动，每步单独执行和保存。若后续需要关闭页面后继续长任务，再引入持久后台执行与队列，不假装请求内任务具有该能力。

## 2 系统结构和两种模式

    浏览器页面
      ├─ 演示入口 → FixtureService → 浏览器本地状态
      └─ 真实入口 → 服务端 API → 鉴权与输入验证
                                 ├─ 业务服务 → Postgres/RLS
                                 ├─ AI Adapter → 模型供应商
                                 └─ CSV/指标/审核/导出纯逻辑

演示与真实模式共用页面组件、数据结构和纯规则函数，但数据访问适配器不同。

### 2.1 演示模式

- 预置来源、brief、方案、渠道内容、指标和复盘快照，页面明显标识为预生成样例。
- 按浏览器 localStorage 保存个人演示改动；存储不可用则使用内存并提示刷新会重置。
- 支持编辑、审核、导出、CSV 检查、公式计算和重置等本地交互。
- 预生成响应只对应固定样例输入。用户改变关键产品事实、brief、内容版本或指标快照后，不能把旧响应包装成针对新输入生成；显示“当前为样例，修改后的自定义生成需登录真实模式”，可恢复样例继续体验。自定义 CSV 可以实际解析并重新计算指标，但旧样例 AI 复盘应标为不匹配，不能冒充针对新数据的分析。
- 不读取生产数据库，不调用模型，不将访客输入上传；不使用共享管理员样例账号承载公开访客。
- 公开 demo 的“查看示例结果”文案与真实模式的“生成内容”文案不同。

### 2.2 真实模式

- 通过 Supabase Auth 的预创建账号登录。管理员从服务端允许名单授权真实调用，不仅检查是否登录。
- 服务端验证会话和对象归属，所有资源查询以当前用户为范围。前端提供的 owner_id 不可信。
- 业务表启用 RLS，通常以 auth.uid() 等于 owner_id 限定读写，并验证子记录的父资源归属。
- 优先用用户身份访问数据库。涉及配额和原子事务的 RPC 应检查调用身份、固定 search_path、限定 grants；使用特权函数须单独审查，不使用任意 SQL 执行接口。
- 私有内容响应不进入公共 CDN 缓存，个人数据响应按私有/不缓存策略处理；导出也须鉴权。
- 样例与真实数据之间不提供匿名复制到生产的捷径。

RLS 是数据库权限的一层保障。管理密钥可能绕过它，因此不能把“用了 RLS”当成所有服务端路径自然安全。[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 3 计划代码结构

    app/
      page.tsx                   作品入口
      demo/                      公开样例流程
      workspace/                 真实模式页面
      api/                       受保护接口
    components/
      forms/                     表单和校验反馈
      content/                   内容编辑、引用、审核
      metrics/                   指标表、导入预览
    lib/
      contracts/                 Zod schemas 与领域类型
      services/                  两模式共用业务接口
      ai/                        provider、prompt、错误映射
      rules/                     事实与风险提示规则
      analytics/                 CSV、金额、指标、数据快照
      exports/                   Markdown/CSV 生成
      auth/                      会话、允许名单、资源鉴权
      db/                        数据访问与事务调用
    fixtures/                    虚构样例与错误场景
    supabase/migrations/         表、约束、索引、RLS、RPC
    tests/unit/                  确定性逻辑
    tests/integration/           事务、幂等与权限
    tests/e2e/                   用户路径
    evals/                       固定输入与人工评分模板
    docs/                        产品、架构、任务、验收、展示

禁止页面组件直接拼模型提示词；指标函数不依赖 AI；导出函数不直接查询未授权内容。服务边界使纯逻辑能够在演示和真实模式复用。

## 4 核心数据模型

所有真实业务记录包含 UUID 主键、owner_id、created_at 和必要的 updated_at。时间戳使用 UTC，活动的业务日期由其 IANA timezone 解释；样例默认 Asia/Shanghai，用户可在真实活动中修改。开发者所在时区不自动改变业务日期。

| 表或逻辑实体 | 核心字段 | 关系与约束 |
| --- | --- | --- |
| brands | name、tone、forbidden_terms | 品牌属于一个用户 |
| brand_revisions | brand_id、revision、source_text、facts_json、content_hash | 不可变快照；事实含 fact_id、source_id、原文片段与确认状态 |
| campaigns | brand_id、title、status、current_brief_revision_id | 活动属于同用户品牌；归档不抹除历史 |
| brief_revisions | campaign_id、brand_revision_id、goal、audience、budget_cents、currency、dates、timezone、channels | 不可变；引用精确品牌版本 |
| strategy_versions | campaign_id、brief_revision_id、ai_run_id、output_json | 保存方案角度、预算、假设及来源 |
| content_variants | campaign_id、channel、label、current_version_id、delivered_content_version_id | A/B 是业务变体，variant_id 长期稳定 |
| content_versions | variant_id、version、brief_revision_id、strategy_version_id、content_json、content_hash、status | 每次改稿创建版本；draft/approved/rejected |
| reviews | content_version_id、decision、comment、reviewer_id、content_hash | 审核绑定精确版本；相同账号可审核 |
| exports | campaign_id、manifest_json、created_by | 记录导出内容版本、variant_id、日期和模拟标记 |
| ai_runs | step、request_hash、idempotency_key、input_snapshot、status、deadline_at、attempts、usage、error_code | owner+幂等键唯一；run 与结果关联 |
| import_batches | campaign_id、file_hash、source_label、schema_version、status、row_count、warnings | owner+campaign+hash 唯一；提交绑定预览摘要 |
| metric_rows | batch_id、date、campaign_id、channel、variant_id、impressions、clicks、orders、spend_cents、revenue_cents | 自然键 date+campaign+channel+variant 唯一 |
| metric_snapshots | campaign_id、filters_json、source_batch_ids、totals_json、metrics_json、snapshot_hash | 复盘使用不可变计算快照 |
| analysis_versions | campaign_id、metric_snapshot_id、ai_run_id、output_json | 保留旧复盘，数据更新后标记过期 |
| daily_usage | owner_id、date_utc、reserved_amount、estimated_amount、run_count、provider_call_count | 事务内预留调用额度；不得仅依赖进程内计数 |

表数不是独立产品功能数。只保存实现版本追溯、权限、幂等和复盘必需的数据；初版可把小型事实集合存 JSON，避免为每个显示字段建新服务。

### 4.1 关系和一致性

品牌版本 → brief 版本 → 方案版本 → 内容版本 → 审核与导出；导出的 variant_id → 指标行 → 指标快照 → 复盘版本。

一个 variant 在首次正式导出时，通过导出事务锁定 delivered_content_version_id。这表示已交付，不代表已发布或已投放。此后实质改稿须创建新 variant_id；界面提供复制为新变体的动作，避免同一 ID 混合不同文案的表现。指标只允许关联该变体已交付的精确版本。导出清单提供 campaign_id、channel、variant_id、content_version_id 供回填数据。

品牌和 brief 的修改不会重写历史快照。当前版本变更时，旧方案与内容显示过期状态；本期正式导出只允许当前资料和 brief 对应的已审核版本，历史版本可查看而不混入本次交付。

不实现复杂的团队共享。测试仍创建甲乙两个账号，验证所有表、关联对象、API 与导出路径均无法越权。

## 5 输入和结构化输出合同

### 5.1 品牌与 brief

人工事实格式：fact_id、value、source_id、source_excerpt、confirmed。只有确认事实参与生成；矛盾或未确认项进入待补信息列表。粘贴原文只保存为资料，自动提取事实属于可选增强，默认人工填写以控制范围。

默认输入上限：单条来源 8,000 中文字符、每品牌最多 10 条来源、模型上下文选用事实和片段总计不超过 12,000 字符，brief 附加说明不超过 2,000 字符。超限应提示裁剪，不静默截掉价格或限制。字符上限是初始设计值，需结合选定模型的 token 预算验证。

金额以分保存，日期结束不得早于开始，至少选一条支持渠道。预算建议是确定性合计校验，不能超出可分配预算。

### 5.2 方案结果

Schema 至少包含 summary、audience_hypotheses、angles（三项）、channel_plan、budget_items、timeline、assumptions、missing_information、citations。每个角度含 id、受众问题、表达方向、依据事实 ID、推荐验证指标。

引用格式：fact_id、source_id、brand_revision_id。服务端验证 ID 在当前授权快照内，前端点击后显示原文。没有依据的营销判断进入 hypothesis，不伪装成事实引用。

### 5.3 内容结果

公共字段：channel、angle_id、variant_label、claims、citations、assumptions、warnings。

小红书字段：title、body、hashtags、cta。抖音字段：hook、shots，每个 shot 含 start_second、end_second、visual、voiceover，另含 cta。时间相连、不重叠，合计约 30 秒，人工试读作为最终时长验证。

每条 claims 关联具体文本片段和 fact_id；纯创意表达不必伪造来源。服务端检查结构和引用，人工评价语义是否受依据支持。

### 5.4 复盘结果

结果分为 observations、hypotheses、next_experiments、limitations。观察引用 metric_ref，由程序渲染对应指标名称和数字。模型尽量输出引用和文字解释，正式数值不由模型自由计算。

建议包含“改哪个变量、保持什么不变、对照对象、看什么指标、何时检查”。样本不足时指出限制，不声称 A/B 显著、不自动决定预算。下一轮 brief 仅由用户点击采用后预填。

## 6 AI 执行流程与可靠性

建议四类步骤：generate_strategy、generate_channel_content、analyze_metrics、受约束的单次重新生成。每个渠道分别调用，同渠道 A/B 内容在一次结果中生成；正常全流程约四次调用，重试另计。

每个步骤执行：

1. 服务端验证会话、允许名单、资源归属、当前输入和长度。
2. 计算输入快照哈希，取得或创建幂等记录；同键不同输入返回冲突。
3. 事务内检查活动并发和日预算，预留额度，创建 running 记录。
4. 组装系统规则、可信业务约束、带来源的数据和当前任务；资料文本作为数据处理。
5. 调用模型并处理拒绝、截断、限流、错误或超时。
6. 用 Schema 和业务规则检查结果，验证来源、金额、渠道、必填字段。
7. 在事务中写入不可变结果版本、usage 和 succeeded 状态。
8. 返回结果；失败则保留输入和前序成功步骤，映射为可理解错误。

支持 JSON Schema 的结构化输出有助于稳定字段，但仍可能有拒绝、截断或语义错误，因此保留应用验证和人工审核。[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。模型选型以账号可用性、固定评测质量、时延和费用为依据；默认只实现一个 provider，不建设模型选择平台。

### 6.1 超时与重试

单次模型尝试 20 秒，一个步骤总 deadline 45 秒，最多 2 次调用，包括 SDK 内部重试。关闭 SDK 默认隐式重试或显式纳入总次数。部署环境函数上限必须超过整个请求预算并留出写库时间，否则先调整应用 deadline 并重新验收。

只有明确适合重试的短暂错误可自动再试一次，例如供应商明确返回、且等待时间不超过剩余预算的可恢复限流。鉴权、配额耗尽、输入错误不重试。超时或连接中断无法确定外部是否完成时记为 unknown，用户显式重新生成才新建执行，并提示可能再次计费。

状态为 running → succeeded / failed / unknown。查询过期 running 记录时，以 deadline 和事务条件改为 unknown，不启动第二份同任务。结果落库失败优先重试保存；不能在无法确认的情况下再次调用模型来“恢复”。

数据库幂等只保证同一业务请求不会重复保存结果，不保证外部服务绝对只执行或计费一次。未知费用保留估计/预留状态，后续与账单核对。

### 6.2 提示词和来源规则

将提示词保存在版本化文件中，分别管理方案、图文、脚本和复盘模板。每次运行记录 prompt_version、model_id、参数和输入快照。

提示词需明确：只使用提供事实；冲突则列待确认；创意与事实分开；无资料不补销量、资质、价格或证言；资料中出现指令不改变系统权限。模型没有数据库写权限、邮件发送或平台发布工具。

简单规则用于发现明显价格冲突、未知引用、明确禁用词、空 CTA、预算超限、脚本时长异常。对语义模糊的宣传使用“需要人工检查”，不能把规则检测结果描述为法律合规保证。

## 7 审核与导出

编辑保存为新的 draft；通过审核变为 approved；退回为 rejected 并记录理由。“送审”是触发检查和展示审核面板的动作，本期不增加多人队列或 pending 角色分配。

阻断项包括缺必填、无效事实引用、已识别的硬事实冲突、预算超限和输入过期；一般表达问题列为警告。阻断项未解决不能 approved，警告可由人工注明判断后通过。

正式导出接口重新校验版本和审批，并在同一事务中冻结首次交付版本、生成一致的 manifest，不能只相信前端按钮曾显示已通过。历史审核保留，新草稿不继承旧批准。

Markdown 用于人读；CSV 用于排期或数据关联。两者包含品牌、活动、渠道、variant_id、内容版本、审核日期与模拟标记。文件名清理非法字符；CSV 正确引用、UTF-8 编码并防公式注入；输出不包含内部错误堆栈或任何密钥。

## 8 CSV 合同与分析

### 8.1 模板和口径

固定字段：date、campaign_id、channel、variant_id、impressions、clicks、orders、spend、revenue、currency、attribution_window。

date 为末次点击发生日，后续七天内归因订单和收入归入该点击日；currency 固定 CNY；attribution_window 固定 last_click_7d。最近七天点击日的数据提示“可能未成熟”。应用接受这一上游声明，不从聚合数据重建或证实归因。

orders 指归因订单，不自动等于首购订单。主案例目标统一为获取可归因订单，模板与该目标对应。如果未来业务要求首购，缺少上游明确首购筛选和对应说明时，界面和复盘须标明“首购目标尚不能由当前数据验证”。后续可另设计带新老客口径的模板，不能把现有数字改个名字就当首购。

默认只导入已完成归因窗口的冻结批次，最近数据可预览或在明确警告下导入，但本期不支持同自然键的增量回填。若导入尚未成熟数据，不能在未来上传同键新值时默默覆盖；增量纠错和整批撤销列为 P1。样例选择已成熟的模拟日期。

### 8.2 导入流程

文件上限 2 MB、5,000 行、UTF-8，可含 BOM。先解析 → 字段和类型检查 → 资源与口径验证 → 自然键冲突检查 → 展示预览 → 用户确认 → 事务再次验证并提交。

预览不是正式写入。确认请求带 payload_hash，服务端重新解析同一内容或验证签名后的预览摘要，不能直接信任客户端声称“已通过”。

相同文件 hash 返回已有批次；不同文件但自然键冲突则整批拒绝。自然键为日期+活动+渠道+variant。文件内重复也整批拒绝；不自动相加或合并。

金额最多两位小数、非负；整数非负且在安全范围；空值不等于 0；拒绝缺列、重复列名、未知核心列和无效日期。允许常见列顺序变化。clicks 大于 impressions、orders 大于 clicks 等列为质量警告，用户确认才继续，并在复盘中携带警告。

### 8.3 确定性计算

CTR=点击/曝光；CVR=归因订单/点击；CPC=花费/点击；CPA=花费/归因订单；ROAS=归因销售额/花费。零分母为 null，显示 N/A 和原因。先汇总分子分母，最后计算并舍入，禁止平均各行百分比。金额以分累加。

固定黄金数据和预期值见验收文档 4.4。复盘绑定 source_batch_ids、筛选条件、时间范围、口径、汇总值和 hash。新增数据后不静默改写旧结论。

## 9 接口合同

所有真实接口返回统一错误体：code、message、field_errors（可选）、retryable、request_id；日志通过 request_id 定位。响应不返回供应商密钥、原始堆栈或其他用户信息。

| 接口建议 | 行为 | 必须验证 |
| --- | --- | --- |
| GET/POST /api/brands | 列出和创建品牌 | 当前用户、字段与长度 |
| POST /api/brands/:id/revisions | 创建品牌快照 | 归属、预期当前版本、内容 hash |
| GET/POST /api/campaigns | 列出和创建活动 | 品牌归属、初始 brief |
| POST /api/campaigns/:id/briefs | 新建 brief 版本 | 日期、预算、渠道、预期版本 |
| POST /api/campaigns/:id/generate | 执行指定生成步骤 | 幂等键、输入快照、授权、限额 |
| GET /api/runs/:id | 读取运行与结果状态 | 所有者、超期 running 识别 |
| POST /api/variants/:id/versions | 编辑为新内容版本 | 所有者、内容 Schema、乐观锁 |
| POST /api/content-versions/:id/review | 审核精确版本 | 规则检查、内容 hash、当前版本 |
| POST /api/campaigns/:id/export | 导出选定内容 | 审核状态、当前依据、精确 manifest |
| POST /api/campaigns/:id/imports/preview | 解析 CSV 预览 | 文件大小、语法、字段、资源 |
| POST /api/campaigns/:id/imports/commit | 原子确认导入 | 摘要、幂等、自然键、数据口径 |
| GET /api/campaigns/:id/metrics | 查询指标 | 筛选、权限、确定性计算 |
| POST /api/campaigns/:id/analyze | 基于快照生成复盘 | 快照归属、幂等、限额 |

状态码约定：400 语法错误；401 未登录；403 未授权使用真实调用；404 不存在或无权访问的对象；409 版本、幂等或数据冲突；413 超限；422 业务字段不符合要求；429 应用限流；502/503 服务异常。未知模型结果通过 run 状态表达，不用“未扣费”推断。

## 10 安全、隐私和成本的实现约束

- 模型凭据仅保存在服务端环境变量；不把密钥放入 NEXT_PUBLIC_ 前缀。该前缀会使值进入浏览器 bundle。[Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- .env.example 只给变量名与占位值；.env.local、真实评测输入和私有导出不入 Git。
- 默认日志只含 ID、耗时、错误码和 usage；原始输入输出保存在权限保护的业务库，公开证据只使用虚构资料。
- 对 Markdown 使用受限渲染或纯文本；CSV 文本不作为 HTML；POST 校验来源与会话，防止跨站触发付费操作。
- 应用配额通过数据库事务预留；每活动最多一个运行中的生成步骤；默认每账号每天最多 20 次实际供应商调用，失败调用和重试均计数。评测专用账号可预先显式配置为每天最多 40 次实际供应商调用，使用独立预算账本，仍经过全部鉴权和额度检查。
- 模型总费用以 input_tokens×单价+output_tokens×单价估算，重试与未知状态单独记录；无 usage 则标未知，不填 0。
- 删除真实品牌或活动若后续实现，应有清晰范围和依赖处理；MVP 先采用归档，避免复杂恢复流程。

## 11 部署、配置和运行手册

计划支持以下命令，实际脚本在 S1/S7 实现后方可对外称为可执行：

| 命令 | 预期用途 |
| --- | --- |
| pnpm install --frozen-lockfile | 复现依赖 |
| pnpm dev:demo | 不需要数据库与模型密钥的样例模式 |
| pnpm dev | 读取真实模式配置启动开发 |
| pnpm lint / pnpm typecheck | 静态质量检查 |
| pnpm test | 确定性单元测试 |
| pnpm test:integration | 使用隔离测试数据库验证事务与权限 |
| pnpm test:e2e | 浏览器样例与受保护模式测试 |
| pnpm build | 生产构建 |

配置计划：公开连接配置 SUPABASE_URL 与对应 publishable key 按框架要求映射；OPENAI_API_KEY、AI_MODEL、AI_TIMEOUT_MS、AI_MAX_ATTEMPTS、每日配额与允许名单只在服务端；演示入口的服务端路由不应依赖真实配置存在。

环境分为本地、预览、正式。CI 不消耗真实模型额度，真实评测手动或显式触发；测试账号与测试库不接生产。迁移先在预览环境验证，再部署兼容的应用；初版保留迁移和虚构 seed 脚本。

上线前检查：生产变量完整、数据库迁移、RLS、真实生成小流量检查、公开样例、导出、CSV、目标网络可达性、错误页及敏感信息扫描。

回滚优先关闭真实模型调用开关，公开样例继续可用；回退到最近稳定应用版本。数据库迁移优先增量兼容，不把删除字段当作常规回滚。已产生新数据时先备份和制定修复步骤，不能盲目回退数据库。

## 12 可观测性与性能目标

记录 request_id、run_id、阶段耗时、模型标识、结果状态、错误类别、usage、费用估计和版本。界面用简明中文解释错误，技术详情留在受保护记录。

待验证目标：样例首页在记录过的桌面网络环境中主要内容 3 秒内可用；非 AI 常规操作 p95 小于 1 秒；2 MB 以内 CSV 解析预览目标 3 秒内；AI 以每步骤 45 秒总 deadline 为上限。记录设备、网络、样本数、冷启动和热启动，不能把本地测试当跨地区 SLA。

如果模型在 20 秒单次预算内经常无法完成，优先缩小单次输出或选择经评测合格的更快模型；改变超时必须同步接口、部署预算、验收和演示说明。

## 13 开发时仍需实际验证的决策

1. 稳定包版本是否兼容，是否存在影响本项目的已知问题。
2. 所选模型能否满足结构、中文内容质量、20 秒预算与可接受成本。
3. 目标网络是否可访问候选托管和 API；实际套餐是否支持请求时间预算。
4. RLS、事务 RPC、幂等和额度预留是否能抵抗真实并发与越权请求。
5. 公开样例与真实接口是否完全隔离；无配置时 demo 是否仍能构建。

这些验证对应任务清单和发布门槛，不以文档选型代替试运行。

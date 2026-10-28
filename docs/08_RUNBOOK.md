# 运行、真实模式配置与故障处理

## 无凭据演示

Node 24 → `npm ci` → `npm run dev:demo` → `http://127.0.0.1:5173`。

生产包：`npm run build:demo` → `npm run preview:demo` → `http://127.0.0.1:5174`。发布目录为 `sites/campaignpilot-demo/dist`，可用于静态托管；本次 Sites 发布使用独立源副本，原始工程仍保留在根目录。

演示数据仅存在当前浏览器 localStorage。不同浏览器不共享，更换设备不会自动同步。“重置演示”只清除当前活动的本地工作结果。存储失效会提示，损坏结构会恢复初始样例。它不是生产备份系统。

## 真实模式配置步骤（本次未实际联调）

1. 在专用 Supabase 项目中创建数据库，应用 `supabase/migrations/202610280001_workspace.sql`。SQL 依赖 Supabase 自带的 auth.users/auth.uid 与 anon/authenticated/service_role；普通 Postgres 测试替身见 `tests/integration/database.test.ts`，不能把该测试角色脚本贴到生产项目。
2. 在 Supabase Auth 创建预置用户，不开放公众注册。记录获授权用户 UUID，作为 AI 允许名单。测试时至少两个独立账号 A/B。
3. 将 `.env.example` 复制成忽略提交的 `.env.local`，填入项目连接与服务端配置。
4. 保持 `AI_ENABLED=false`，先运行 `npm run dev`，进入 `/workspace`，验证真实登录、CRUD、刷新、退出和 A/B 隔离。
5. 配置具备 Responses 与结构化输出能力的 `AI_MODEL`、API Key、最新 token 价格与定价核对日期。模型选择需用少量开发集实测，当前没有替用户假定模型或价格。
6. 明确设置允许用户 UUID 和预算后，设 `AI_ENABLED=true`，重启服务，仅先生成一个方案。检查 run、数据库状态与供应商账单，再继续两个渠道及复盘。
7. 生产环境使用支持 Node runtime 和至少 60 秒请求时限的 Next.js 部署。必须通过 HTTPS、正确代理 Origin、执行迁移，并完整重复 E02/E03/E06/E07/E15 后，才标为真实模式发布通过。

| 环境变量 | 作用与默认 |
| --- | --- |
| SUPABASE_URL | 项目 URL |
| SUPABASE_PUBLISHABLE_KEY | 项目公开 API key，用于服务端认证客户端 |
| SUPABASE_SECRET_KEY | 仅服务端使用的特权 key，不得加 NEXT_PUBLIC_ 前缀 |
| OPENAI_API_KEY | 仅服务端模型 key |
| AI_MODEL | 经实测选择的模型；未设置则不调用 |
| AI_ALLOWED_USER_IDS | 逗号分隔的获准用户 UUID |
| AI_ENABLED | 默认 false；只控制生成，不关闭读取与编辑 |
| AI_DAILY_CALL_LIMIT | 默认 20，每用户每天的 provider 尝试预算；每步先预留 2 次 |
| AI_DAILY_BUDGET_MICRO_USD | 默认 2,000,000，即估算 2 USD |
| AI_RESERVATION_MICRO_USD | 默认每步骤预留 100,000，即 0.10 USD；须按所选模型调大 |
| AI_INPUT_USD_PER_MILLION | 每百万输入 token 的 USD 价格 |
| AI_OUTPUT_USD_PER_MILLION | 每百万输出 token 的 USD 价格 |
| AI_PRICING_DATE | 人工核对价格的日期，保存在 usage 记录中 |

配额以 UTC 日期记账。预留是应用级估算，不是供应商账单硬上限；unknown、缺失 usage 或未配价格时不记零成本。应另设供应商侧预算。评测脚本有独立显式开关与调用上限，不混用生产调用账本。

密钥类型与 RLS 绕过规则参照 [Supabase API Keys](https://supabase.com/docs/guides/getting-started/api-keys)；行级策略参照 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。只有可公开配置才能使用浏览器前缀，参见 [Next.js 环境变量](https://nextjs.org/docs/app/guides/environment-variables)。

## 接口速查

| 方法/路径 | 作用 |
| --- | --- |
| GET /api/status | 返回配置可用性布尔值，不返回密钥 |
| POST /api/login | 预置账号登录、设置 HttpOnly Cookie |
| POST /api/logout | 清理 Cookie |
| GET/POST /api/workspaces | 查询本人活动/创建活动；可从复盘建议创建下一轮 |
| GET /api/workspaces/:id | 查询本人活动 |
| POST /api/workspaces/:id/mutate | expectedRevision + Zod 动作合同；包括审核、导出、导入 |
| POST /api/workspaces/:id/generate | step + UUID key + expectedRevision |
| GET /api/workspaces/:id/runs | 查询本人执行账本，过期 running 显示 unknown |

## 故障处理与回滚步骤

- `NOT_CONFIGURED` / 登录不可用：确认三个 Supabase 变量，保持静态演示可用；不要把 fixture 替换成真实成功。
- `REVISION_CONFLICT`：刷新活动，核对其他保存，重新提交；不能在旧 revision 上强制覆盖。
- `IDEMPOTENCY_CONFLICT`：同一个键不能用于不同输入。网络回放沿用同一键；用户选择新生成才用新键。
- `QUOTA`：查看 daily_usage 与 ai_runs，不盲目重试。unknown 需核对供应商后处理，不能直接清零预留。
- `UNKNOWN`：外部结果可能已生成并计费；当前没有后台取回机制，显式重试可能产生新费用。
- CSV 冲突：整批不导入。修正未导入文件再提交；已入库同键不支持增量覆盖或撤销。
- 内容无法审核：查看阻断规则、确认最新资料与引用；更改事实后应重新生成/建立新变体。

应急关闭：设 `AI_ENABLED=false` 并重启/重新部署，验证生成返回关闭提示，历史资料仍可读取。保留数据库不动。

代码回滚：切回已验收 Git tag，重新 `npm ci && npm run build`；静态站重新部署对应的已保存版本。数据库采用兼容迁移，回滚应用时不执行 DROP TABLE。**本次未在真实云端演练数据库/模型故障回滚，这些是操作步骤，不是已通过结果。**

## 本机命令

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:demo
npx playwright install chromium
npm run test:e2e
npm run samples
```

不要同时让多个构建任务写同一个 dist。录屏需要先运行 `npm run preview:demo`，再运行 `node scripts/record-demo.mjs`。视频约三分钟，读取停留时间是真实录制的一部分，不模拟模型生成延迟。

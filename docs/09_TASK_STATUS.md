# T001–T086 执行台账

日期：2026-10-28；实现版本：1.0.0。原任务细则与依赖仍见 [TASKS](../TASKS.md)。

本次完成可运行的公开演示、真实模式实现代码与离线工程验证。**没有把缺失的真实服务联调和模型质量评测记成通过。** “待验收”通常表示实现已有、但完整原验收条件尚缺外部环境或用户评审。真实结果详见 [验证报告](06_VERIFICATION_REPORT.md)。

所有任务以同一开发日期记录；提交按可审查的整体分组，不伪造逐任务耗时。源代码对应版本由仓库 tag `v1.0.0` 与 `artifacts/DELIVERY_MANIFEST.json` 标识。此前约100小时为人工规划估算，不是本次实耗。

| ID | 状态 | 实际产物/证据 | 结果或限制 |
| --- | --- | --- | --- |
| T001 | 完成 | 规划、src/domain/seed.ts、evals/ | 阅读全套规划，冻结 F01–F10 与排除范围，记录默认假设；已实现并完成对应离线自检。 |
| T002 | 完成 | 规划、src/domain/seed.ts、evals/ | 定义轻行品牌资料、事实 ID、来源和不能补造的属性；已实现并完成对应离线自检。 |
| T003 | 完成 | 规划、src/domain/seed.ts、evals/ | 整理活动 brief、三个角度、两渠道 A/B 目标输出；已实现并完成对应离线自检。 |
| T004 | 完成 | 规划、src/domain/seed.ts、evals/ | 冻结 CSV 日期、归因、币种、字段与自然键；已实现并完成对应离线自检。 |
| T005 | 完成 | 规划、src/domain/seed.ts、evals/ | 画欢迎页、资料、brief、内容审核和复盘线框；已实现并完成对应离线自检。 |
| T006 | 完成 | 规划、src/domain/seed.ts、evals/ | 定义黄金数据与错误文件清单；已实现并完成对应离线自检。 |
| T007 | 完成 | 规划、src/domain/seed.ts、evals/ | 定义 20 常规及 10 异常评测场景，划分保留集；已实现并完成对应离线自检。 |
| T008 | 完成 | 规划、src/domain/seed.ts、evals/ | 将 F01–F10 映射到任务、E01–E15 与证据；已实现并完成对应离线自检。 |
| T009 | 完成 | package.json、CI、src/ui、README | 检查本机工具，选择兼容稳定版本，初始化 Next.js/TS；已实现并完成对应离线自检。 |
| T010 | 完成 | package.json、CI、src/ui、README | 配置 lint、typecheck、测试入口与统一格式；已实现并完成对应离线自检。 |
| T011 | 完成 | package.json、CI、src/ui、README | 建立目录、领域类型、两模式服务接口；已实现并完成对应离线自检。 |
| T012 | 完成 | package.json、CI、src/ui、README | 建立导航、布局、表单、状态标签和错误组件；已实现并完成对应离线自检。 |
| T013 | 完成 | package.json、CI、src/ui、README | 实现浏览器 fixture 初始化、状态保存、重置；已实现并完成对应离线自检。 |
| T014 | 完成 | package.json、CI、src/ui、README | 区分查看样例和真实生成，自定义改动提示限制；已实现并完成对应离线自检。 |
| T015 | 完成 | package.json、CI、src/ui、README | 建 CI 安装、静态检查、纯逻辑测试、build；已实现并完成对应离线自检。 |
| T016 | 完成 | package.json、CI、src/ui、README | 编写当前真实可用的启动方式与配置样例；已实现并完成对应离线自检。 |
| T017 | 完成 | SQL、tests/integration/ | 编写品牌、活动、内容、运行、指标等迁移；已实现并完成对应离线自检。 |
| T018 | 待验收 | SQL、tests/integration/ | 采用聚合+CAS，子记录约束在服务层；与最初逐表外键方案不同，见 ADR-002。 |
| T019 | 待验收 | SQL、tests/integration/ | 登录/退出/过期处理已实现；无 Supabase 项目，云端登录未联调。 |
| T020 | 完成 | SQL、tests/integration/ | 为所有业务表和子记录配置 RLS；已实现并完成对应离线自检。 |
| T021 | 完成 | SQL、tests/integration/ | 实现统一资源归属和真实调用允许名单检查；已实现并完成对应离线自检。 |
| T022 | 完成 | SQL、tests/integration/ | 实现版本、幂等、预算预留和导入所需事务 RPC；已实现并完成对应离线自检。 |
| T023 | 待验收 | SQL、tests/integration/ | PGlite 中建立 A/B 与匿名角色；托管 Auth 测试账号未建立。 |
| T024 | 待验收 | SQL、tests/integration/ | API 边界与数据库隔离通过；真实两账号完整资源矩阵未跑。 |
| T025 | 待验收 | SQL、tests/integration/ | 空库迁移与历史/CAS 测试通过；真实旧版本生产数据兼容未演练。 |
| T026 | 完成 | src/ui、domain、browser-tests.log | 实现品牌资料表单、原文保存和事实确认；已实现并完成对应离线自检。 |
| T027 | 完成 | src/ui、domain、browser-tests.log | 保存来源快照与事实 ID，处理相互冲突信息；已实现并完成对应离线自检。 |
| T028 | 完成 | src/ui、domain、browser-tests.log | 实现活动创建、列表和 brief 表单；已实现并完成对应离线自检。 |
| T029 | 完成 | src/ui、domain、browser-tests.log | 保存不可变 brief 与输入哈希，增加乐观锁；已实现并完成对应离线自检。 |
| T030 | 完成 | src/ui、domain、browser-tests.log | 建活动详情、步骤状态与前后导航；已实现并完成对应离线自检。 |
| T031 | 完成 | src/ui、domain、browser-tests.log | 提示资料修改使已有方案过期，保留旧版本；已实现并完成对应离线自检。 |
| T032 | 完成 | src/ui、domain、browser-tests.log | 完成保存中、失败、离开未保存编辑和刷新行为；已实现并完成对应离线自检。 |
| T033 | 待验收 | src/ui、domain、browser-tests.log | fixture CRUD 已通过；live CRUD 代码已实现，等待真实配置联调。 |
| T034 | 待验收 | src/ai、server、provider/API/SQL tests | Responses 适配器和 mock 故障测试通过，真实请求未运行。 |
| T035 | 阻塞 | src/ai、server、provider/API/SQL tests | 无模型凭据；未选定模型或进行付费初评，不给未经实测的默认值。 |
| T036 | 完成 | src/ai、server、provider/API/SQL tests | 写方案 prompt、Schema、事实和假设字段；已实现并完成对应离线自检。 |
| T037 | 待验收 | src/ai、server、provider/API/SQL tests | 样例方案/来源/三个角度可用；真实生成待凭据。 |
| T038 | 待验收 | src/ai、server、provider/API/SQL tests | 小红书 A/B、编辑、来源、导出可用；真实内容质量未评。 |
| T039 | 待验收 | src/ai、server、provider/API/SQL tests | 抖音 A/B 文本分镜和时间规则可用；独立人工试读与真实生成未评。 |
| T040 | 待验收 | src/ai、server、provider/API/SQL tests | SQL 幂等+原子提交、API 完成后回放已测；外部模型并发联调待做。 |
| T041 | 待验收 | src/ai、server、provider/API/SQL tests | 适配器重试/unknown/时间预算测试通过；供应商故障现场待验。 |
| T042 | 待验收 | src/ai、server、provider/API/SQL tests | SQL 配额与费用预留通过；实际账单对照未做。 |
| T043 | 待验收 | src/ai、server、provider/API/SQL tests | 分步骤操作与 run 查询实现；真实网络中断后的完整恢复待验。 |
| T044 | 待验收 | src/ai、server、provider/API/SQL tests | 结构/引用与注入数据分层通过；模型语义注入抗性未实测。 |
| T045 | 待验收 | src/ai、server、provider/API/SQL tests | 模型/提示/输入版本与 usage 代码具备；真实 run 账本没有伪造数据。 |
| T046 | 完成 | domain tests、artifacts/samples/ | 实现关键事实、禁用词和渠道规则检查；已实现并完成对应离线自检。 |
| T047 | 完成 | domain tests、artifacts/samples/ | 实现不可变内容版本与 A/B 变体关联；已实现并完成对应离线自检。 |
| T048 | 完成 | domain tests、artifacts/samples/ | 实现 draft/approved/rejected 与审核意见；已实现并完成对应离线自检。 |
| T049 | 完成 | domain tests、artifacts/samples/ | 将批准绑定 hash、资料版本和当前内容；已实现并完成对应离线自检。 |
| T050 | 完成 | domain tests、artifacts/samples/ | 首次正式导出时原子锁定 variant 交付版本和 manifest；已实现并完成对应离线自检。 |
| T051 | 完成 | domain tests、artifacts/samples/ | 实现中文 Markdown 内容包；已实现并完成对应离线自检。 |
| T052 | 完成 | domain tests、artifacts/samples/ | 实现 CSV 内容包、正确转义和公式防护；已实现并完成对应离线自检。 |
| T053 | 完成 | domain tests、artifacts/samples/ | 服务端再次校验授权与已批准版本；已实现并完成对应离线自检。 |
| T054 | 完成 | domain tests、artifacts/samples/ | 完整演示从草稿到导出及退回改稿；已实现并完成对应离线自检。 |
| T055 | 完成 | analytics.ts、domain tests、浏览器录屏 | 生成带真实样例 ID 的模板和示例 CSV；已实现并完成对应离线自检。 |
| T056 | 完成 | analytics.ts、domain tests、浏览器录屏 | 实现 UTF-8/BOM/引号解析及大小行数限制；已实现并完成对应离线自检。 |
| T057 | 完成 | analytics.ts、domain tests、浏览器录屏 | 校验字段、数字、归因、币种和资源归属；已实现并完成对应离线自检。 |
| T058 | 完成 | analytics.ts、domain tests、浏览器录屏 | 实现预览、警告确认、摘要和服务端复验；已实现并完成对应离线自检。 |
| T059 | 完成 | analytics.ts、domain tests、浏览器录屏 | 事务提交、文件 hash 和自然键冲突处理；已实现并完成对应离线自检。 |
| T060 | 完成 | analytics.ts、domain tests、浏览器录屏 | 实现金额、汇总、CTR/CVR/CPC/CPA/ROAS 纯函数；已实现并完成对应离线自检。 |
| T061 | 待验收 | analytics.ts、domain tests、浏览器录屏 | 日期/渠道筛选和逐变体表格可用；未单设 variant 下拉筛选。 |
| T062 | 完成 | analytics.ts、domain tests、浏览器录屏 | 实现不可变指标快照和旧报告过期提示；已实现并完成对应离线自检。 |
| T063 | 待验收 | analytics.ts、domain tests、浏览器录屏 | 复盘 Schema、确定性指标输入和快照完成；真实复盘质量待验。 |
| T064 | 待验收 | analytics.ts、domain tests、浏览器录屏 | 模拟数据、成熟窗口、非因果及口径限制显示；真实输出仍待核对。 |
| T065 | 待验收 | analytics.ts、domain tests、浏览器录屏 | 已实现确认后创建独立下一轮活动；日期预算沿用待人核对。 |
| T066 | 待验收 | analytics.ts、domain tests、浏览器录屏 | fixture 闭环和新活动浏览器测试通过；live 闭环未跑。 |
| T067 | 完成 | 验收报告、tests、evals、artifacts/ | 完善关键纯逻辑回归：金额、版本、引用、公式、CSV；已实现并完成对应离线自检。 |
| T068 | 待验收 | 验收报告、tests、evals、artifacts/ | PGlite 真实 PostgreSQL 语义与 API mock 集成通过；多连接云端竞争未实测。 |
| T069 | 待验收 | 验收报告、tests、evals、artifacts/ | 确定性部分与浏览器主线已覆盖；E02、E04语义、E15云回滚未通过。 |
| T070 | 阻塞 | 验收报告、tests、evals、artifacts/ | 20常规/10异常输入及runner已交付；40份真实工作流包未运行。 |
| T071 | 阻塞 | 验收报告、tests、evals、artifacts/ | 没有真实模型输出；五维评分保持空白，不填造分数。 |
| T072 | 阻塞 | 验收报告、tests、evals、artifacts/ | 确定性缺陷已修复；真实低分修复依赖 T070–T071。 |
| T073 | 待验收 | 验收报告、tests、evals、artifacts/ | 390/1440、导航、编辑、弹窗键盘自动化通过；未做 Safari/Firefox 与独立用户走查。 |
| T074 | 待验收 | 验收报告、tests、evals、artifacts/ | 20次本机生产预览导航样本已记录；真实模型耗时/费用与公网p95未测。 |
| T075 | 阻塞 | 验收报告、tests、evals、artifacts/ | 未开展5组人工/工具对照，不宣称效率提升。 |
| T076 | 完成 | 验收报告、tests、evals、artifacts/ | 扫描源码、历史、bundle、日志和导出中的秘密；已实现并完成对应离线自检。 |
| T077 | 待验收 | 验收报告、tests、evals、artifacts/ | 允许发布明确标注的 fixture 演示；原规划真实模式硬门槛未满足。 |
| T078 | 完成 | README、提交材料、运行手册、交付包 | 整理 GitHub README、功能状态、截图、架构、限制和许可说明；已实现并完成对应离线自检。 |
| T079 | 阻塞 | README、提交材料、运行手册、交付包 | 连接器缺创建仓库接口、浏览器未登录；提供本地 Git、ZIP、bundle 与上传说明。 |
| T080 | 待验收 | README、提交材料、运行手册、交付包 | 静态生产部署成功；完整 Next.js 真实服务端部署未配置。 |
| T081 | 待验收 | README、提交材料、运行手册、交付包 | 配置缺失关闭行为已测，回滚步骤已写；真实云端恢复演练未做。 |
| T082 | 待验收 | README、提交材料、运行手册、交付包 | 公开URL与本机独立HTTP200已核对；面试官目标网络/实机访问未测。 |
| T083 | 待验收 | README、提交材料、运行手册、交付包 | 三分钟真实浏览器操作录屏已完成，fixture明确；无真实模型调用录像。 |
| T084 | 待验收 | README、提交材料、运行手册、交付包 | 三分钟稿、十分钟提纲、问答与源码走读材料完成；用户现场演练待验收。 |
| T085 | 待验收 | README、提交材料、运行手册、交付包 | 以干净 Git 导出与 npm ci 复现；由开发执行者自检，非他人试用。 |
| T086 | 待验收 | README、提交材料、运行手册、交付包 | 源码、Git包、demo、录屏、报告齐备；用户验收尚未进行，外部限制明确。 |

## 后续推进条件

1. 配好 Supabase 与模型凭据后，先跑 E02/E03 的真实登录与隔离，再小额调用一个方案，核对账本。
2. 用开发集选模型与参数；冻结后跑保留集。40份工作流包与10异常的真实结果及人工评分是 AI 质量验收的必要输入。
3. 完成实际故障/回滚、目标网络检查与效率对比后，才更新相关待验收或阻塞项。当前公开 demo 已可独立用于解释业务流程和工程机制。
4. 用户验收时可先按根 README 的六步流程体验，无需为这些外部步骤先配置密钥。

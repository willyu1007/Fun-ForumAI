# 03 Implementation Notes — agent-social-bio-domain-and-refresh-pipeline (T-925)

## 2026-03-27

- 任务创建，待开始实现 schema/repo/domain/service。
- 对照需求文档后，确认 `T-925` 不能只停留在表结构和 refresh hook；还必须显式承接 rhetoric family、language control、版本化 prompt/few-shot 与 render telemetry。
- 当前 program 层不新拆 task，相关缺口直接并入本任务。
- 审计后补充了 `AgentBioRefreshService.inspectObservability()`，把 committed / deduped / conflict / privacy_blocked / error 计数显式暴露到 admin runtime snapshot，避免 conflict protection 只有保护没有观测。
- 新增 `src/backend/dev/backfill-agent-social-bio.ts` 与 `src/backend/dev/measure-agent-social-bio.ts`，分别作为老 agent 回填入口和 fallback ratio / family distribution / privacy block / naturalness sample 的执行入口。
- 后续质量审计又补了 3 个闭环修复：`measure-agent-social-bio.ts` 改为顺序查询以避免 Prisma `P2037` 连接打满；fallback candidate 改成 opener 多样化 + topic 片段提纯，避免冷启动文案出现“把 X 往前聊”这类生硬骨架；`meta_lexicon` / focus sanitizer 扩展到 `FREE_CHAT`、`日常信号`、`批处理`、`正式话语`、`种子成熟度` 等系统腔，避免真实模型输出把内部状态字段直接翻成 bio。
- 为了支撑 rollout 修复和存量纠偏，`AgentBioRefreshService.processMajorRefreshSweep()` 与 backfill CLI 新增 `force` 模式，不再只能等待“到期 agent”被调度刷新。

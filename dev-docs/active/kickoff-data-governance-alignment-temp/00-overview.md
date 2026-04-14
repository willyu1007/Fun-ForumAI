# 00 Overview — kickoff-data-governance-alignment-temp (T-964)

## Status

- State: in-progress
- Depends on: active `T-962 warmup-richness-admission-gap-closure-v1`, active `T-954 staging-release-verification-followup`, archived `T-132/T-137/T-156/T-157/T-158/T-159`
- Current status: kickoff 工程链路已经可用，但用户反馈当前生成结果仍停留在“静态模板 + 复用 banner”的工程可用态，未达到“导演/编剧/视觉一体编排”的内容质量标准。当前阶段已完成一次彻底清库，回到干净 canonical 基线，并重新进入内容重设计阶段：目标不再是证明 kickoff 能跑，而是给出一版真正可消费、可讨论、可作为展示基线的高质量内容蓝图。
- Next step: 基于当前任务包继续推进三项工作：1）产出导演/编剧/视觉联合内容蓝图与质量门；2）把这份蓝图拆成可导入的 kickoff patch / visual pack / runtime-simulation addendum；3）按新蓝图重做本地 kickoff，并把结果与旧版模板 kickoff 明确区分。

## Goal

围绕 kickoff 建立一份临时对齐包，先把以下问题讲清楚，再决定实现拆分：

1. 本地 / 测试环境的数据模式是否固定为 `mock(seed)` 与 `kickoff(suite)` 二选一。
2. kickoff 是否应该由单一入口从零 bootstrap，并明确 fail-closed 的前置依赖顺序。
3. staging 验证所需的 kickoff 信息与 deploy/migration 元数据如何分层，不再混淆。
4. kickoff 的回滚、删除、重建、归档、以及单条内容微调应通过哪些安全操作面完成。
5. 本地阶段如何通过 vendor-neutral 的 external assistant 形成 `kickoff patch -> import -> verify -> repair` 的闭环，而不先依赖完整 provider 配置。
6. kickoff workflow 是否需要单独的目录、入口 manifest 与分层 schema，以及它和 `config/launch` / 数据库 SSOT 的边界如何定义。
7. 本地 kickoff 是否需要独立的控制面、调试证据层与架构补完标准，以支撑高质量数据生产与高频 repair loop。

## Non-goals

- 本包不重写现有 warmup suite / active baseline 模型。
- 本包不承接 staging/prod 的真实发布执行。
- 本包不把讨论结果直接写成“允许人工改数据库”的运维流程。

## Context

- 现有 `POST /v1/dev/seed` 仍偏向 dev/mock 语义，而 kickoff 已升级为 `launch seed + warmup suite + active baseline` 的治理链。
- `verify:launch:staging` 已开始依赖 kickoff/warmup baseline 的 readiness，而不只是简单的 seed 数据存在性。
- 当前 repo 已具备 suite-level `review / retry / rebuild / archive` 与 batch-level `quarantine / restore`，但单条内容的“安全微调”还没有收口成正式 operator 面。
- 用户当前更关心的是：先把 kickoff 的数据模型、使用姿势、风险边界对齐，再决定具体实现。

## Acceptance Criteria

- [x] `roadmap.md` 明确给出 kickoff 与 mock/seed 的模式边界。
- [x] `roadmap.md` 明确给出 kickoff 从零 bootstrap 的顺序、前置依赖与失败处理口径。
- [x] `roadmap.md` 明确区分 kickoff baseline 证据与 deploy/migration 元数据。
- [x] `roadmap.md` 明确给出 rollback/archive/rebuild 与单条微调的边界，不允许直接以数据库 key 编辑作为主流程。
- [x] `roadmap.md` 明确给出 local-llm-assisted kickoff 的模式边界、闭环流程与质量/鲁棒性目标。
- [x] `roadmap.md` 明确给出 kickoff workflow 的目录方案、分层 SSOT 与三层 schema 挂载位置。
- [x] `roadmap.md` 明确给出三层 schema 的字段边界、禁止项与跨层约束。
- [x] `roadmap.md` 明确给出本地 `dev-toolbar` / kickoff debug / evidence layer 的边界与最小职责。
- [x] `roadmap.md` 明确给出本地 kickoff “架构补完”的节点清单与端到端 Definition of Done。
- [x] `roadmap.md` 明确给出 `config/kickoff/` 第一批真正落地的文件范围与暂缓项。
- [x] `01-plan.md / 02-architecture.md / 04-verification.md` 明确给出实现包、依赖顺序、最小可用切片与可执行性检查。
- [x] 已直接在当前任务包内完成实现，不再等待额外任务拆分决策。

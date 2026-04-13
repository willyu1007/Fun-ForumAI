# 00 Overview — kickoff-data-governance-alignment-temp (T-964)

## Status

- State: implementation-complete
- Depends on: active `T-962 warmup-richness-admission-gap-closure-v1`, active `T-954 staging-release-verification-followup`, archived `T-132/T-137/T-156/T-157/T-158/T-159`
- Current status: 临时对齐包已经从“十轮需求冻结”进入实现完成态，并完成了一轮 review-driven cleanup：`config/kickoff/` 声明层、backend kickoff bootstrap/import/report/readiness/run artifact/services、dev-only kickoff routes、frontend `DevAuthToolbar` / `DevKickoffPanel`、`WarmupGovernanceTab` 最小精修入口、以及 `verify-launch-readiness.mjs` 的四层分组输出均已落地；本轮还补上了 `Mock/Smoke` 的 reset+load、本地 profile/mode/kind 一致性 guard，以及重建 thread 后的新 id 刷新。定向 kickoff 测试已通过 9 个测试文件 / 23 个测试；全仓 `pnpm typecheck` 仍存在失败，但当前仅剩 repo 既有问题（`forum-roaming`、`recall-state-store`、`forum-read-service`、`thread-search-provider`），不再包含本轮 kickoff 新增文件。
- Next step: 以本任务包作为 kickoff 本地链路的当前实现基线，后续如果需要继续推进，可转向两类工作：1）处理 repo 既有 typecheck 遗留；2）在真实本地使用中继续打磨 patch pack 内容质量、suite edit 交互体验、以及 runtime-simulation 的更深层行为。

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

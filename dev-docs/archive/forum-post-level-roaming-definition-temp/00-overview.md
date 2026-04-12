# 00 Overview — forum-post-level-roaming-definition-temp

## Status

- State: done
- Governance mapping: 临时任务包；按用户要求不注册到 `.ai/project/main/` 索引，也不创建项目级任务映射。
- Current status: `Forum Post-Level Roaming V1` 首个落地切片已经完成并归档。runtime 已落地两段式 `arrival selection -> body generation` 闭环，`START_NEW_THREAD` / `HANDOFF` / `observe_only` 的执行与审计都已闭合，discussion forest 的 reader-facing 语义没有被本轮实现改写。
- Next step: 无。若后续继续推进，只应在新的 follow-up bundle 中处理跨 `post` roaming、`audience lane`、或额外 explainability / UX 方案。

## Goal

把 `post-level roaming` 的 V1 设计真正落成到 runtime 主链，重点闭合：

- `post` 级舞台边界与 `thread/branch` 级落点的关系
- 导演编排边界与 agent 自主性的分工
- V1 roaming 动作空间与执行闭环
- discussion forest 的 UX 边界与 explainability 约束

## Non-goals

- 不做跨 `post`、跨 `community` 的 roaming。
- 不做 `audience lane` agent authoring 或 audience route synthesis。
- 不重写 persona runtime、director runtime 或 discussion forest 数据模型。
- 不向 reader-facing payload 暴露 roaming explainability、内部 orchestration score、hidden policy 名称或完整决策链。

## Acceptance Criteria

- [x] 新增 roaming 内部合同与执行计划解析，不改 public API。
- [x] forum thread runtime 走两段式 `Call 1 selection` + `Call 2 body generation`。
- [x] `START_NEW_THREAD` / `HANDOFF` / `observe_only` 的写入与 no-write 审计闭环成立。
- [x] Call 1 走独立模板、独立 json-object policy、lite routing，并经 live run 证明实际命中 Qwen-Flash。
- [x] discussion forest / route CTA 的 reader-facing 语义保持冻结，没有新增 explainability 文案或 debug 字段消费。

## Closure Summary（2026-04-12）

- 已交付：
  - roaming contracts / candidate builder / decision parser / execution-plan resolver
  - runtime 两调用闭环
  - `route_handoff` pass-through
  - fail-closed selection parser
  - `no_write` 与 write path 的统一 audit shape
  - Qwen-Flash lite selection routing、local-kind smoke、Chrome + DB + log 真实 E2E 验证
- 本轮清理：
  - 任务包已从 `dev-docs/active/` 迁移到 `dev-docs/archive/`
  - 规划阶段文件已移除，避免与已落地实现形成双轨语义
  - 本轮 Playwright 临时结果目录已删除

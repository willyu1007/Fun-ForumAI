# 00 Overview — pg-repository-consistency-hardening (T-024)

## Status
- State: in-progress
- Next step: staging smoke + 性能基线已完成；Phase 2（分页优化/索引调优）可按需启动；Phase 4（feature flag）待评估。

## Goal
让 Pg 仓储在多实例部署下以数据库为一致性主源，消除进程级缓存导致的数据分叉风险。

## Non-goals
- 不引入新的业务功能。
- 不处理 Runtime 队列外置（T-023 负责）。
- 不进行 WebSocket 迁移。

## Context
当前 Pg 仓储大量依赖本地 Map/Array 作为主读源，并异步写库。该模式在单实例可工作，但多副本部署时会导致视图不一致、回放困难和状态漂移。

## Acceptance criteria (high level)
- [x] 关键 Pg 仓储改为 DB-first 读写语义。
- [x] 多实例场景下读写结果一致且可重复验证（staging K8s 双实例 smoke 已通过）。
- [x] 接口返回契约不破坏现有前端调用。

# Forum Roaming Hardening + Read Path Cleanup（临时任务包）

## Goal

在不改 public forum/write API、不过早引入 reader-facing explainability、且不把 `audience lane` 纳入本轮 roaming candidate 的前提下，完成两阶段工作：

1. 闭环 `fallback observability`、`candidate synthesis`、`recall state durability`
2. 清理 `search / legacy read path` 工程债

## Non-Goals

- 不做 reader-facing explainability UI / badge / 文案。
- 不把 `audience lane` 引入 roaming candidate 或 public write 新语义。
- 不改 `/v1/posts/:postId/threads` 的 public 兼容语义。
- 不做项目级任务索引同步，不进入 `.ai/project/main/`。

## Status

- 状态：`done`
- 归档阶段：`archived_after_live_validation`

## Outcome

- `fallback observability` 已升级为 admin-only 结构化 taxonomy，包含 fallback/no-write counters、selection path 聚合与 recent samples。
- roaming candidate 已改为机会感知化合成，显式消费 `forum_attention_hint`、`evidence_turn_ids` 与 forest/read-guide 信号，并把 `ranking_reasons` 写入 audit/debug 面。
- recall state 已切到 Redis First，pair/revive grant 改为跨实例共享且原子执行；in-memory 仅保留给测试与无 Redis 退化环境。
- `ThreadSearchProvider` 已迁到 batch projection-first；`ContextBuilder`、`ProactiveEventHandler`、`PublicObservationDigestService`、`HomeProgrammingService` 已退出新的 `getThreads()` 主链。

## Verification Summary

- 本地验证：`tsc --noEmit` 通过，相关 `vitest` 定向回归通过。
- local-kind：带真实 Qwen / Doubao key 的 `pnpm k8s:staging:local:smoke` 通过，generic runtime smoke 通过。
- live forum probes：
  - 真实 `ThreadOpened` / `ThreadTurnAdded` 均成功进入 roaming 闭环
  - admin/runtime 可见结构化 observability
  - DB `agent_runs.output_json.audit_metadata.forum_roaming` 与前台行为一致
- reader boundary：`discussion-forest` 未泄漏 roaming / fallback / selection debug 字段。

## Final Notes

- 归档时移除了 `01-plan.md`、`02-architecture.md`、`03-implementation-notes.md`，避免后续继续在已完成临时任务上做 active 级双轨开发。
- 历史实现细节与 live 发现的 bug 已压缩进 `04-verification.md` 与 `05-pitfalls.md`。

# 01 Plan

## Phases

1. Phase A: 创建 `T-915` 任务包并同步 governance。`[completed]`
2. Phase B: 修复 search projection drift、discoverability matrix 与 targeted reconcile。`[completed]`
3. Phase C: 升级 `/v1/search` contract、空查询 discovery 与 search telemetry。`[completed]`
4. Phase D: 收敛 `/v1/agents` 搜索、切换 `/agents` 页面，并增强 comments thread-context。`[completed]`
5. Phase E: 运行 targeted tests / typecheck / governance sync-lint，并记录 rollout/backout。`[completed]`

## Detailed Steps

- 先落任务包、`.ai-task.yaml`、roadmap，并运行 governance sync 注册 `T-915`。
- 为 `SearchGuard`、`SearchProjectionService`、search providers 增加 discoverability matrix、restricted author 降级和 agent fan-out reconcile。
- 为 search docs repo / service / shared contract 增加 additive fields、discovery payload、reconcile health/runtime telemetry。
- 删除旧 `GET /v1/agents` list/search 语义，切换 `/agents` 页面、测试与调用方到 `/v1/search?tab=agents` 主链。
- 扩展 comments thread-context 为父链 + 近邻，并让帖子详情页继续按单一 comment list 合并渲染。
- 跑 backend/frontend unit、e2e-read-api、typecheck、governance lint，并把命令与结果记入 `04-verification.md`。

## Exit Criteria

- `00-overview.md` 的 acceptance criteria 全部满足。
- 相关测试与静态检查通过。
- `03-implementation-notes.md`、`04-verification.md`、`05-pitfalls.md` 按实际执行情况更新。

## Risks & Mitigations

- Risk: targeted reconcile 漏掉某类历史文档，导致只修表面字段。
  - Mitigation: 为 agent-scoped reconcile 做显式 scope 汇总与测试，覆盖 posts/comments/communities/agent doc。
- Risk: `/v1/search` additive 字段导致前端类型或旧测试断裂。
  - Mitigation: 旧字段不删不改，新增测试覆盖兼容 contract。
- Risk: `/agents` 页切换到新搜索后，follow/blank state/disabled flag 行为回归。
  - Mitigation: 保留目录页 UI，但把数据源切到新搜索，并补页面测试。

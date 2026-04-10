# 02 Architecture

## Core Decisions

- `T-144` 保持完成态；`T-943` 不 reopen historical governance baseline，只做 canonical viewer write plane 收口。
- 已落地的 governance/result contract 保持为 owner truth；本包新增 owner scope 只包括 accepted-write main path 与 compat route policy。
- unified 的是基础 fanout surface，不要求 viewer write 与 agent/forum write 复用所有持久化实现细节。

## Pack Contract

### Inputs

- `T-144` 已冻结的 public participation baseline
- pack1 的 lifecycle / route / anchor semantics
- forum auth、moderation、rate-limit、audit 基础设施
- 帖子详情来自 discussion forest / composer 的 anchor reply 入口
- `forumWriteService.setEventHook(...)` 及其当前下游消费者矩阵

### Outputs

- community/post effective contract read API
- post override write API
- `/viewer/*` public write API
- `PublicWriteGovernanceService` 或等价治理平面
- accepted viewer write 的 unified side-effect fanout
- legacy public write route 的 compat/deprecation policy
- 稳定结果语义：
  - `ACCEPTED`
  - `PENDING_MODERATION`
  - `REJECTED`
  - `RATE_LIMITED`

### Frozen Rules

- 契约与治理平面必须独立于 read router 旁支存在。
- viewer write 的锚点语义必须复用 canonical anchor，而不是 UI 自定义。
- audit record 必须能重放：
  - 谁写了
  - 以什么身份写
  - 命中了什么 contract / flag / moderation / rate-limit 结果
- 即使首版仍以 auto-approve 为主，也不能把结果 contract 写死成“必定即时成功”。
- accepted viewer write 不能继续依赖 route-level manual refresh 才触发核心下游消费者。
- `/viewer/*` 是唯一演进中的 canonical viewer write contract；legacy public write routes 不能继续获得新能力。

## Risks

- 若 viewer accepted write 继续绕过 unified fanout，会让 search/runtime/SSE/stats/proactive 出现二义性。
- 若 legacy public write routes 继续被当成主路径，未来权限和审计策略会再次分裂。

## Review Gate

- post override 是否已经明确 owner/admin 权限与清除语义
- governance plane 是否已经稳定承担 allow / rate-limit / moderation / audit
- `/viewer/*` 是否已成为唯一演进路径，而不是和 legacy path 并行漂移
- 结果 envelope 是否足以支撑 future moderation / hold / reject，而不需要破坏兼容
- actor / session / feature-flag snapshot 是否已进入 audit
- accepted viewer write 是否已经进入统一 fanout，而不是 route-level patchwork

## Handoff Outputs

- `EffectiveParticipationContract`
- stable viewer write result envelope
- audit record schema
- override 行为与权限说明
- canonical route map
- unified fanout matrix

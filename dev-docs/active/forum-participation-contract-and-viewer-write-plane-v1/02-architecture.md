# 02 Architecture

## Core Decisions

- `T-144` 保持完成态；本包只做 write plane 与 effective contract 升级。
- 新 write plane 统一处理 auth / audit / source context / idempotency。
- 首版结果语义保持兼容即时通过，但 response envelope 预留 `result`、`audit_id`。

## Pack Contract

### Inputs

- `T-144` 已冻结的 public participation baseline
- pack1 的 lifecycle / route / anchor semantics
- forum auth、moderation、rate-limit、audit 基础设施
- 帖子详情来自 pack2 的 composer / anchor reply 入口

### Outputs

- community/post effective contract read API
- post override write API
- `/viewer/*` public write API
- `PublicWriteGovernanceService` 或等价治理平面
- 稳定结果语义：
  - `ACCEPTED`
  - `PENDING_MODERATION`
  - `REJECTED`
  - `RATE_LIMITED`

### Frozen Rules

- 契约与治理平面必须独立于 read router 旁支存在
- viewer write 的锚点语义必须复用 canonical anchor，而不是 UI 自定义
- audit record 必须能重放：
  - 谁写了
  - 以什么身份写
  - 命中了什么 contract / flag / moderation / rate-limit 结果
- 即使首版仍以 auto-approve 为主，也不能把结果 contract 写死成“必定即时成功”

## Risks

- 若继续把 viewer write 放在 read router，会让森林视图和 contract 驱动入口继续分叉。
- 若 stage reply 仍只支持 thread root，forest node 和 anchor reply 会断开。

## Review Gate Before Moving On

### Before `T-944` Uses It As a Hard Dependency

- post override 是否已经明确 owner/admin 权限与清除语义
- governance plane 是否已经稳定承担 allow / rate-limit / moderation / audit
- `/viewer/*` 是否已成为唯一演进路径，而不是和 legacy path 并行漂移
- 结果 envelope 是否足以支撑 future moderation / hold / reject，而不需要破坏兼容
- actor / session / feature-flag snapshot 是否已进入 audit

### Handoff Outputs

- `EffectiveParticipationContract`
- stable viewer write result envelope
- audit record schema
- override 行为与权限说明

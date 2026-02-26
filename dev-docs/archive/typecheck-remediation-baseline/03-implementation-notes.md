# 03 Implementation Notes — typecheck-remediation-baseline (T-027)

## Status
- Current status: `done`
- Last updated: 2026-02-26

## What changed
- 完成 M2：前端 compile-only 修复（`AgentCreateWizard` 未使用变量、`StyleControlPanel` 的 `useRef` 初始化与安全清理）。
- 完成 M3：后端类型契约修复（`NewMessageCreated` 配额补齐、Pg 仓储 JSON 写入显式适配 Prisma JSON 类型）。
- 完成 M4：私聊路由依赖装配改为容器统一注入，移除路由内重复构造 `PrivateChannelService/MemoryService`。
- 完成 M5 核心验证：`typecheck` 全绿、`test` 全绿、DB 持久化模式下私聊路由加载 smoke 通过。

## Files/modules touched (high level)
- `src/frontend/features/agents/components/AgentCreateWizard.tsx`
- `src/frontend/features/agents/components/StyleControlPanel.tsx`
- `src/backend/allocator/config.ts`
- `src/backend/repos/pg/pg-agent-repository.ts`
- `src/backend/repos/pg/pg-community-repository.ts`
- `src/backend/repos/pg/pg-event-repository.ts`
- `src/backend/container.ts`
- `src/backend/routes/private-channel-api.ts`
- `dev-docs/active/typecheck-remediation-baseline/*`

## Decisions & tradeoffs
- Decision: 先做“生成物一致性 + 最小修复”，避免一次性大改。
- Rationale: 降低回归风险，便于快速恢复编译基线。
- Alternatives considered: 直接大范围重构仓储实现（已拒绝，超出当前目标）。
- Decision: 私聊依赖采用容器统一注入而非路由内补齐。
- Rationale: 消除双重装配，确保 `PrivateChannelServiceDeps` 契约在单一位置维护。
- Alternatives considered: 放宽 `PrivateChannelServiceDeps` 为可选（已拒绝，契约会变松）。

## Deviations from plan
- 暂无。

## Known issues / follow-ups
- 当前计划内修复项已完成并归档。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).

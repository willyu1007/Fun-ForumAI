# 01 Plan

## Key decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | 持久化策略 | 全量 Pg + InMemory fallback | 养成数据重启不能丢; 环境变量控制切换 |
| D2 | Pg 实现位置 | `src/backend/repos/pg/` 子目录 | 与 InMemory 实现平行，接口不变 |
| D3 | 预算单位 | 行动次数(对外) + token 数(内部) | 人类看行动次数更直观; 内部用 token 精确计量 |
| D4 | 预算档位 | 4 档(节能20/平衡60/全力150/自定义) | 简单选择 + 高阶自定义 |
| D5 | 超限策略 | 渐进降级(90%降频→100%停止→手动追加) | 比硬停更有养成感 |
| D6 | 多 Agent 限制 | 10 agents/人, 独立预算 | 用户确认 |
| D7 | Post/Comment 迁移 | 同批迁移 | 用户确认全量持久化 |
| D8 | 成本来源 | 全局池(dev); 未来免费额度+用户付费 | 用户确认 |

## Dependencies
- PostgreSQL 数据库可用
- Prisma Client 已配置
- 现有 InMemory Repository 接口（迁移基线）
- AgentRun.token_cost 已有（成本数据来源）

## Phases

### Phase 1 — Prisma Schema 扩展 + Migration
**目标**: 建立完整的持久化数据模型
**验收**: migration 成功, `pnpm prisma generate` + `pnpm tsc --noEmit` 通过

### Phase 2 — Pg Repository 实现
**目标**: 所有实体的 Pg 仓库实现, InMemory→Pg 透明切换
**验收**: 现有论坛+聊天室功能在 Pg 模式下正常; 数据重启后持久

### Phase 3 — Agent Dashboard
**目标**: 聚合 API + 前端面板展示 Agent 当前状态和活动统计
**验收**: Dashboard 显示实时数据; SSE 推送更新

### Phase 4 — 成本管理系统
**目标**: 预算控制 + 成本追踪 + 前端回顾面板
**验收**: 行动计入预算; 超限降频; 成本回顾可视化

## Estimation

| Phase | Effort | Risk |
|-------|--------|------|
| P1 | ~2h | Low |
| P2 | ~2.5h | Medium — 需逐一对齐 InMemory 行为 |
| P3 | ~2h | Low |
| P4 | ~2.5h | Medium — budget guard 需嵌入两个运行时入口 |
| **总计** | **~9h** | |

## Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pg 切换引入行为差异 | High | 接口不变 + InMemory fallback + 逐实体验证 |
| Migration 冲突 | High | dev 环境 migrate reset 安全 |
| Budget guard 误拦 | Medium | soft-limit 只降频; hard-limit 有手动追加 |

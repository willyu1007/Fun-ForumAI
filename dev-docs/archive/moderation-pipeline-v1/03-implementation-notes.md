# 03 Implementation Notes

## Status
- Current status: done (Phase 1–3)
- Last updated: 2026-02-21

## What changed
- 实现三阶段审核管线（Rule Filter → Risk Classifier → Decision Engine）。
- 实现 GovernanceService（治理动作映射 + audit trail 回调）。
- 147 项测试全部通过。

## Files/modules touched

| File | Purpose |
|------|---------|
| `src/backend/moderation/types.ts` | 领域类型：RiskLevel, ModerationResult, GovernanceAction, 阶段接口契约 |
| `src/backend/moderation/config.ts` | 可配置项：默认阈值、关键词黑名单、PII 模式、URL 黑名单、权重关键词 |
| `src/backend/moderation/rule-filter.ts` | Stage 1: 关键词/PII/URL 规则过滤，block/flag 两级严重度 |
| `src/backend/moderation/risk-classifier.ts` | Stage 2: 关键词权重评分 → risk_score (0-1)，多类别检测 |
| `src/backend/moderation/decision-engine.ts` | Stage 3: score × 社区阈值 → visibility + state + verdict |
| `src/backend/moderation/moderation-service.ts` | 管线编排器 + fail-closed 错误处理 |
| `src/backend/moderation/governance-service.ts` | 治理动作执行 + onPersist 审计回调 |
| `src/backend/moderation/index.ts` | 公共导出 |
| `src/backend/moderation/__tests__/*.test.ts` | 4 个测试文件，35 项测试 |

## Decisions & tradeoffs
- Decision: MVP 使用关键词权重而非 ML 分类器
  - Rationale: 零外部依赖，可在无 LLM 调用的情况下完成审核；接口已抽象，后续可替换
- Decision: PII email 为 flag（不阻断），SSN 为 block（阻断）
  - Rationale: email 在论坛讨论中常见且风险较低；SSN 属于高敏感 PII
- Decision: fail-closed 默认到 GRAY/PENDING 而非 QUARANTINE
  - Rationale: 避免审核服务闪断时大量内容进入不可见状态；GRAY 仍可展示（折叠）
- Decision: GovernanceService 使用 onPersist 回调而非直接写 DB
  - Rationale: 保持业务逻辑与持久化解耦；生产对接时注入 repository

## Deviations from plan
- 无重大偏差。Governance API route handler 填充留给 DB 对接阶段。

## Known issues / follow-ups
- 关键词黑名单使用占位符（`__BLOCK_HATE__` 等），生产需替换为真实词库或外部配置。
- 权重关键词同理，需要运营配置真实词库。
- GovernanceService 的 DB 持久化需在 PostgreSQL migration 后对接。
- 举报入口（POST /v1/reports）的 service 层逻辑待 Agent Runtime 对接时实现。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in 05-pitfalls.md (append-only).

# 04 Verification

## Checks planned
- [x] 低风险内容 → visibility=PUBLIC, state=APPROVED
- [x] 中风险内容 → visibility=GRAY, state=APPROVED（默认折叠）
- [x] 高风险内容 → visibility=QUARANTINE 或 state=REJECTED
- [x] 社区 A 阈值宽松 vs 社区 B 阈值严格 → 同内容不同分级
- [x] 审核服务异常时 → 内容默认进入 GRAY/PENDING（fail-closed）
- [x] PII 模式匹配：邮箱被标记(flag)、SSN 被阻断(block)
- [x] 关键词黑名单命中 → 立即拦截(REJECT)
- [x] 管理员可通过 GovernanceService 批准 gray 内容到 public
- [x] 管理员可封禁/解封 agent
- [x] 治理动作触发 onPersist 回调（可审计）
- [x] URL 黑名单命中 → 阻断
- [x] 多规则同时命中时全部记录到 matched_rules
- [x] 评分上限 cap 在 1.0
- [x] 严格社区 auto_reject 在更低分数触发

## Checks run (2026-02-21)

### Test summary
- **17 test files, 147 tests passed**
- typecheck ✓, lint ✓, all green

### Test breakdown — moderation module
| Module | Tests |
|--------|-------|
| rule-filter.test.ts | 7 |
| risk-classifier.test.ts | 6 |
| decision-engine.test.ts | 9 |
| moderation-service.test.ts (e2e + fail-closed) | 12 |
| governance-service.test.ts | 7 |
| **Moderation subtotal** | **41** |
| Allocator (pre-existing) | 92 |
| Other (pre-existing) | 14 |

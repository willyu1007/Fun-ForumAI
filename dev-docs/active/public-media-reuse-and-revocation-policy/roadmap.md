# Roadmap — public-media-reuse-and-revocation-policy (T-121)

## Summary

给 public media planner 增加显式治理：控制候选来源、canonical 池 authoring、重复/疲劳惩罚、policy 审计和 revoke 语义，防止图片复用在产品放量后变成不可追踪的隐式规则。

## Milestones

1. source scope matrix 冻结。`[pending]`
2. candidate scoring / repeat guard 冻结。`[pending]`
3. canonical asset authoring/control-plane contract 冻结。`[pending]`
4. revoke / invalidation 语义冻结。`[pending]`
5. audit + origin disclosure + copyright contract 完成。`[pending]`

## Risks

- 没有 source scope hard filter，会让 private/public 边界失守。
- 没有 revoke semantics，会让禁用策略无法真正阻断后续复用。

## Rollback

- 若评分规则需要后调，可先保留 scope filter 和 revoke hard rule，不回滚治理边界。

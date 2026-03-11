# T-050 Rich Communities Gap Hardening Roadmap

## Objective
修复 T-049 高优缺口，完成安全性、语义一致性与运维可执行性收口。

## Milestones
1. M1: Membership 与 flag 语义修复。
2. M2: Incubation 状态机修复。
3. M3: Audience + Stage template ops 修复。
4. M4: 文档与治理同步、回归验证。

## Rollback
- 所有修复均为逻辑层，异常时可通过回退 commit 恢复；不涉及 DB migration 回滚。

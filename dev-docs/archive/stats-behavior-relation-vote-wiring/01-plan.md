# 01 Plan — T-041

## Decisions
- D1: 不改 allocator 同步接口，使用 stats snapshot/hint 注入
- D2: 手动活跃控制优先于 stats
- D3: vote 仅做策略接线，不新增 runtime 自动投票
- D4: relation 接口保持向后兼容，增量引入 stats-aware policy

## Phases
1. Candidate + Chat integration
2. Memory/Learning integration
3. Relation/Vote policy integration
4. tests + rollout rehearsal

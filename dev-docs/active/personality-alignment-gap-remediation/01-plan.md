# 01 Plan — T-048 Delta Packages

## Delivery phases (frozen)
1. PKG-0: Membership 语义修复 + `PATCH /v1/agents/:agentId/memberships`
2. PKG-1: Global Highlights 聚合 + `/highlights` 前端入口
3. PKG-2: Signal/Chronicle 分阶段隔离（A 去污染 / B 双写 / C 切读）
4. PKG-3: Director V2 硬阀门与意义化角色池
5. PKG-4: PPR Refresh V2（增量分层 + daily 全量 + topic 权重）
6. PKG-5: Community Culture Digest（weekly + ttl/version + prompt 注入）
7. PKG-6: Runtime feature observability（启动快照 + admin 只读接口）
8. 文档治理与验收证据回写

## Current execution status
- [x] PKG-0
- [x] PKG-1
- [x] PKG-2（A/B/C 合并落地）
- [x] PKG-3
- [x] PKG-4
- [x] PKG-5
- [x] PKG-6
- [x] 本地自动化验证（typecheck + full test）
- [ ] staging 灰度与真实调用成本证据

## PR slicing (planned alignment)
1. PR-A: PKG-0
2. PR-B: PKG-1
3. PR-C: PKG-2A
4. PR-D: PKG-3
5. PR-E: PKG-4
6. PR-F: PKG-2B/C
7. PR-G: PKG-5
8. PR-H: PKG-6
9. PR-I: 文档与验收证据

## Exit criteria
- 报告 P0 + P1 每条均具备：代码修复 + 测试证据 + 开关回滚路径。
- staging 依赖分批灰度：
  - Batch-1（data/obs）: memberships + signal隔离A + runtime features
  - Batch-2（allocator）: director v2 + ppr refresh v2
  - Batch-3（experience）: global highlights + community digest
- 每批 5% -> 25% -> 100%，每档 24h 观察。

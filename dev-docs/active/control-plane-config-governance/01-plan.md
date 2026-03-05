# 01 Plan — T-054

## Phase 1 Data Model
1. `CommunityConfigVersion`
2. `CommunityConfigPatch`
3. `CommunityConfigApproval`

## Phase 2 Service & APIs
1. config proposal/validate/approve/apply/rollback API。
2. 风险分级（低风险直通，高风险审批）。

## Phase 3 Event & ACK
1. 发出 `COMMUNITY_CONFIG_*` 事件。
2. 写入组件 ACK 事件（allocator/aftershow/notification）。

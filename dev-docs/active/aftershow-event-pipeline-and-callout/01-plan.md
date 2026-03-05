# 01 Plan — T-055

## Phase 1 Data Model
1. `AftershowArtifact`
2. `AftershowCallout`
3. 通知类型扩展

## Phase 2 Pipeline
1. due -> snapshot -> compose -> publish 状态机。
2. 发布主贴 aftershow block。

## Phase 3 Notification
1. only-when-visible。
2. per-user/per-post 限频与幂等。

# 03 Implementation Notes — T-056

## 2026-03-05
- 新增 RoleAssignment 仓储与类型：
  - `src/backend/repos/role-assignment-repository.ts`
  - `src/backend/repos/pg/pg-role-assignment-repository.ts`
  - `src/backend/repos/types/governance.ts`
- 新增服务：
  - `src/backend/services/role-assignment-service.ts`
  - 支持 assign/update，并发出 `ROLE_ASSIGNED/ROLE_REVOKED/ROLE_EXPIRED` 事件。
- 控制面 API：
  - `POST /v1/communities/:id/role-assignments`
  - `PATCH /v1/communities/:id/role-assignments/:assignmentId`
- 读取 API：
  - `GET /v1/posts/:postId/aside-seats`
- allocator 集成：
  - `src/backend/container/allocator.ts`
  - 在 `roleAssignmentV1` 开启时，仅允许 post scope aside seats 在该 post 进入候选池。

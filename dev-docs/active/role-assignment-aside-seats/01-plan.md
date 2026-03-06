# 01 Plan — T-056

## Phase 1 Data Model
1. 新增 `RoleAssignment`。
2. scope 支持 `COMMUNITY` 与 `POST`。

## Phase 2 APIs
1. `POST /v1/communities/:id/role-assignments`
2. `PATCH /v1/communities/:id/role-assignments/:assignmentId`
3. `GET /v1/posts/:postId/aside-seats`

## Phase 3 Runtime Integration
1. write gate + allocator 使用 role context。
2. 过期与撤销事件化。

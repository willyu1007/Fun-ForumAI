# 00 Overview — role-assignment-aside-seats (T-056)

## Status
- State: done
- Next step: 等待归档确认。

## Goal
在 Membership 基础上增加 RoleAssignment（COMMUNITY/POST），实现 aside seats 容量、轮换与角色态治理。

## Non-goals
- 不引入复杂 showrunner 组织模型（owner/admin/system 先行）。

## Acceptance criteria (high level)
- [x] RoleAssignment 支持 assign/update/revoke/expire。
- [x] 写入闸门与 allocator 能读取 role 上下文。
- [x] 角色事件 `ROLE_ASSIGNED/EXPIRED/REVOKED` 完整可审计。

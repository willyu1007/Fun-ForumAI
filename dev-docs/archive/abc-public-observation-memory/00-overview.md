# 00 Overview — abc-public-observation-memory (T-036)

## Status
- State: done
- Next step: completed and archived.

## Goal
实现公共经历沉淀链路（PUBLIC_OBSERVATION），并提供来源可追溯、owner 可读的查询接口，支持后续回顾体验扩展。

## Non-goals
- 不做前端“上一集回顾”页面。
- 不做好友关系系统。
- 不做 WebSocket 协议升级。

## Acceptance criteria (high level)
- [x] Forum/Room 满足阈值可生成公共摘要记忆（flag on）。
- [x] AgentMemory 存在来源锚点字段与索引（schema + migration file）。
- [x] 记忆读取支持 `source_ref_type/source_ref_id` 过滤。
- [x] 新增 public observation 读接口（owner-only）。
- [x] Flag 关闭时不触发公共摘要写入。

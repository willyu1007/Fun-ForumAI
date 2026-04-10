# 00 Overview

## Status
- State: done
- Next step: 向用户同步修复面、校验结果与剩余注意事项。

## Goal
收敛本轮全仓审查暴露出的关键回归，使仓库重新回到可通过完整校验链的状态。

## Non-goals
- 不引入新的 public API version。
- 不做与本轮失败无关的结构性重构。
- 不修改数据库 schema 或迁移。

## Context
本轮全仓审查发现仓库在 typecheck、lint、unit/e2e test、launch gate 上同时失稳。已确认的高优先级根因包括：
- 数据面 thread/turn 写入后又走重读模型，缺失 participation contract 依赖时把成功写入回退成 404。
- 媒体资产 owner promote/demote 后，用“可读取 URL”缺失误报成“资产不存在”。
- 动态 import 恢复 helper 的泛型约束过窄，直接阻塞 typecheck。
- 论坛读模型在未注入 lifecycle service 的轻量上下文中直接抛错，导致 public observation forum digest 整段失效。

此外，本轮全量校验还暴露出若干跟进问题，包括前端测试 fixture 漏字段、反馈页上传控件测试断言不匹配、semantic projection 的 public bio 兼容性等，需一并收口后再重跑全套验证。

## Acceptance criteria (high level)
- [x] review 指出的 4 个发现均以代码修复而非测试绕过的方式收口。
- [x] 定向测试通过：data-plane、media-asset-control、lazy-import-recovery、public-observation、semantic-projection、feedback page。
- [x] `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm verify:launch:ci` 通过。
- [x] 与当前仓库脚本对齐的整套仓级校验重新跑完，并记录结果。

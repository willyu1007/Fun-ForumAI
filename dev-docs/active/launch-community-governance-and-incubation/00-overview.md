# 00 Overview — launch-community-governance-and-incubation (T-141)

## Status

- State: done
- Depends on: `T-132`, `T-134`
- Next step: 由 `T-137` 和后续运营任务继续消费 proposal / lifecycle / control-plane contract。

## Goal

把首发社区新增治理从 P1 优化项前移为 P0 contract，使“用户提案 -> 系统归并建议 -> 管理员审核 -> GRAY 孵化 -> 转正/合并/归档”成为可执行的治理链。

## Non-goals

- 不开放自由建 public community。
- 不在本任务中实现完整后台 UI。
- 不重写现有 `CommunityConfigPatch / Version / Approval` 治理底座。

## Context

需求文档已明确：首发期的社区本质上是节目单，而不是自由裂变树。当前仓库已有 config proposal、incubation、visibility 分层与 control-plane 能力，因此最合理的路径是补治理 contract，而不是另起体系。

## Acceptance Criteria

- [x] 明确用户提案 contract。
- [x] 明确系统归并建议 contract。
- [x] 明确管理员动作集合与社区生命周期状态机。
- [x] 明确 `GRAY` 孵化期的最小规则与 control-plane 面板需求。

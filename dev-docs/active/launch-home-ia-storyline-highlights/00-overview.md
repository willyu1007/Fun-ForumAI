# 00 Overview — launch-home-ia-storyline-highlights (T-135)

## Status

- State: planned
- Depends on: `T-132`, `T-134`, `T-140`
- Next step: 评审 `home_ia_and_shelves.v1.yaml`，并拆成首页读模型、首页编排和高光/aftershow 前台实现任务。

## Goal

把首页从普通 feed 入口升级为“编辑化观看入口”，让用户能一眼理解当前最值得看的内容、主线和节目节奏。

## Non-goals

- 不在本任务中重写 feed 基础接口。
- 不把所有推荐逻辑一次性升级为完整 PPR。
- 不在本任务中重复定义全站 visual rollout contract；该 ownership 已固定在 `T-140`。

## Context

仓库已有 highlights、aftershow 和相关读面基础，但用户面仍缺少明确的 shelf、storyline 标识和节目单感知。`T-135` 需要定义“哪些内容该被看到”，并明确消费 `T-140` 的 `surface_kind / card_mode / thumbnail_policy`。

## Acceptance Criteria

- [ ] 首页 shelf 固定为 `今日必看 / 冲突升级中 / T4 今日笔记 / 剧情继续看 / 今晚节目单 / 全部社区`。
- [ ] 明确 `storyline`、`highlight`、`aftershow` 的用户可感知包装。
- [ ] 明确新增前台分发字段及 fallback 规则。
- [ ] 明确与 `T-140` 的 visual contract 结合方式。
- [ ] 确保 feature flag 关闭时可回退到当前 feed/highlights 形态。

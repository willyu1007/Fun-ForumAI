# 00 Overview — director-report-history-lifecycle-and-segmentation (T-101)

## Status
- State: done
- Outcome: archive / summary / scheduler / report 已在本地真实数据库写入后闭环，`T-101 / R-064 / F-060` 可保持完成态。

## Goal
把导演编排相关的 read-only 报表和历史证据管理升级成“历史全生命周期 + 当前验收隔离”：
- 原始历史 `episode / runtime state / scene metadata / room program event` 继续保留；
- 热数据窗口固定为 `90 天`；
- 超窗数据迁入同库 archive 表并永久保留；
- 默认 current health 只看 summary-backed 新合同窗口；
- historical/legacy 样本单独输出，不再混进当前 pass/fail。

## Non-goals
- 不删除数据库中的历史 episode。
- 不引入新的 public API。
- 不归档 `posts`、`comments`、`rooms`、`room_episodes`、`room_episode_beats`。

## Acceptance criteria
- [x] `scripts/director-history-maintenance.mjs` 支持 `dry-run / archive / backfill / refresh-summary / run-daily`。
- [x] `scripts/director-closure-report.mjs` 默认走 summary，`--use-raw` 仅作为对账/排障开关。
- [x] `forum_scene_metadata / runtime_scene_states / room_program_events` 超窗数据完成 archive，并保留历史审计价值。
- [x] `director_current_scope_summaries / director_historical_daily_summaries` 能支撑 current + historical 报表。
- [x] backend scheduler 能定时复用同一 maintenance script，不出现第二套 archive 规则。

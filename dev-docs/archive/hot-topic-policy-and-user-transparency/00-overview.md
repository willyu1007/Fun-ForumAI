# 00 Overview — hot-topic-policy-and-user-transparency (T-091)

## Status
- State: done
- Next step: 进入维护期；公开政策页与运营后台已拆到 `T-092` / `T-093`，本包后续只承接热点策略引擎本身的 follow-up。

## Goal
让允许域热点可运营、敏感域默认被拒，并把 kill switch、NO_RECOMMEND、sampled review 与在位透明提示补齐。

## Non-goals
- 不承载公开政策/帮助页；这些已拆到 `T-092`。
- 不承载热点运营 dashboard / alerts / 控制台交互；这些已拆到 `T-093`。

## Acceptance criteria (high level)
- [x] default-deny 热点域矩阵生效。
- [x] 线程 / 房间漂移检测与 sampled review 阈值能触发 `HOT_TOPIC` case。
- [x] 用户能看到 AI label、实名提示、举报/申诉状态与 fold/quarantine/reject 文案。
- [x] community/scene/agent / room 级 kill switch 与 `NO_RECOMMEND` 生效。
- [x] gray/deny keyword override 可直接触发 `NO_RECOMMEND` 或 `BLOCKED`。

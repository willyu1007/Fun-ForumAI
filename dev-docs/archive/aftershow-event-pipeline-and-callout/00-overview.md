# 00 Overview — aftershow-event-pipeline-and-callout (T-055)

## Status
- State: done
- Next step: 等待归档确认。

## Goal
将 aftershow 升级为 due/snapshot/compose/publish 的事件化流水，并落地 callout 结构化通知闭环。

## Non-goals
- 不在本包扩展订阅者广播通知（v1 仅 callout 对象）。

## Acceptance criteria (high level)
- [x] aftershow 产物以独立 artifact 发布且不入 allocator。
- [x] callout 结构化记录并触发 `AFTERSHOW_CALLOUT` 通知。
- [x] 发布与通知具备幂等与可撤销路径。

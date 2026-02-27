# 00 Overview — agent-social-graph-behavior-integration (T-038)

## Status
- State: done
- Next step: archived.

## Goal
把 effective 关系接入行为层（candidate selector / feed context），shadow 可见不生效。

## Non-goals
- 不做推荐系统架构重写。
- 不做前端推荐页。

## Acceptance criteria
- [x] only effective relationships affect ranking via relation hint bonus path.
- [x] blocked relation hard-excluded from candidate selection.
- [x] flag off preserves old behavior.

# Roadmap — public-search-system-v1 (T-912)

## Objective

把搜索从当前的 agent-only 单点能力升级为公域统一入口，验证 “找剧情 + 找角色” 两条主线是否能通过统一搜索闭环成立。

## Workstreams

1. Projection schema / rebuild / sync refresh
2. Search API / providers / ranking / guard
3. Web `/search` page / navigation migration / result cards
4. Comment deep link / highlight / verification / telemetry

## Rollout Notes

- 先落库 schema 与 rebuild，再接 API，再接前端与 deep link。
- P2 增强项在 `T-913` 承接，不阻塞 P1 首次上线。

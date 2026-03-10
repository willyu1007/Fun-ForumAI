# 03 Implementation Notes

## Current status
- 状态：not-started
- 说明：Web 核心体验子包未开始实现，等待 foundation 契约冻结。

## Ready checklist
- [ ] `T-078` 已定义前端 types 与 API contract
- [ ] `GUIDANCE_UPDATED` SSE 事件已可消费
- [ ] inbox item action 语义已冻结
- [ ] private receipt deep link 目标已确认
- [ ] Day 0 / first success / stable-use 三段 reveal gate 已从 guidance state 可判定
- [ ] post / agent / following feed / explanation pages 的 surface inventory 已点清

## Handoff notes
- 首页文案必须偏 editorial / product promise，避免教程语气。
- inbox 与 private receipt 必须共享 item id / dedup key，不得在前端复制一张“展示卡”。
- inline payoff 必须是站内即时 payoff，不要把 follow 后收益推迟到 bell 或主动召回。
- progressive disclosure 只根据 foundation guidance state 生效，不允许页面自己发明 reveal heuristic。

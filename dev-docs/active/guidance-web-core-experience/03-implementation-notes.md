# 03 Implementation Notes

## Current status
- 状态：in-progress
- 说明：首页首屏、inbox、private receipt、owner progressive disclosure 已接到 frozen guidance contract。

## Ready checklist
- [x] `T-078` 已定义前端 types 与 API contract
- [x] `GUIDANCE_UPDATED` SSE 事件已可消费
- [x] inbox item action 语义已冻结
- [x] private receipt deep link 目标已确认
- [x] Day 0 / first success / stable-use 三段 reveal gate 已从 guidance state 可判定
- [ ] post / agent / following feed / explanation pages 的 surface inventory 已点清

## 2026-03-10 implementation log
- 首页 `FeedPage` 已改成 hero total sentence + dual promise cards + proof section 的首屏结构。
- 首屏不再渲染旧 `OnboardingBar`，checklist 仅在 guidance summary 给出时显示。
- proof section 使用 `/v1/highlights` + hot feed fallback + labeled demo receipt / real receipt。
- 新增 `/inbox` 页面、导航入口与未读数；bell 保持通知语义。
- private chat 已消费同源 receipt item，结束对话后先看 pending，digest 完成后自动升级为 ready。
- owner `style` / `instructions` / `advanced` tabs 已按 guidance reveal gate 延后展示。
- `AgentProfilePage` 已支持 `tab=privacy&source_session_id=...`，ready receipt 可直达对应记忆过滤视图。
- 首页 `GUIDANCE_MODULE_VIEWED` 改为 per-actor 一次性上报，并取消该类事件的前端即时 invalidation，避免首屏 guidance 自刷循环。
- 首页 `following_only` 已与 URL query 同步，`打开 following feed` CTA 现在能真实落到 following feed。
- `AgentProfilePage` 的 owner guidance 卡已按 `related_agent_id` 过滤，避免多 Agent owner 串卡。
- 新增 `FeedPage` 页面测试，覆盖首屏曝光去重与 `following_only` URL 同步。

## Handoff notes
- 首页文案必须偏 editorial / product promise，避免教程语气。
- inbox 与 private receipt 必须共享 item id / dedup key，不得在前端复制一张“展示卡”。
- inline payoff 必须是站内即时 payoff，不要把 follow 后收益推迟到 bell 或主动召回。
- progressive disclosure 只根据 foundation guidance state 生效，不允许页面自己发明 reveal heuristic。

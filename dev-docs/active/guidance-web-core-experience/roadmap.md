# Roadmap — guidance-web-core-experience (T-079)

## Goal
- 在 Web 端实现 Guidance 的首轮站内体验闭环：首页无感双入口、spectator/owner checklist、guidance inbox、private receipt、summary/inbox/SSE/action 接入。

## Scope
- 首页 `summary.modules[]`
- guidance inbox 页面与入口
- private chat pending/ready receipt
- post / agent / memories / chronicle / achievements inline payoff surface
- following feed payoff 与 Day 0 渐进式揭示
- 前端 action 上报与状态一致性

## Non-goals
- 不做 bell 通知与主动召回。
- 不在本包内新增 state 字段、reason code 或 module 类型。
- 不做移动端 UI。

## Milestones
1. summary / inbox / action hooks 接入
2. 首页无感双入口 + checklist
3. post / agent / following feed inline payoff
4. private receipt + 因果解释页内提示
5. Day 0 降噪与渐进式揭示
6. 站内一致性验证

## Rollback
- 关闭 guidance Web flags 后，首页与私聊页回退到现有 UI，不影响 backend state。

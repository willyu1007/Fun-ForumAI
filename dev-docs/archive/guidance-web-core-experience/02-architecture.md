# 02 Architecture

## Surface model
- 首页：承载 `DUAL_ENTRY` + `CHECKLIST` + 高优先级 `CARD/RECEIPT`
- inbox：承载状态化历史卡片和回执列表
- private chat：承载与当前 session 强相关的 `RECEIPT`
- 帖子页 / Agent 页：承载 follow payoff、剧情上下文和 highlights 引导
- memories / chronicle / achievements：承载来源解释、因果解释和下一步 CTA
- owner manage / profile：承载 Day 0 降噪与 progressive disclosure

## Interaction rules
- 无感双入口：用户看到两条玩法承诺与 CTA，但不看到“模式切换器”。
- 所有 CTA 使用 foundation 提供的 target/action 协议，不在 Web 侧发明新动作。
- action 上报统一走 `POST /v1/guidance/items/:id/action` 或 `POST /v1/guidance/client-events`。
- `following_only` payoff 对匿名用户必须改写为“登录后继续追剧情”，不能直落 401。
- progressive disclosure 只根据 foundation guidance state 生效，不允许页面私自发明 reveal 条件。

## Consistency rules
- inbox、首页、私聊页共用 canonical guidance item。
- pending / ready receipt 共用 `dedup_key`，只允许升级，不允许双卡并存。
- Web 不持久化业务级 guidance state，只维护 UI 缓存。
- inline payoff 与 progressive disclosure 也必须消费 foundation 的 canonical state，而不是独立本地 heuristic。

# 01 Plan — T-079

## Phase 0 Contract Adoption
1. 读取并锁定 `T-078` 输出的 `summary.modules[]`、inbox item、action contract。
2. 明确本包只消费 `DUAL_ENTRY`、`CHECKLIST`、`CARD`、`RECEIPT`。

## Phase 1 Summary And Inbox Data Layer
1. 新增前端 hooks/types：summary、inbox、item action、client events。
2. 接入 `GUIDANCE_UPDATED` SSE，刷新 summary 和 inbox cache。
3. 在 layout 中增加 guidance inbox 入口与未读数。

## Phase 2 Home Dual Entry
1. 首页渲染 `DUAL_ENTRY`，用 editorial 方式讲清两条主线。
2. 渲染 spectator / owner checklist，但不出现“教程步骤条”。
3. CTA 统一走 item action / route open / client event 上报。

## Phase 3 Spectator Inline Payoff
1. 在帖子页接入 follow / related-character / highlights 上下文的 inline guidance。
2. 在 Agent Profile 接入 follow / create-your-own-agent / public highlights 的 inline guidance。
3. 把 `following_only` payoff 做成明确可达的 Web surface，而不是只停留在 reason code。

## Phase 4 Private Receipt And Explanation Surfaces
1. 私聊结束后接 `RECEIPT` 模块或同源 inbox item。
2. `pending` 与 `ready` 用同一 guidance item 升级，不插入第二张卡。
3. 从 receipt 深链到 `memories?source_session_id=` 或 fallback 页面。
4. 在 memories / chronicle / achievements 页补“来源说明 + 下一步 CTA”。

## Phase 5 Progressive Disclosure
1. Agent 管理与 Agent Profile 按 guidance state 做 Day 0 降噪。
2. `style / instructions / advanced / memberships` 在 first success 前降权、折叠或延后展示。
3. 完成 first success 后再展开高阶 owner controls。

## Phase 6 Verification
1. 匿名首访 -> 首页双入口 -> 登录 -> 状态延续。
2. 帖子页 / Agent 页 follow payoff 可直达 following feed 或 highlights。
3. 私聊结束 -> pending -> digest ready -> ready。
4. Day 0 时 owner 高级面板不抢主路径，first success 后再揭示。
5. inbox、首页、私聊、inline surface 四处动作状态一致。

## Exit criteria
- 站内首轮理解闭环和 owner payoff 闭环都可直接演示。
- spectator follow payoff 和 owner 渐进式揭示都可直接演示。
- `T-080` 可在不改首页/receipt 语义的前提下扩展 bell / proactive。

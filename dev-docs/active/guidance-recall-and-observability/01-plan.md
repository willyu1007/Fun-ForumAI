# 01 Plan — T-080

## Phase 0 Dependency Gate
1. 复核 `T-078` 的 canonical guidance item、reason code 和 actor 裁剪规则。
2. 复核 `T-079` 的首页/inbox/receipt 语义，确保 recall 不反向修改站内闭环。

## Phase 1 Delivery Contract
1. 设计 bell 通知如何引用 canonical guidance item，而不是复制内容。
2. 明确 proactive recall 的发送前提、频控、deep link 和 completion 回写。
3. 扩展 `GuidanceAction` / delivery adapter，但不改 core semantic contract。
4. 若 event-time recall 不足以支撑延迟回流，则在本包内引入最小 `GuidanceScheduler`，但不反向改 foundation state 模型。

## Phase 2 Recall Rules
1. 实现 `FOLLOWED_AGENT_STORY_ESCALATED`。
2. 实现 `WATCH_PUBLIC_EFFECT`。
3. 实现 `USE_FOLLOWING_FEED` 的教学型回流。
4. 对 ready receipt 未回看的用户实现延迟型教学召回。
5. 对创建 agent 但未开始私聊的用户实现 owner loop 启动召回。
6. 建立 visitor / user 的 CTA 过滤，禁止 401 dead end。

## Phase 3 Observability
1. guidance 曝光 / 点击 / dismiss / complete 漏斗
2. fatigue / cooldown / same-reason-repeat 指标
3. admin runtime / dashboard 侧的 guidance 观测
4. “教学型召回前 3 次”是否达标的专项指标

## Phase 4 Verification
1. bell 通知 deep link
2. 主动召回去重
3. fatigue / cooldown 生效
4. teaching-first / single-CTA 约束生效
5. 指标口径和后台展示

## Exit criteria
- Guidance 回流链路可独立演示，且不破坏站内核心体验。

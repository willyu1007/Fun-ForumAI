# 01 Plan — T-077

## Phase 0 Governance Freeze
1. 新增 `F-040` 与 `R-040` 到 `R-043` 的治理映射，固定 `T-077` 到 `T-080` 的 task id 与 slug。
2. 固定母包 + 3 子包结构，不退回“单大包”或“纯前后端切包”。
3. 固定执行顺序：`T-077 -> T-078 -> T-079 -> T-080`。

## Phase 1 Product Contract Freeze
1. 固定双主线定义：spectator / owner 为产品主线，不是页面分区。
2. 固定首页语义：明确表达两条玩法，但不出现“请选择模式”“教程第 1 步”。
3. 固定 v1 范围：`backend generic + Web 首发`，移动端只保留契约位。

## Phase 2 Interface And State Freeze
1. 固定 Guidance 服务端拥有 `actor/state/inbox/event log` 四类核心事实，不允许 Web 私自维护 onboarding 状态机。
2. 固定 `summary.modules[]` 由 foundation 冻结后供 `T-079` 消费。
3. 固定 read/control/private-channel/client event 的 Guidance 事件接入矩阵由 `T-078` 承接。
4. 固定中央文案层由 foundation 输出，通知铃和主动召回应共用同一 canonical guidance item，不得在 `T-080` 重新定义核心语义。

## Phase 3 Child Package Execution Rules
1. `T-078` 负责 schema、repo、backend guidance module、API skeleton、完整事件接入矩阵、中央文案层、hook wiring、`source_session_id`、`GUIDANCE_UPDATED`。
2. `T-079` 负责首页双入口、checklist、帖子页/Agent 页 inline payoff、following feed payoff、private receipt、因果解释页内提示、渐进式揭示、Web action 上报与 SSE 消费。
3. `T-080` 负责 bell 通知、教学型主动召回、延迟回流、fatigue/cooldown、漏斗与后台观测。

## Exit criteria
- 四个任务束已建档并通过 governance sync/lint。
- 子包依赖与禁止漂移条款已冻结。
- 后续实现可以直接按子包推进，无需再次拆包。

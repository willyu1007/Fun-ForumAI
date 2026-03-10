# 02 Architecture

## Boundaries
- 本母包只定义治理、边界和契约，不承担产品代码实现。
- 子包必须复用母包冻结的产品语义和依赖顺序。
- `T-079` 不得新增 state 字段、reason code 或 module 类型。
- `T-080` 不得反向修改首页与 receipt 的核心语义，只能扩展 delivery、规则和指标。
- 渐进式揭示属于 Web core 体验的一部分，不允许留成“后续再说”的未归属需求。
- 中央文案层与事件接入矩阵属于 foundation 的 SoT，不允许分散到 Web 或 recall 包。

## Feature graph
- Feature: `F-040 Guidance & Onboarding V1`
- Requirement graph:
  - `R-040 Guidance Contract and Orchestration` -> `T-077`
  - `R-041 Guidance Platform Foundation` -> `T-078`
  - `R-042 Guidance Web Core Experience` -> `T-079`
  - `R-043 Guidance Recall and Observability` -> `T-080`

## Package contract
- `T-078` 输出的 SoT：
  - 服务端 state model
  - reason codes
  - `summary.modules[]` 契约
  - guidance API / SSE skeleton
  - 完整事件接入矩阵
  - 中央文案层 contract
- `T-079` 输出的 SoT：
  - Web 首发页面与交互实现
  - 站内首轮理解闭环和 owner payoff 闭环
  - inline payoff surface 与渐进式揭示
- `T-080` 输出的 SoT：
  - bell / proactive recall 交付层扩展
  - teaching-first recall / fatigue / cooldown / metrics

## Rollout rule
1. 先保证 foundation 可空态运行、可建档、可去重。
2. 再允许 Web 首发接入 summary/inbox/receipt。
3. 最后接通知铃与主动召回，避免首轮就把站内引导和回流策略耦死。

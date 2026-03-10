# 00 Overview — guidance-onboarding-v1-master (T-077)

## Status
- State: in-progress
- Next step: 继续收敛 `T-079` 剩余 explanation / inline payoff surface，随后再启动 `T-080` 的 bell / proactive / metrics。

## Goal
建立 Guidance & Onboarding V1 的项目级治理母包，明确：
- 双主线产品定义：看戏 / 养成；
- “无感双入口”原则与禁止事项；
- Guidance 服务端状态模型、reason code、`summary.modules[]` 协议；
- 完整事件接入矩阵、中央文案层、inline payoff surface、渐进式揭示边界；
- 母包与三个子包的职责边界、依赖顺序、验收口径和 rollout 策略。

## Non-goals
- 不在本包内实现 repo 产品代码。
- 不在本包内落具体页面、接口逻辑或通知策略。
- 不把 Guidance 归入现有 Stats 或 Personality 子线。
- 不在本包内决定移动端 UI 细节。

## Context
- 当前 repo 已有公开内容浏览、Agent 拥有与配置、私聊与记忆、通知铃、主动互动和 SSE 基础设施，但缺少统一的人类引导策略层。
- 首页当前默认仍是 `FeedPage`，侧栏与顶部导航主要表达功能入口，不能自然表达“看戏 / 养成”两条主线。
- 现有 `OnboardingBar` 仅处理单点提示，不足以承担首轮理解闭环和 owner payoff 闭环。
- 本母包作为 `F-040 Guidance & Onboarding V1` 的协调 SoT，负责约束三个子包不可漂移。

## Acceptance criteria (high level)
- [x] 新 feature `Guidance & Onboarding V1` 在项目治理中独立建模。
- [x] 母包与三个子包的 slug、task id、requirement 映射和执行顺序固定。
- [x] “无感双入口”原则、服务端单一事实源原则、通知/召回后置原则写入任务文档。
- [x] 子包之间的依赖规则与禁止反向修改条款写入任务文档。
- [ ] `T-078` 开始实现并冻结 Guidance 基础契约、事件接入矩阵和中央文案层。
- [ ] `T-079` 覆盖首页、inline payoff 和渐进式揭示，不新增未批准的 state / reason / module。
- [ ] `T-080` 按冻结契约推进 bell / proactive / observability，不改站内核心语义。

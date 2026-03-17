# 00 Overview — guidance-onboarding-v1-master (T-077)

## Status
- State: done
- Next step: 无；本包已闭环并归档（2026-03-17）。T-078/T-079 验收与 04-verification 已满足，T-080 已归档。

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
- repo 已落地 Guidance 策略层（T-078 foundation、T-079 Web 核心体验）；首页 FeedPage 已呈现看戏/养成双主线，inbox/receipt/payoff 已接入统一契约。
- 本母包作为 `F-040 Guidance & Onboarding V1` 的协调 SoT；T-078/T-079 验收与 04-verification 已对齐，T-080 已归档。

## Acceptance criteria (high level)
- [x] 新 feature `Guidance & Onboarding V1` 在项目治理中独立建模。
- [x] 母包与三个子包的 slug、task id、requirement 映射和执行顺序固定。
- [x] “无感双入口”原则、服务端单一事实源原则、通知/召回后置原则写入任务文档。
- [x] 子包之间的依赖规则与禁止反向修改条款写入任务文档。
- [x] `T-078` 开始实现并冻结 Guidance 基础契约、事件接入矩阵和中央文案层。（T-078 验收已满足，04-verification 已记录）
- [x] `T-079` 覆盖首页、inline payoff 和渐进式揭示，不新增未批准的 state / reason / module。（T-079 验收已满足，04-verification 已记录）
- [x] `T-080` 按冻结契约推进 bell / proactive / observability，不改站内核心语义。（T-080 已归档，契约内由该包收尾）

# 00 Overview — mainland-launch-safety-master (T-087)

## Status
- State: in-progress
- Next step: 收尾 `T-091` 的 kill switch / 推荐降权与更完整的用户侧透明文案；当前 repo 已落 `T-088~T-090` 主体能力与 `T-091` 最小用户闭环。

## Goal
建立大陆首发审核与风控治理母包，冻结：
- `M-010 / F-050 / R-050~R-053` 的项目映射；
- 四个子包的职责边界、执行顺序和验收口径；
- “体验优先但不放任”的统一处置姿态；
- `PolicyGateway + IdentityGate + SafeReplyService + Review/Complaint + Provenance + Topic Policy` 的总架构。

## Non-goals
- 不在母包中承载全部具体实现逻辑。
- 不把实名首版绑定到外部实名供应商。
- 不在本包中把移动端单独拆出新的首发语义。

## Context
- 当前 repo 仅 `forum post/comment` 有 moderation 骨架，`chat room`、`private chat`、`proactive DM` 仍存在裸写或半裸写路径。
- `PromptOrchestrator`、`PromptLayerService`、`AgentPrivacySettings` 已具备私域影响公域的产品能力，但缺服务端 provenance 审计、risk cap 和 complaint/review 闭环。
- 现有 admin 面板仅支持手工输入目标 ID 执行动作，缺 queue/case/evidence/reopen/identity review。

## Acceptance criteria (high level)
- [x] 新增 `M-010` 与 `F-050`，且 `R-050~R-053` / `T-088~T-091` 映射固定。
- [x] 母包与四个子包的职责边界、依赖顺序、默认策略和 rollout 规则建档。
- [x] `T-088` 完成统一策略网关、私域实名门禁、风险事件落库与 public AI label。
- [x] `T-089` 完成 case / complaint / appeal / review 最小闭环。
- [x] `T-090` 完成 provenance、disclosure cap 与 config risk review。
- [ ] `T-091` 完成热点 default-deny、漂移检测、用户透明告知与 kill switch。

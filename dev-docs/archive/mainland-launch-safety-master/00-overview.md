# 00 Overview — mainland-launch-safety-master (T-087)

## Status
- State: done
- Next step: 进入维护期；若后续审计文案、策略阈值或运营流程再调整，继续在子包 follow-up 中承接，不重新打开母包边界。

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
- repo 现已完成 `forum/chat/private/proactive` 统一策略闸门、消息/帖子治理持久化、review/complaint foundation、private influence provenance、hot-topic policy、公开帮助页与热点运营面板。
- `R-053` 在收口阶段拆成三段：`T-091` 负责热点策略引擎与在位透明提示，`T-092` 负责公开政策/帮助页，`T-093` 负责热点运营面板与告警。
- project hub、task bundle 与外部审计文档核对已在本轮一起收口，避免“代码已落、声明仍停在旧基线”的漂移。

## Acceptance criteria (high level)
- [x] 新增 `M-010` 与 `F-050`，且 `R-050~R-053` / `T-088~T-093` 映射固定。
- [x] 母包与四个子包的职责边界、依赖顺序、默认策略和 rollout 规则建档。
- [x] `T-088` 完成统一策略网关、私域实名门禁、风险事件落库、public AI label，以及 chat `message` 治理持久化闭环。
- [x] `T-089` 完成 shared case foundation，并已正确归档。
- [x] `T-090` 完成 provenance、disclosure cap、config risk review，并已正确归档。
- [x] `T-091` 完成热点 default-deny、漂移检测、kill switch、NO_RECOMMEND 与在位透明提示。
- [x] `T-092` 完成公开帮助/政策页与前台入口，登录前后均可访问。
- [x] `T-093` 完成热点运营面板、告警、帖子分发控制与房间热点控制。
- [x] 最终 verification 已对照外部 `forum-audit.md` 做六块交叉核对。

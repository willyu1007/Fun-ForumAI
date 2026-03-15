# 01 Plan

## Phases

1. Phase A: 新增 inference profile schema、repo 和 runtime types。`[done]`
2. Phase B: 实现 compiler、family score、migration state machine。`[done]`
3. Phase C: visible routing / requested tier 全链路接入。`[done]`
4. Phase D: owner/admin API 与前端可见性分流。`[done]`
5. Phase E: visible provider admission pool、registry 校验与 admin 诊断。`[done]`
6. Phase F: shadow compare evidence / review / rare reanchor 审批闭环。`[done]`
7. Phase G: 文档重写与验证收口。`[done]`

## Detailed steps

- 在 Prisma / repo 层新增 `AgentInferenceProfile` 和读写接口。
- 新建 compiler 服务，输入 `PersonaState + AgentStats + AgentState + XP/Growth`，输出 axes/signals/familyScores/stageEligible/profile state。
- 将 `AgentExecutor`、private/proactive/chatroom/scheduler 等 visible callsite 改为统一调用 compiler/routing 结果。
- 扩展 agent read payload 与 admin runtime features，分别输出 narrative summary 和 raw snapshot。
- 为 visible voice line 建立 provider admission registry，并在 gateway 内过滤 `shadow/blocked` 候选。
- 新增 `AgentInferenceShadowReview` 与 `start_shadow_review / collect_shadow_review / approve_shadow / block_challenger` 控制面动作，打通 evidence window、compare 结果与 rare reanchor 写回。
- 改写第二份策略文档，冻结术语、公式和 owner/admin 边界。

## Exit criteria

- 关键 acceptance criteria 全部满足。
- 目标测试通过，且新增验证记录写入 `04-verification.md`。

## Next follow-up

- 将 provider admission 从“静态 registry + gateway guardrail”继续升级为 provider 级 compare automation 与 admission evidence job。
- 为 provider/family pool rollout 增加更细的自动化验证、回滚 playbook 和 admin 审批编排。
- 视需要把 shadow compare evidence 摘要并入更统一的 review queue/operator workspace。

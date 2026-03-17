# 00 Overview — prompt-budget-v2-cohort-signoff-followup (T-905)

## Status
- State: done
- Depends on: `T-114`, `T-115`, `T-116`
- Next step: 已归档；当前 sign-off 结论已固化，无 task-local 后续动作。

## Goal
把 Token Budget V2 剩余的“体验级闭环证据”独立收口：

- 为 `forum_post`、`forum_comment`、`scheduled_post`、`private_chat`、`chat_room`、`proactive_dm` 六个 scene 建立 cohort 采样与对照证据；
- 明确 `control_survival`、`memory_survival`、`current-context relevance`、`scene fidelity`、`private-boundary fidelity`、`cost per turn`、`output variance` 的 review 结论；
- 判断是否还需要 memory-rich attenuation 或额外 budget tuning，而不是继续悬挂在 `T-115/T-116` 中。

## Non-goals
- 不重新打开 `T-114~T-116` 的 authority / template / trim 代码范围，除非 cohort 验证暴露新的真实 defect。
- 不在本包内改变 provider routing 策略。
- 不把 live evidence 伪装成产品签收；证据必须可复现、可回放、可比较。

## Acceptance criteria
- [x] low / medium / high-memory cohort 覆盖六个 scene。
- [x] 每个 scene 都至少有一组可回放的 prompt-budget evidence，包含 audit、gateway warnings、输出样本和简短判读。
- [x] 六个 scene 的 `control_survival`、`memory_survival`、`current-context relevance`、`scene fidelity`、`private-boundary fidelity`、`cost per turn`、`output variance` 已形成 review 结论。
- [x] 明确记录“无需新增结构性任务”或“需要新的 runtime/product follow-up”的判定，并给出边界。
- [x] `T-114`、`T-115`、`T-116` 已作为前置实现包关闭，不再把体验签收缺口挂在主实现包上。

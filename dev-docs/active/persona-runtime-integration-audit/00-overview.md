# 00 Overview — persona-runtime-integration-audit (T-076)

## Status
- State: in-progress
- Next step: 对照三份设计文档与 `T-062~T-072` 交付物完成 repo audit，跑通 local/k8s/browser 真实验证，记录差距并落地必要修复。

## Goal
对 `T-062~T-072` 涉及的人格、prompt 分层、provider/control plane、context/memory plane 与 rollout 相关实现做一次集成审计与质量加固，确认当前仓库是否满足需求文档，并修复真实测试中暴露的问题。

## Non-goals
- 不重写既有设计文档。
- 不新开 owner-facing 产品范围。
- 不在没有证据的情况下大规模重构既有 runtime。

## Scope
- 对照 `/Users/yurui/Downloads/agent_persona_prompt_provider_design.md`
- 对照 `/Users/yurui/Downloads/Fun-ForumAI_ControlPlane_ContextMemory_docs/API_ControlPlane_Design.md`
- 对照 `/Users/yurui/Downloads/Fun-ForumAI_ControlPlane_ContextMemory_docs/Context_and_Memory_Plane_Design.md`
- 复核 `T-062~T-072` 的 contract、runtime、evidence 与 governance 状态
- 用浏览器、本地/k8s runtime、真实 LLM API key 做端到端验证，重点覆盖多并发 writeback + render

## Acceptance criteria (high level)
- [ ] 形成需求文档 -> task -> code/runtime 的差距清单，并标注已满足 / 部分满足 / 未满足
- [ ] 完成至少一轮真实运行验证，包含浏览器操作、k8s/runtime 运行与真实模型调用
- [ ] 覆盖并发 writeback + render 场景，并记录结果
- [ ] 修复阻断需求达成或真实联调失败的问题
- [ ] 更新验证记录与 project governance，使当前状态可追踪

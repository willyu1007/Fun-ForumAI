# 02 Architecture — T-076

## Boundaries
- 本任务是 audit + fix task，不替代 `T-062~T-072` 各包的原始职责。
- 若发现问题属于已有 in-progress 包（尤其 `T-068` / `T-072`），实现可直接修复代码，但结论统一沉淀在本包。
- 审计对象覆盖三个层面：
  - Persona / Prompt / Provider design
  - API Control Plane
  - Context & Memory Plane

## Primary code surfaces
- LLM registry / routing / gateway: `.ai/llm-config/registry/**`, `src/backend/llm/**`, `src/backend/container/llm.ts`
- Persona runtime / rollout / observability: `src/backend/runtime/**`, `scripts/t070-rollout-shadow-review.mjs`
- Context & memory plane: `src/backend/context-memory/**`, `src/backend/services/memory-service.ts`
- Admin/dev/debug entry points: `src/backend/routes/admin-api.ts`, related dev scripts

## Risks
- 当前 worktree 已有未提交改动，审计/修复必须在理解现有修改目的后继续，不能回滚用户已有工作。
- 真实模型调用涉及成本和第三方可用性，验证结果可能受 provider/network 波动影响。
- k8s 本地环境与源码可能存在镜像/配置漂移，需要先确认运行 fingerprint。

## Closeout decisions
- `persona_observability_metrics` 仍使用 `instance_id(hostname:pid)` 作为单实例行标识，但运行时计数的语义以 `runtime_key(code_fingerprint)` 为窗口边界。
- 因此 repository 不能在旧行上直接盲目 `upsert + increment`；当同一 `instance_id` 切到新 fingerprint 时，必须先清空该行并重绑到新 `runtime_key`，之后再开始累计本轮计数。
- `reset()` 不仅要删当前 `runtime_key` 的持久化样本，还要让 repository 丢弃本地“row 已就绪”的缓存状态，避免 reset 后第一次增量写入直接命中不存在的行。

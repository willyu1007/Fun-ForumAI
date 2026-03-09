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

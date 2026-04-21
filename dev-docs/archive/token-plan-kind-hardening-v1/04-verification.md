# 04 Verification

## Completed

- Registry / tests
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - `pnpm vitest run src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/runtime-authority-state.test.ts scripts/lib/__tests__/k8s-secret-resolution.test.ts`
  - `pnpm eslint scripts/k8s-local-staging.mjs scripts/lib/k8s-secret-resolution.mjs src/backend/llm/__tests__/runtime-authority-state.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/llm-gateway.test.ts`
- Admin closeout entry tightening
  - `pnpm vitest run src/backend/routes/__tests__/admin-runtime-routes.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
  - `pnpm eslint src/backend/routes/admin/admin-runtime-routes.ts src/backend/routes/__tests__/admin-runtime-routes.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
  - 结果：2 个文件、18 个测试全部通过；默认单 agent 尝试和显式 fanout override 已被单元测试锁定。
- Final review sweep
  - `pnpm vitest run src/backend/routes/__tests__/admin-runtime-routes.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/runtime-authority-state.test.ts scripts/lib/__tests__/k8s-secret-resolution.test.ts`
  - `pnpm eslint src/backend/routes/admin/admin-runtime-routes.ts src/backend/routes/admin/runtime-closeout-fanout.ts src/backend/routes/__tests__/admin-runtime-routes.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/runtime-authority-state.test.ts scripts/k8s-local-staging.mjs scripts/lib/k8s-secret-resolution.mjs scripts/lib/__tests__/k8s-secret-resolution.test.ts`
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - 结果：6 个测试文件、80 个测试全部通过；registry validator 通过；未发现额外无效/过时测试产物需要清理。
- 本地 kind 部署
  - 多次执行 `pnpm k8s:staging:local -- --skip-db-migrate --frontend-build-profile none`
  - kind 中 `forum-app-secret` 的 `DASHSCOPE_API_KEY` 与 `TOKEN_PLAN_OPENAI_API_KEY` 哈希与 `ops/deploy/env-files/staging.env` 对齐
  - backend fingerprint 先后验证通过：
    - `sha256:481581a895b6042b46a0ad1bfbe0ca0e134ba4bf84840b0351af656bcc0da65b`
    - `sha256:7c991f296c67663bc257bdbcbc2aaa1045db5ceb062a69c776248da95580c702`
- Provider / gateway smoke
  - pod 内 smoke 已验证：
    - 正常文本链路可命中 `token-plan-openai/qwen3.6-plus`
    - Token Plan 认证失败时可按同 profile 回落
  - 本地 HTTP closeout smoke 暴露出额外现象：
    - `visible/private-reply` 与 `visible/proactive-opening` 在不收敛时会持续串行尝试候选 provider，admin closeout 入口整体耗时显著放大
    - `private-reply` lane 在 kind 中对 `token-plan-openai` 与 `dashscope-openai/qwen3.5-flash` 都观测到 30s timeout，因此已将 Token Plan 从该 realtime lane 中移除

## Current Assessment

- 已修复：kind 本地部署会自动注入 `TOKEN_PLAN_OPENAI_API_KEY`。
- 已修复：`private_reply` 不再为 Token Plan 实验链承担 30s 首跳延迟风险。
- 残余问题：admin closeout smoke 入口会放大 provider 失败成本，不适合继续作为低延迟 smoke 判据；如果后续要继续联调业务入口，建议收紧其 candidate 轮询策略或固定单 agent/单 attempt。
- 残余问题：admin closeout 入口虽然已默认收紧到单 agent，但 provider 侧的真实延迟仍应在 pod 内 smoke 或显式 `agent_id` 的定点请求里观察，不宜再把无 `agent_id` 的 closeout admin route 当成性能基线。

# 00 Overview — token-plan-kind-hardening-v1 (T-985)

## Status

- State: done
- Depends on: `T-901 provider-runtime-alignment-and-model-activation-v1`
- Current status: local kind secret 注入已修复，`private_reply` realtime lane 已从 Token Plan 实验链中摘出；admin closeout 入口已收紧为默认单 agent 尝试，只有显式 `allow_agent_fanout=true` 才按 `max_agent_attempts` 展开。相关 registry、route、kind 脚本和测试回归均已通过。
- Outcome: 本包以“kind 注入补齐 + Token Plan realtime 风险收口 + closeout 入口 fanout 收紧”完成为准归档。后续如果继续做 staging 业务入口联调，属于归档后的定点 smoke / 运营验证，不再阻塞本任务 closeout。

## Goal

让本地 `kind-funforum` 环境能够稳定复现 Token Plan 作为实验性 fallback 节点的真实行为：

- 本地 staging 部署自动注入 `TOKEN_PLAN_OPENAI_API_KEY`
- 正常首跳可命中 `token-plan-openai/qwen3.6-plus`
- Token Plan 认证失败时可回落到 `dashscope-openai/qwen3.5-plus`
- 业务 realtime lane 不再因过短 timeout 在 kind 环境里出现假性失败

## Non-goals

- 不调整 prod/staging 正式 secret backend 映射
- 不扩展 vision summary 路由
- 不新增 provider / model family

## Acceptance Criteria

- `scripts/k8s-local-staging.mjs` 生成的 `forum-app-secret` 包含 `TOKEN_PLAN_OPENAI_API_KEY`
- kind 本地重部署后无需手工 patch secret
- realtime lane 相关回归测试通过
- kind pod 内 smoke 证明：
  - visible forum reply 首跳命中 Token Plan
  - hidden private digest 首跳命中 Token Plan
  - 强制坏 key 后 visible forum reply 回落到 DashScope，且有 `AuthError` fallback 证据

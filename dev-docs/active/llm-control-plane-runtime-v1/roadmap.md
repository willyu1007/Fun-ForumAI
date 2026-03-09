# LLM Control Plane Runtime V1 — Roadmap

## Goal
- 将 `T-064` 冻结的 gateway/provider/profile contract 落成运行时代码：统一 secret resolution、credential pool、路由、记账与调用面迁移。

## Frozen decisions
- dev secrets backend 使用 `env`；staging/prod 默认使用 `bws`。
- 不新增“选择 secret backend”的运行时 env key。
- `agent.model` 与 `config.llm.*` 只保留 bootstrap/兼容价值，不再是 visible authority。
- 所有 visible / hidden 生产调用统一经过 `LLMGateway`。

## Scope
- `env/contract.yaml`, `env/values/*`, `env/secrets/*.ref.yaml`
- `.ai/llm-config/registry/**`
- `src/backend/llm/**`
- `src/backend/container/llm.ts`
- LLM call sites under `src/backend/runtime/**` and `src/backend/services/**`

## Acceptance criteria
- secret contract 合法，repo 内无 secret value。
- gateway 能完成 provider/profile/credential 决策并写 usage ledger。
- direct `llmClient.chat(...)` 业务旁路被迁移或被 guard 测试拦截。

# 00 Overview — scene-pool-authoring-v2-hardening-and-e2e-followup (T-100)

## Status
- State: done
- Next step: 无；等待后续归档或被新的 remediation task 取代。

## Goal
把 `T-099` 完成后的 authoring v2 迁移再做一轮 hardening：
- 清除会误导 LLM 的旧路径和旧命名残留；
- 以新标准重跑 repo checks、本地 smoke、浏览器 smoke 和 kind staging smoke；
- 修复复测中暴露的阻断点、回归和明显代码质量问题；
- 加一个防回漂 guard，避免旧语义重新进入主仓库。

## Non-goals
- 不改变 runtime catalog wire shape。
- 不新增 public API 或数据库 schema。
- 不重开 source/runtime 双读，也不引入 `v3`。

## Acceptance criteria (high level)
- [x] `src/`、`scripts/`、`dev-docs/active/`、`dev-docs/archive/`、`.ai/project/main/` 不再保留旧路径或旧 projector token。
- [x] 一次性迁移脚本从主仓库移除，legacy 输入点不再存活。
- [x] 新增零容忍 guard，并在 CI/人工验证中可直接执行。
- [x] 本地 forum/chatroom smoke、Chrome DevTools smoke、kind staging smoke 全部基于 `docs/stage-templates/source/**` 与 `docs/stage-templates/dist/**` 通过。
- [x] 新发现的 blocker 或回归已修复并补了回归测试。

## Closure summary
- 完成了 repo 级旧语义清理，并新增 `scripts/check-stage-template-legacy-tokens.mjs` 做 zero-tolerance guard。
- 本地真实 smoke、浏览器 smoke 与 kind staging smoke 全部重跑；forum 与 chatroom 都验证到新 `source/ + dist/` 标准。
- 本轮真实验证中额外修复了 4 个问题：
  - kind local overlay 未打开 director/scene-pool 相关 feature flags；
  - chatroom `agent-chat-reply@5` 在部分路径缺少 `local_intent_block`；
  - local-kind `NODE_OPTIONS=1024` 导致开启新合同后 pod 在真实 smoke 中 OOM；
  - runtime 镜像未打包 `docs/stage-templates/**`，导致 kind 上 catalog 永远缺失并回退到 `legacy_fallback`。

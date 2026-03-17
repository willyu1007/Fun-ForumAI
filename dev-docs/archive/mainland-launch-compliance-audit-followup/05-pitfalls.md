# 05 Pitfalls — T-097

## Do-not-repeat

- 不要直接修改已归档的 `T-087~T-093` bundle 充当本轮修复记录；新的审计结论和补丁必须留在 `T-097`。
- 不要只看静态代码或 happy path 测试；这次任务必须覆盖真实链路验证与负路径检查。
- 不要在存在多个 `tsx src/backend/server.ts` 进程时直接做浏览器/HTTP验证；必须先用 `lsof -iTCP:4000 -sTCP:LISTEN` 和 `pgrep -fal` 确认没有旧实例抢占端口，否则很容易把请求打到旧代码并误判为“修复无效”。
- 不要默认 `scripts/k8s-local-staging.mjs` 的 `4100` 一定空闲；若本机已有端口占用，脚本会在 rollout 之后因为 port-forward 失败退出。出现这种情况时先确认 rollout 已成功，再改用其他本地端口手工 `kubectl port-forward` 完成后续 smoke。

## 2026-03-13 — Rebase 后 task-id 冲突

- Symptom: `git rebase origin/main` 在 `.ai/project/main/{registry,dashboard,feature-map,task-index}` 全部冲突，project hub 同时出现两个 `T-094`。
- Root cause: 本 follow-up bundle 最初登记为 `T-094`，但 upstream 在此期间已把 `T-094` 分配给 `public-director-boundary-and-scene-contract`。
- What was tried: 先人工查看冲突块，确认这不是普通文本差异，而是同一个主键被两个任务复用；如果直接手合 AUTO 区，会把重复 `task_id` 带进主分支。
- Fix/workaround: 以最新 `main` 的 project hub 为基线，将 follow-up bundle 重编号为 `T-097`，再执行 governance `sync -> map -> sync` 重建 registry 与派生视图。
- Prevention: 延迟落地的 `dev-docs + project hub` 变更在合并前必须先 rebase 到最新 `main`，并优先跑 `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` 检查 `task_id` 唯一性。

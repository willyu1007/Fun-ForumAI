# 00 Overview — confirmed-technical-debt-paydown (T-907)

## Status

- State: done
- Depends on: none
- Next step: 清理提交并推送到 `main`。

## Goal

收口已确认、且当前适合直接修复的技术债务，限定在以下范围：

- `IncubationService` 的 grant/job 更新原子性；
- `ops/deploy` / `ops/deploy rollback` 的真实执行路径；
- 可安全删除的 memory / hidden-lane 过渡实现与硬编码；
- 可直接收敛的 bootstrap / feature-flag 分支。

## Non-goals

- 不处理 UI / Tailwind / `uix-*` 相关问题。
- 不处理 backlog / roadmap 项（原 `TECHNICAL-DEBT.md` 第 11、12 节）。
- 不进行 API 契约改版或大范围 memory model 重构。

## Acceptance Criteria

- grant 创建与 job 状态更新在 Pg 路径下由同一事务提交。
- deploy/rollback 脚本不再在非 dry-run 模式停留在 `[todo]`。
- 生产路径中不再保留可确认无用的 private-digest legacy fallback。
- hidden lane 的硬编码只保留为显式策略需要的部分，去掉无必要分叉。
- 变更后 `pnpm typecheck`、`pnpm lint`、相关测试通过。
- 删除 `TECHNICAL-DEBT.md`。

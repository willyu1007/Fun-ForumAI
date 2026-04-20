# 04 Verification — launch-gray-release-gap-closure (T-933)

## Repo-side verification passed

- 2026-04-01 `export PATH=/opt/homebrew/bin:$PATH; pnpm lint` -> PASS
- 2026-04-01 `export PATH=/opt/homebrew/bin:$PATH; pnpm typecheck` -> PASS
- 2026-04-01 `export PATH=/opt/homebrew/bin:$PATH; pnpm test` -> PASS（281 files / 1375 tests）
- 2026-04-01 `export PATH=/opt/homebrew/bin:$PATH; pnpm build` -> PASS
- 2026-04-01 `export PATH=/opt/homebrew/bin:$PATH; node scripts/verify-launch-readiness.mjs --ci --json` -> PASS（16/16）
- 2026-04-01 `export PATH=/opt/homebrew/bin:$PATH; python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full 2>&1` -> PASS

## Local smoke passed

- 2026-04-01 launch build proof:
  - `VITE_FF_* = true pnpm build`
  - `node ops/packaging/scripts/frontend-build-profile.mjs --profile staging-launch --out dist/frontend/frontend-build-flags.json`
  - `curl http://127.0.0.1:4100/frontend-build-flags.json` -> PASS
- 2026-04-01 launch runtime path:
  - `curl -X POST http://127.0.0.1:4100/v1/dev/seed -H 'content-type: application/json' -d '{"profile":"launch"}'` -> PASS
  - `curl http://127.0.0.1:4100/v1/home` -> PASS（launch shelves enabled）
  - `pnpm exec node --input-type=module` + `@playwright/test` 打开 `http://127.0.0.1:4100/` -> PASS（页面包含 `今日必看` / `T4 今日笔记` / `全部社区`）

## Notes

- `verify:launch` / `verify:launch:ci` 已在本地 repo 侧通过，证明 membership bootstrap、launch baseline assets、worker templates、launch overlays/build profiles、packaging wireup 和 regression coverage 已接好。
- 本轮补做的真实 smoke 已证明：web 进程现在可以直接提供 `/frontend-build-flags.json`、`/v1/home` 和 `/` 首屏静态资产，launch build proof 与首页交付链路在同一进程下成立。
- `verify:launch:staging` 需要真实环境的 `FORUM_BASE_URL`、`WORKER_BASE_URL` 与可访问运行态，因此未在本地离线执行；该步骤保留给灰测前的 staging operator 验收。
- 本地环境缺少 `kubectl` 与 `docker`，因此没有执行 `k8s:staging:local` 路径；本轮用本地后端进程 + Playwright browser smoke 替代了集群级演练。

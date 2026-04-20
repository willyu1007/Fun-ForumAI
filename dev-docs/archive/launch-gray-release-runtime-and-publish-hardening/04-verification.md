# 04 Verification — launch-gray-release-runtime-and-publish-hardening (T-934)

## Repo-side verification passed

- `export PATH=/opt/homebrew/bin:$PATH; node scripts/run-vitest.mjs run scripts/ci/__tests__/check-image-launch-proof.test.ts src/backend/app.test.ts src/backend/launch/__tests__/programming-contracts.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts ops/packaging/scripts/__tests__/frontend-build-profile.test.ts scripts/lib/__tests__/launch-readiness.test.ts src/backend/routes/__tests__/frontend-static.test.ts`
  - Result: passed
  - Coverage: image proof validator, manifest-backed contract resolution, dev-only startup hardening, 12-community baseline occupancy, canonical frontend build profile, frontend build proof static delivery
- `export PATH=/opt/homebrew/bin:$PATH; pnpm lint`
  - Result: passed
- `export PATH=/opt/homebrew/bin:$PATH; node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed
- `export PATH=/opt/homebrew/bin:$PATH; node scripts/verify-launch-readiness.mjs --ci --json`
  - Result: passed (`17/17`)
  - Coverage: runtime contracts, canonical launch build profile, publish workflow wireup, dev-only startup hardening, typecheck, lint, build, packaging dry-run, launch regression tests, governance lint
- `export PATH=/opt/homebrew/bin:$PATH; pnpm test`
  - Result: passed (`282` test files, `1378` tests)

## Notes

- 深度清理已删除本地 `dist/` 与 `.ai/.tmp/` 生成物，避免后续将构建残留误当成 repo 资产。
- 当前未执行的只剩真实 staging live gate：
  - `pnpm verify:launch:staging -- --web-base-url <...> --worker-base-url <...> --admin-token <...>`
  - 这一步仍需要目标环境可访问的 web / worker base URL 与 admin token

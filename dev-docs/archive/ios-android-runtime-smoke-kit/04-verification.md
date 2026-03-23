# 04 Verification — ios-android-runtime-smoke-kit (T-061)

## Key Checks
- `pnpm mobile:smoke:prepare` — PASS (fixture prepare)
- `pnpm mobile:smoke:validate` — PASS (Maestro asset validate)
- `pnpm mobile:smoke:ios -- --run-id mobile-smoke-1772927655744` — PASS (iOS simulator smoke)
- `pnpm mobile:smoke:android -- --run-id mobile-smoke-1772927655744` — PASS (Android emulator smoke)
- `pnpm mobile:test` — PASS (mobile unit tests)
- `pnpm mobile:typecheck` — PASS (mobile typecheck)

## Coverage
- 通过链路：anonymous gating、login、feed、rooms、agents、XP、private send。

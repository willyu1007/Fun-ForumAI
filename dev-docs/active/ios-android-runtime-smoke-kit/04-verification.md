# 04 Verification — ios-android-runtime-smoke-kit (T-061)

## Verification matrix
| Area | Command / Method | Expected outcome | Status |
|------|------------------|------------------|--------|
| fixture prepare | `pnpm mobile:smoke:prepare` | smoke fixture ready | TODO |
| Maestro asset validate | `pnpm mobile:smoke:validate` | flows/scripts structurally valid | TODO |
| iOS simulator smoke | local execution | mainline smoke passes | TODO |
| Android emulator smoke | local execution | mainline smoke passes | TODO |
| mobile unit tests | `pnpm mobile:test` | existing suites green | TODO |
| mobile typecheck | `pnpm mobile:typecheck` | no TS errors | TODO |
| CI scaffold | GitHub Actions | no-device validation green | TODO |

## Verification log template
### <date> — <area>
- Command:
  - `<command>`
- Outcome:
  - PASS / FAIL / PARTIAL
- Notes:
  - <note>

### 2026-03-07 — governance bootstrap
- Command:
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- Outcome:
  - PASS
- Notes:
  - `R-025 / T-061` 已注册并挂接到 `F-030`。
  - lint 仅报告与历史 active task 有关的 warning，无 blocking error。

# 04 Verification — ios-android-runtime-smoke-kit (T-061)

## Verification matrix
| Area | Command / Method | Expected outcome | Status |
|------|------------------|------------------|--------|
| fixture prepare | `pnpm mobile:smoke:prepare` | smoke fixture ready | PASS |
| Maestro asset validate | `pnpm mobile:smoke:validate` | flows/scripts structurally valid | PASS |
| iOS simulator smoke | `pnpm mobile:smoke:ios -- --run-id mobile-smoke-1772927655744` | mainline smoke passes | PASS |
| Android emulator smoke | `pnpm mobile:smoke:android -- --run-id mobile-smoke-1772927655744` | mainline smoke passes | PASS |
| mobile unit tests | `pnpm mobile:test` | existing suites green | PASS |
| mobile typecheck | `pnpm mobile:typecheck` | no TS errors | PASS |
| CI scaffold | workflow update + local equivalent checks | no-device validation green | PARTIAL |

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

### 2026-03-08 — fixture prepare
- Command:
  - `pnpm mobile:smoke:prepare`
- Outcome:
  - PASS
- Notes:
  - 生成 fixture `mobile-smoke-1772927655744`。
  - fixture 产物落在 `.ai/.tmp/mobile-smoke/mobile-smoke-1772927655744/fixture.json`。
  - 当前策略为 `run-id` 隔离，不做自动 cleanup。

### 2026-03-08 — static validation
- Command:
  - `pnpm mobile:smoke:validate`
  - `pnpm mobile:typecheck`
  - `pnpm mobile:test`
- Outcome:
  - PASS
- Notes:
  - `mobile:smoke:validate` 校验通过：Maestro 目录结构、flow 引用、testID registry、脚本契约、CI hook 均已就绪。
  - `mobile:test` 通过：`4` suites / `34` tests。

### 2026-03-08 — iOS simulator smoke
- Command:
  - `pnpm mobile:smoke:ios -- --run-id mobile-smoke-1772927655744`
- Outcome:
  - PASS
- Notes:
  - 通过链路：anonymous gating、login、feed、rooms、agents、XP、private send。
  - 关键收口：
    - 采用 focused marker，规避 React Navigation mounted hidden tabs 干扰。
    - 改为用底部 tab accessibility label 切换 tab。
    - feed 使用稳定的 `打开欢迎帖子` 文本入口和详情标题 marker。

### 2026-03-08 — Android emulator smoke
- Command:
  - `pnpm mobile:smoke:android -- --run-id mobile-smoke-1772927655744`
- Outcome:
  - PASS
- Notes:
  - 通过链路：anonymous gating、login、feed、rooms、agents、XP、private send。
  - 关键收口：
    - Android dev-client overlay 由 `mobile-smoke-run.mjs` 先做 `adb back` + foreground app 归一化。
    - Android login / feed flow 拆成平台专用实现，避免与 iOS selector 语义强耦合。

### 2026-03-08 — CI scaffold status
- Command:
  - local equivalent checks:
    - `pnpm mobile:typecheck`
    - `pnpm mobile:test`
    - `pnpm mobile:smoke:validate`
- Outcome:
  - PARTIAL
- Notes:
  - `.github/workflows/ci.yml` 已包含 `pnpm mobile:smoke:validate`。
  - 本地等价检查通过，但没有在 GitHub Actions 上实际观察一次远端 job 结果。

### 2026-03-08 — review hardening static re-check
- Command:
  - `pnpm mobile:smoke:validate`
  - `pnpm mobile:typecheck`
  - `pnpm mobile:test`
- Outcome:
  - PASS
- Notes:
  - code review 后将 smoke marker / helper 收敛到 `__DEV__`，静态校验与现有 mobile tests 仍然全部通过。

### 2026-03-08 — final fixture re-run
- Command:
  - `pnpm mobile:smoke:prepare`
  - `pnpm mobile:smoke:ios -- --run-id mobile-smoke-1772931450980`
  - `pnpm mobile:smoke:android -- --run-id mobile-smoke-1772931450980`
- Outcome:
  - PASS
- Notes:
  - 使用新的 fixture `mobile-smoke-1772931450980` 完成双端重验。
  - 确认 `__DEV__` gating 与 fixture 校验增强没有引入 smoke 回归。

### 2026-03-08 — local smoke cleanup
- Command:
  - 删除 `.ai/.tmp/mobile-smoke`
  - 使用 `psql $DATABASE_URL` 删除 `mobile-smoke-*` 用户、agent、room、session 和对应消息
- Outcome:
  - PASS
- Notes:
  - 提交前本地 smoke 产物和 DB fixture 已清空。

# 03 Implementation Notes — ios-android-runtime-smoke-kit (T-061)

## Frozen decisions
- Maestro 是唯一运行态 harness。
- iOS / Android 共用场景语义，但入口 flow 分离。
- 本地运行态是主目标，CI 只验证结构与脚本。

## Smoke scenario list
- anonymous launch
- login
- feed browse
- room open
- agents list
- XP refresh
- private session open/send

## Local-only vs CI-safe commands
- Local-only:
  - `mobile:smoke:ios`
  - `mobile:smoke:android`
- CI-safe:
  - `mobile:smoke:prepare`
  - `mobile:smoke:validate`

## Evidence convention
- `.ai/.tmp/mobile-smoke/<run-id>/`

## Phase log template
### Phase <N> — <name>
- What changed:
  - <change>
- Why:
  - <reason>
- Deviations from frozen decisions:
  - none / <deviation>
- Remaining TODOs for next phase:
  - <todo>

## Phase 0 — Governance bootstrap
- What changed:
  - 创建 `dev-docs/active/ios-android-runtime-smoke-kit/` 完整任务包。
  - 在 `.ai/project/main/registry.yaml` 中注册 `R-025 / T-061`，并挂接到 `F-030`。
  - 通过 project governance sync 刷新 derived views。
- Why:
  - 在进入 Maestro 与平台运行态 smoke 实施前，先明确依赖关系和治理边界。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 等待 `T-060` 形成可用 dev build 基线，再开始 smoke harness 设计与实施。

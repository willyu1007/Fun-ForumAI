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

## Phase 1 — Fixture and Harness Foundation
- What changed:
  - 新增 `mobile:smoke:prepare`、`mobile:smoke:ios`、`mobile:smoke:android`、`mobile:smoke:validate` root 命令。
  - 新增 `scripts/mobile-smoke-prepare.mjs`、`scripts/mobile-smoke-run.mjs`、`scripts/mobile-smoke-lib.mjs`、`scripts/mobile-maestro-check.mjs`。
  - `mobile:smoke:prepare` 落地 `dev-seed + 正式 API 补全`：生成唯一 smoke 用户、smoke agent、dedicated smoke room，并写出 `.ai/.tmp/mobile-smoke/<run-id>/fixture.json`。
  - `mobile:smoke:validate` 落地为仓库内静态契约检查；CI `mobile-runtime-scaffold` 已扩展到执行该命令。
- Why:
  - 先收敛 fixture 契约、运行产物目录和 operator 命令，再进入平台级 smoke 调试。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 落地 Maestro 资产和 mobile selector contract。

## Phase 2 — Selector Contract and Platform Flows
- What changed:
  - 新增 `apps/mobile/.maestro/` 共享 flows 和平台入口 flows。
  - 新增集中式 `apps/mobile/src/testing/test-ids.ts`，并为 tabs、auth、feed、rooms、agents、XP、private 关键控件补 `testID`。
  - 为每个 tab 根屏补 `focused marker`，避免 React Navigation 保持 mounted 的隐藏 screen 干扰 Maestro 断言。
  - 为底部 tab 补唯一 `tabBarAccessibilityLabel`，从 `tabBarButtonTestID` 切到 accessibility label 驱动的 tab 切换。
  - 针对平台差异拆出 Android 专用 `login.yaml` 和 `feed.yaml`；iOS 保持共享 login/feed 语义并通过 focused marker 校验当前 screen。
  - `mobile-smoke-run.mjs` 为 Android 增加 dev-client overlay 归一化：`adb back` 后重新 foreground app。
  - 增加 `06-operator-guide.md`，固化 EAS dev build、backend 前置、Metro 自管和本地执行说明。
- Why:
  - 实际运行中暴露出 iOS/Android 在 tab mount、可访问性和 dev-client 容器噪音上的差异，必须把 selector contract 做成“当前 tab 可见 + 平台专用差异层”。
- Deviations from frozen decisions:
  - 登录和 feed 最终不是完全 shared：Android 入口 flow 拆成了平台专用实现。
- Remaining TODOs for next phase:
  - 真实跑完 iOS / Android 两端 smoke，并把结果回写文档和治理状态。

## Phase 3 — Runtime Verification Closure
- What changed:
  - 使用同一份 fixture `mobile-smoke-1772927655744` 跑通了 iOS simulator smoke 和 Android emulator smoke。
  - 真实验证主链路：anonymous gating、login、feed、rooms、agents、XP、private session send。
  - 文档和治理状态回写为完成态。
- Why:
  - `T-061` 的验收标准是双端本地运行态 smoke 真通过，而不是只落脚本或只做单端验证。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 若要进入 shared staging，必须单开后续任务补 fixture cleanup / isolated-db。

## Phase 4 — Review Hardening and Final Cleanup
- What changed:
  - 在 code review 后，将 `focused marker` 和 `打开欢迎帖子` 的 smoke helper 收敛到 `__DEV__`，避免自动化痕迹进入非开发运行态 UI。
  - `mobile-smoke-prepare.mjs` 增加 room 创建结果校验，避免 fixture 在房间创建失败时静默写出坏数据。
  - 清理了本地 `.ai/.tmp/mobile-smoke` 产物和 DB 中的 `mobile-smoke-*` fixture 数据。
  - 用新的 fixture `mobile-smoke-1772931450980` 重跑 iOS / Android smoke，确认 hardening 没有打坏运行链路。
- Why:
  - T-061 的 smoke 标记和辅助入口只服务于本地 dev build，不应该污染正常用户界面。
  - fixture 准备脚本必须 fail-fast，不能把错误延迟到 Maestro 运行阶段。
  - 在提交前清空本地 smoke 数据，避免把验证垃圾留在开发库和本地证据目录。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - none

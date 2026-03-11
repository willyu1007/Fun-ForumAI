# 01 Plan — expo-development-build-foundation (T-060)

## Phases
1. Governance + env contract alignment
2. Expo / EAS config and dependency changes
3. Local fallback scripts and ignore policy
4. CI scaffold
5. Verification and operator docs

## Acceptance criteria
- `pnpm mobile:typecheck` 全绿。
- `pnpm mobile:test` 全绿。
- `pnpm mobile:config:check` 全绿。
- `pnpm mobile:doctor` 能准确报告 iOS / Android 本机前置条件。
- `pnpm mobile:devbuild:ios` 与 `pnpm mobile:devbuild:android` 能解析到有效的 EAS profile。
- `pnpm mobile:run:ios` 与 `pnpm mobile:run:android` 能走本地 prebuild fallback，且不追踪 native 目录。
- `.github/workflows/ci.yml` 新增无设备的 mobile runtime scaffold 验证。

## Frozen decisions
- Hybrid 路线：EAS dev build 为主，`expo run` 为 fallback。
- `apps/mobile/ios` 与 `apps/mobile/android` 保持 generated-only 且不入库。
- iOS Simulator 与 Android Emulator 都是必须支持的一等目标。
- CI 只校验配置、脚本和 scaffold，不执行真机/模拟器运行态。

# 00 Overview — ios-android-runtime-smoke-kit (T-061)

## Status
- State: planned
- Next step: 等待 `T-060` 达到可用的 dev build 基线后，再进入 smoke harness 与平台验证实施。

## Goal
在 `T-060` 之上建立 iOS / Android 运行态 smoke 配套：
- 使用 Maestro 作为共享 harness；
- 提供本地可执行的 simulator / emulator smoke；
- 为 CI 提供无设备验证 scaffold。

## Non-goals
- 不接入云设备农场。
- 不要求真机覆盖。
- 不引入 Detox。

## Dependency
- `T-060 expo-development-build-foundation` 必须先达到 green baseline。

## High-level acceptance
- [ ] Maestro flows 已存在且可本地执行。
- [ ] smoke fixture provisioning 已就绪。
- [ ] iOS simulator smoke 通过。
- [ ] Android emulator smoke 通过。
- [ ] CI 能在无设备环境下验证 Maestro 资产与脚本结构。

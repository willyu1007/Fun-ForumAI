# 00 Overview — ios-android-runtime-smoke-kit (T-061)

## Status
- State: done
- Next step: 若要把这套 smoke 从 `local/dev` 推进到 shared staging，必须先补 fixture cleanup / isolated-db 方案；当前 `run-id` 隔离策略不能直接沿用到共享环境。

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

## Acceptance criteria
- [x] Maestro flows 已存在且可本地执行。
- [x] smoke fixture provisioning 已就绪。
- [x] iOS simulator smoke 通过。
- [x] Android emulator smoke 通过。
- [x] CI 能在无设备环境下验证 Maestro 资产与脚本结构。

## Delivery note
- 当前实现锁定为 `local/dev`：
  - fixture 使用 `run-id` 隔离；
  - smoke 命令不做自动 cleanup；
  - backend 必须由操作者先启动。
- staging 前置要求：
  - 必须补 `cleanup / isolated-db` 方案；
  - 必须明确 smoke fixture 的保留期和清理责任。

# 06 Operator Guide — ios-android-runtime-smoke-kit (T-061)

## Outcome
完成本页后，你可以在本地用已安装的 Expo development build 对 iOS Simulator 和 Android Emulator 跑统一的 Maestro smoke。

## Prerequisites
- MUST 先完成 `T-060` 基线。
- MUST 先启动 backend，并确认 `/health` 可达。
- MUST 已在目标 simulator / emulator 上安装对应平台的 Expo development build。
- MUST 已 boot 目标 simulator / emulator。
- SHOULD 安装 Maestro CLI。

## Install or refresh dev builds
- iOS simulator latest build:
  - `pnpm exec eas build:run --latest --platform ios --profile development-ios-simulator`
- Android emulator latest build:
  - `pnpm exec eas build:run --latest --platform android --profile development-android`

## Prepare fixture
- Command:
  - `pnpm mobile:smoke:prepare`
- Expected result:
  - 输出 `.ai/.tmp/mobile-smoke/<run-id>/fixture.json`
  - 新建唯一 smoke 用户、smoke agent、smoke room

## Run iOS smoke
- Boot simulator first.
- Command:
  - `pnpm mobile:smoke:ios`
- Optional:
  - `pnpm mobile:smoke:ios -- --run-id <run-id>`
  - `pnpm mobile:smoke:ios -- --fixture .ai/.tmp/mobile-smoke/<run-id>/fixture.json`
- Expected result:
  - Metro 由脚本自行拉起并在结束后回收
  - `.ai/.tmp/mobile-smoke/<run-id>/ios/` 下生成 `metro.log`、`maestro.log`、`debug-output/`

## Run Android smoke
- Boot emulator first.
- Command:
  - `pnpm mobile:smoke:android`
- Optional:
  - `pnpm mobile:smoke:android -- --run-id <run-id>`
  - `pnpm mobile:smoke:android -- --fixture .ai/.tmp/mobile-smoke/<run-id>/fixture.json`
- Expected result:
  - Metro 由脚本自行拉起并在结束后回收
  - `.ai/.tmp/mobile-smoke/<run-id>/android/` 下生成 `metro.log`、`maestro.log`、`debug-output/`

## Validation-only path
- Command:
  - `pnpm mobile:smoke:validate`
- Expected result:
  - 只校验脚本契约、Maestro 资产结构、关键 testID 和 CI wiring
  - 不要求安装 Maestro CLI，不要求有设备

## Backend routing note
- If `EXPO_PUBLIC_API_BASE_URL` is unset:
  - iOS smoke 默认走 `127.0.0.1:<PORT>`
  - Android smoke 默认走 `10.0.2.2:<PORT>`
- If `EXPO_PUBLIC_API_BASE_URL` is set:
  - smoke runtime 会按显式值覆盖默认 host policy

## Troubleshooting
- `Metro is already running on port 8081`
  - 停掉现有 Metro，再重跑 smoke；当前脚本要求独占 packager session。
- `Maestro CLI is not installed`
  - 先安装 Maestro，再执行 `mobile:smoke:ios/android`。
- `backend unreachable`
  - 确认 backend 已启动，且本机 `PORT` / `EXPO_PUBLIC_API_BASE_URL` 与实际监听一致。
- `No booted iOS simulator found` / `No booted Android emulator found`
  - 先手工启动 simulator / emulator。
- `app is not installed`
  - 先用 `eas build:run` 安装对应平台的 development build。

## Current limitation
- 当前阶段是 `local/dev` 策略：fixture 仅用 `run-id` 隔离，不做自动清理。
- 在进入 shared staging 前，MUST 先补 `cleanup / isolated-db` 方案；当前策略不可直接沿用。

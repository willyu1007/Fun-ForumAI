# 00 Overview — expo-development-build-foundation (T-060)

## Status
- State: done
- Next step: 转入 `T-061 ios-android-runtime-smoke-kit`，在这套 Expo / EAS 基线上补齐 Maestro smoke 与双端运行态证据。

## Goal
为移动端建立可重复、可运维的 Expo Development Build 基线：
- EAS dev build 作为标准路径；
- 本地 `expo prebuild/run` 作为 fallback；
- 同时支持 iOS Simulator 与 Android Emulator；
- 修正本地 backend 在两端模拟器上的默认连通性。

## Non-goals
- 不接入云设备或真机农场。
- 不在本任务引入 Maestro 流程。
- 不将 `apps/mobile/ios` 或 `apps/mobile/android` 提交到仓库。

## Context
当前 `apps/mobile` 仍是 Expo managed baseline：
- 仅有 `expo start` 系列脚本；
- 没有 `eas.json`；
- 没有 `expo-dev-client`；
- 没有本地 native 目录 ignore 策略；
- API base 对 iOS / Android emulator 的默认 host 还未分离。

## Acceptance criteria
- [x] `expo-dev-client` 已接入。
- [x] `apps/mobile/eas.json` 存在，并包含 `development-ios-simulator` 与 `development-android` profile。
- [x] root / mobile scripts 覆盖 doctor、build、local run、config-check。
- [x] env contract 已记录 mobile API base 与 EAS project 配置。
- [x] CI 已新增无设备的 mobile runtime scaffold job。
- [x] 本机 iOS Simulator / Android Emulator 本地 fallback run 已验证可行。
- [x] EAS dev build project linkage、iOS metadata 收口、Android remote keystore 初始化与真实 build record 创建已完成。

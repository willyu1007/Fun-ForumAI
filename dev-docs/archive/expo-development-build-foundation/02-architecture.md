# 02 Architecture — expo-development-build-foundation (T-060)

## Design anchors
- 在 `apps/mobile` 中新增 `expo-dev-client`。
- 在 repo 侧引入 `eas-cli`，统一通过 `pnpm exec eas` 调用。
- 用 `apps/mobile/app.config.ts` 替换现有 `app.json`。
- 新增 `apps/mobile/eas.json`。
- `apps/mobile/ios`、`apps/mobile/android`、`apps/mobile/.expo` 必须被 ignore。

## EAS profiles
- `development-ios-simulator`
  - `developmentClient=true`
  - `distribution=internal`
  - `ios.simulator=true`
- `development-android`
  - `developmentClient=true`
  - 产出 emulator 可安装包

## Script contract
- `mobile:doctor`
- `mobile:devbuild:ios`
- `mobile:devbuild:android`
- `mobile:run:ios`
- `mobile:run:android`
- `mobile:config:check`

## Doctor responsibilities
- 校验 Node / pnpm
- 校验 `pnpm exec eas`
- 校验 `pnpm --dir apps/mobile exec expo`
- 校验 iOS `xcrun simctl`
- 校验 Android `adb` 和至少一个可用 AVD

## Local backend connectivity
- iOS Simulator 默认 base URL：`http://127.0.0.1:4000`
- Android Emulator 默认 base URL：`http://10.0.2.2:4000`
- 若显式设置 `EXPO_PUBLIC_API_BASE_URL`，则以显式配置优先

## Env additions
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_EAS_PROJECT_ID`

## Config rule
- `app.config.ts` 只有在 `EXPO_EAS_PROJECT_ID` 存在时才注入 `extra.eas.projectId`。

# Compatibility / Migration Plan — expo-development-build-foundation

## Compatibility
- 现有 backend、web 和 mobile `expo start` 路径保持兼容。
- 若未设置 `EXPO_PUBLIC_API_BASE_URL`，移动端继续有默认 API base，只是现在会按平台区分 host。
- 若未设置 `EXPO_EAS_PROJECT_ID`，普通移动开发不受影响，但 `mobile:devbuild:*` 会明确 fast-fail。

## Operator migration steps
1. 为需要执行 EAS dev build 的环境设置 `EXPO_EAS_PROJECT_ID`。
2. iOS 本机准备至少一个可用 simulator device。
3. Android 本机安装 `adb` 与至少一个 AVD emulator。
4. 按平台使用 `mobile:run:*` 或 `mobile:devbuild:*` 进行后续验证。

## Rollback
- 删除新增 env keys 与相关脚本后，移动端仍可回到纯 `expo start` baseline。

# 05 Pitfalls — expo-development-build-foundation (T-060)

## Template
- Symptom:
- Root cause:
- Failed attempts:
- Fix / workaround:
- Prevention note:

## Expected pitfalls to capture
### Missing `EXPO_EAS_PROJECT_ID`
- Symptom:
  - EAS config renders but dev build metadata is incomplete.
- Root cause:
  - app config tries to publish EAS metadata without project id.
- Failed attempts:
  - TBD
- Fix / workaround:
  - Only inject `extra.eas.projectId` when env is present.
- Prevention note:
  - `mobile:config:check` 必须在 CI 中覆盖该分支。

### Android emulator uses wrong localhost
- Symptom:
  - Android dev build 无法连通本地 backend，但 iOS 正常。
- Root cause:
  - 误用 `127.0.0.1`，未切换到 `10.0.2.2`。
- Failed attempts:
  - TBD
- Fix / workaround:
  - 默认按平台选择 API base，显式 env 仍可覆盖。
- Prevention note:
  - operator 文档和 smoke 前置检查都必须写清 host 差异。

### Accidental native-dir commits after `expo prebuild`
- Symptom:
  - `apps/mobile/ios` 或 `apps/mobile/android` 出现在工作树中并被误提交。
- Root cause:
  - 缺少 ignore 或流程未强调 generated-only 策略。
- Failed attempts:
  - TBD
- Fix / workaround:
  - 增加 ignore 规则与 docs，要求本地 run 结束后检查工作树。
- Prevention note:
  - `mobile:run:*` 文档必须显式提醒 native 目录不入库。

## Resolved pitfalls
### Mobile Jest env helper lacked Node globals
- Symptom:
  - `pnpm mobile:test` 因 `apps/mobile/src/api/__tests__/client.test.ts` 找不到 `process` 类型而失败。
- Root cause:
  - mobile Jest/TS 配置只包含 React types，不包含 Node globals。
- Failed attempts:
  - 直接在测试中使用 `process.env`。
- Fix / workaround:
  - 改为通过 `globalThis` 包装访问 `process.env`，避免引入 Node type 依赖。
- Prevention note:
  - `apps/mobile` 的测试若只需轻量 env 注入，优先使用局部 helper，不要默认依赖 Node globals。

### Expo SDK drift caused iOS codegen failure
- Symptom:
  - `expo run:ios` / `pod install` 在 codegen 阶段失败，报 `Unknown prop type for "accessibilityContainerViewIsModal": "undefined"`。
- Root cause:
  - `apps/mobile` 的 native dependency versions 偏离了 Expo SDK 53 推荐矩阵，尤其是 `react-native-screens@4.24.0` 与当前 RN / Expo 组合不兼容。
- Failed attempts:
  - 仅通过 `newArchEnabled=false` 试图绕过 codegen。
- Fix / workaround:
  - 使用 `expo install --check` 获取 Expo 官方兼容版本建议，并将 native 依赖收敛到：
    - `react-native@0.79.6`
    - `react-native-safe-area-context@5.4.0`
    - `react-native-screens@4.11.1`
- Prevention note:
  - T-060 之后凡是调整 Expo SDK 或 React Native 版本，都要先跑 `expo install --check`，不要让 mobile native 依赖长期漂移。

### Expo CLI on Xcode 26 misrouted iOS local run to signing flow
- Symptom:
  - 已 boot 的 simulator 存在，但 `expo run:ios` 仍走到 physical-device signing 分支，报 `No code signing certificates are available to use`。
- Root cause:
  - 当前 Expo CLI / Xcode 26 组合在设备解析上存在偏差，本地 simulator 运行被错误导向 device signing 流程。
- Failed attempts:
  - `pnpm mobile:run:ios -- --device "iPhone 17 Pro"`
  - `pnpm mobile:run:ios` 直接让 Expo 选择默认目标
- Fix / workaround:
  - 先 `expo prebuild --clean`，然后用底层 `xcodebuild -sdk iphonesimulator ...` 构建，再用 `xcrun simctl install/launch` 完成验证。
- Prevention note:
  - 在 Xcode / Expo CLI 升级窗口里，iOS local run 文档要明确保留 `xcodebuild + simctl` 这条兜底路径。

### Android local build needed Java 17, NDK, and CMake on first run
- Symptom:
  - Android build 首次失败于 `Android Gradle plugin requires Java 17 to run`，随后又自动拉取 NDK / CMake。
- Root cause:
  - 当前 Android toolchain 在机器上并未一次性齐备，Gradle 首跑需要补齐 JDK 17、NDK 27.1 和 CMake 3.22.1。
- Failed attempts:
  - 在未显式加载 `JAVA_HOME` 的情况下直接执行 `pnpm mobile:run:android`。
- Fix / workaround:
  - 在本机配置并加载 `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`，然后允许 Gradle 首跑自动安装 NDK / CMake。
- Prevention note:
  - `mobile:doctor` 未来可进一步扩展到显式检查 active Java major version，避免只发现 `adb` / `AVD` 而漏掉 JDK。

### Expo auto-fix introduced duplicate React type graphs
- Symptom:
  - 运行 `expo install --check` 后，`pnpm mobile:typecheck` 出现大量 `NavigationContainer` / `Stack.Navigator` 不是合法 JSX 组件的错误。
- Root cause:
  - Expo 自动把 mobile 的 `@types/react` 降到了与 workspace 根部不同的版本，导致 TypeScript 同时解析两套 React types。
- Failed attempts:
  - 直接接受 `expo install --check` 对 devDependencies 的全部自动修正。
- Fix / workaround:
  - 将 mobile 的 `@types/react` 对齐回 workspace 根部正在使用的 `19.2.14`，恢复单一 React type graph。
- Prevention note:
  - `expo install --check` 的结果不能无差别全吃；native deps 和 dev-only type deps 要分别判断。

### pnpm `--` separator leaked into the EAS wrapper
- Symptom:
  - 从 root 运行 `pnpm mobile:devbuild:* -- --non-interactive --no-wait --json` 时，EAS CLI 报 `Unexpected arguments`。
- Root cause:
  - `pnpm` 会把分隔符 `--` 原样传给 Node wrapper；wrapper 如果直接透传 `process.argv`，就会把字面量 `--` 和后续 flags 一起交给 `eas build`。
- Failed attempts:
  - 直接依赖 shell 侧的 `--` 约定，不在 wrapper 内做参数清洗。
- Fix / workaround:
  - 在 `scripts/mobile-eas-build.mjs` 中显式过滤掉字面量 `--`，只透传真实的 EAS flags。
- Prevention note:
  - 所有 root Node wrapper 都应把 `pnpm` 透传参数视为不可信输入，先标准化再调用下游 CLI。

### pnpm symlink layout broke Expo Android autolinking fallback
- Symptom:
  - Android `./gradlew app:compileDebugJavaWithJavac` 失败，生成的 `PackageList.java` 引用了不存在的 `expo.core.ExpoModulesPackage`。
- Root cause:
  - `expo-modules-autolinking` 在 pnpm/symlink 路径下读取 `apps/mobile/node_modules/expo/react-native.config.js` 时，无法解析 `expo-modules-autolinking/exports`，于是吞掉异常并退回旧的 Android package 推断逻辑。
- Failed attempts:
  - 给 `apps/mobile` 增加 `@react-native-community/cli` direct devDependency。
  - 只检查 `expo/react-native.config.js` 的静态内容，而没有验证 `loadConfigAsync()` 的真实返回值。
- Fix / workaround:
  - 在 `apps/mobile` 中显式加入 `expo-modules-autolinking@~2.1.15`，让 `expo/react-native.config.js` 从 app 侧路径可解析该包。
  - 重新 `expo prebuild --platform android --clean` 后，生成物恢复为 `expo.modules.ExpoModulesPackage`，Android 编译通过。
  - 移除无效的 `@react-native-community/cli` direct dependency。
- Prevention note:
  - 以后遇到 Expo Android autolinking 异常时，不要只看 `react-native.config.js` 文件内容；要直接验证 `expo-modules-autolinking` 的实际加载结果和生成的 `autolinking.json`。

# 03 Implementation Notes — expo-development-build-foundation (T-060)

## Frozen decisions
- EAS dev build 为标准路径，本地 `expo run` 为 fallback。
- native 目录 generated-only，不提交到仓库。
- iOS / Android 都需要独立命令与验证说明。
- CI 不执行设备运行态，只验证配置与 scaffold。

## Script names
- `mobile:doctor`
- `mobile:devbuild:ios`
- `mobile:devbuild:android`
- `mobile:run:ios`
- `mobile:run:android`
- `mobile:config:check`

## Profile names
- `development-ios-simulator`
- `development-android`

## Ignore policy
- `apps/mobile/ios`
- `apps/mobile/android`
- `apps/mobile/.expo`

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
  - 创建 `dev-docs/active/expo-development-build-foundation/` 完整任务包。
  - 在 `.ai/project/main/registry.yaml` 中注册 `F-030 / R-024 / T-060`。
  - 通过 project governance sync 刷新 derived views。
- Why:
  - 在实现 Expo / EAS 与 mobile runtime scaffold 前，先建立清晰、可追踪的治理上下文。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 开始 Phase 1：治理与 env contract 对齐。

## Phase 1 — Expo development build foundation
- What changed:
  - 在 root devDependencies 中引入 `eas-cli`，在 `apps/mobile` 中引入 `expo-dev-client`。
  - 用 `apps/mobile/app.config.ts` 替换 `app.json`，保留原有 app identity，并按 `EXPO_EAS_PROJECT_ID` 条件注入 `extra.eas.projectId`。
  - 新增 `apps/mobile/eas.json`，定义 `development-ios-simulator` 与 `development-android` 两个 build profile。
  - 在 root `package.json` 中新增 `mobile:doctor`、`mobile:devbuild:*`、`mobile:run:*`、`mobile:config:check`。
  - 新增 repo-owned runtime 脚本：
    - `scripts/mobile-config-check.mjs`
    - `scripts/mobile-doctor.mjs`
    - `scripts/mobile-eas-build.mjs`
    - `scripts/mobile-env.mjs`
    - `scripts/mobile-run-local.mjs`
  - `apps/mobile/src/api/client.ts` 改为平台感知默认 API base：iOS `127.0.0.1`，Android `10.0.2.2`，显式 `EXPO_PUBLIC_API_BASE_URL` 仍优先。
  - `.gitignore` 增加 `apps/mobile/ios`、`apps/mobile/android`、`apps/mobile/.expo`。
  - `env/contract.yaml` 新增 `EXPO_PUBLIC_API_BASE_URL` 与 `EXPO_EAS_PROJECT_ID`，并生成新的 `env/.env.example`、`docs/env.md`、`docs/context/env/contract.json`。
  - `.github/workflows/ci.yml` 新增 `mobile-runtime-scaffold` job，只执行无设备的 mobile runtime scaffold 校验。
- Why:
  - 为 `T-061` 提供稳定的 dev build、local fallback、env contract 和 CI scaffold 基线，避免后续 smoke 实施时再处理底层工具链与配置碎片。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 在具备 iOS Simulator、Android AVD 和有效 `EXPO_EAS_PROJECT_ID` 的环境上，执行真实 dev build 和 `expo run` 路径验证。

## Phase 2 — Local runtime enablement and validation
- What changed:
  - 在本机安装并配置了 iOS / Android runtime 前置：
    - 通过 `xcodebuild -downloadPlatform iOS` 安装 iOS simulator runtime，并启动 `iPhone 17 Pro` simulator。
    - 安装 Android command-line tools、platform-tools、OpenJDK 17、NDK 27.1、CMake 3.22.1，并创建 `codex-pixel-35` AVD。
    - 安装 `cocoapods`，打通 iOS `pod install`。
  - 创建 Expo EAS project：
    - account: `@willyu1007`
    - project: `@willyu1007/fun-forum-ai`
    - project id: `cbaaa503-bd7a-4fc4-b738-47d21a32a95c`
  - 通过本地覆盖文件接入 `EXPO_EAS_PROJECT_ID`：
    - `env/values/dev.local.yaml`
    - 重新编译 `.env.local`
  - 为了让 iOS runtime 真正可构建，收敛 mobile 依赖到 Expo SDK 53 可工作的 native 组合：
    - `react-native` -> `0.79.6`
    - `react-native-safe-area-context` -> `^5.4.0`
    - `react-native-screens` -> `^4.11.1`
    - `app.config.ts` 中新增 `newArchEnabled: false`
  - 为避免 mobile type graph 被 Expo 自动降级的 dev types 打坏，又把 mobile 的 `@types/react` 对齐回 workspace 根部的 `19.2.14`。
  - 本地 runtime 实测：
    - iOS：用 `xcodebuild + simctl` 成功 build / install / launch。
    - Android：用 `expo run:android` 成功 build，随后 `adb install` 和 `monkey` 成功启动 app。
- Why:
  - T-060 不只是静态 scaffold；必须把本机 runtime 从“doctor 通过”推进到“真的能生成并启动 app”，否则后续 T-061 的 smoke harness 没有可信基础。
  - Expo CLI 在当前 Xcode 26 环境下对 simulator 选择存在偏差，直接用 `xcodebuild + simctl` 可以更稳定地验证 iOS runtime 本体。
  - Expo SDK compatibility check 已明确指出 native dependency drift，回到官方兼容矩阵比继续硬扛 codegen 问题更可靠。
- Deviations from frozen decisions:
  - iOS 本地 fallback run 的最终验证没有继续依赖 `expo run:ios`，而是改用 `xcodebuild + simctl` 完成 install / launch 闭环。
- Remaining TODOs for next phase:
  - 在 `app.config.ts` 中补 `ios.infoPlist.ITSAppUsesNonExemptEncryption` 策略，消除 iOS EAS build 的元数据警告。
  - 为 `@willyu1007/fun-forum-ai` 初始化 Android remote keystore，消除 `--non-interactive` EAS build 阻塞。

## Phase 3 — EAS path closure and task handoff
- What changed:
  - 在 `apps/mobile/app.config.ts` 中补充 `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`，收口 iOS EAS metadata。
  - 在 `apps/mobile/eas.json` 中新增 `cli.appVersionSource: "local"`，让 EAS 路径的版本来源显式化。
  - 使用已接入的 `EXPO_EAS_PROJECT_ID` 创建真实云端 build 记录：
    - iOS build id: `21d058c3-7e39-412b-b20f-f6c077f0e661`
    - Android build id: `9bb4b531-b277-437d-a6c1-211f7502646f`
  - 在 Android EAS build 首次交互中初始化了 remote keystore，消除了后续 `--non-interactive` 的 keystore 缺口。
  - 回写 T-060 文档与治理状态，准备把 smoke 运行态工作移交给 `T-061`。
- Why:
  - T-060 的目标不是停留在本地 scaffold 或 local runtime，而是把 EAS dev build 基线也推进到真实、可追踪的云端记录。
  - Android keystore 和 iOS export metadata 是此前最后两个明确阻塞点，补齐后 T-060 的基础设施目标已经达成。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - none；后续移动端运行态 smoke、Maestro flow 与双端证据采集在 `T-061` 执行。

## Phase 4 — Operator command hardening
- What changed:
  - 将 root `mobile:devbuild:*` 改为通过 `scripts/mobile-eas-build.mjs` 执行：
    - 自动加载 `.env.local`
    - 显式在 `apps/mobile` 目录内运行 EAS CLI
    - 兼容 `pnpm ... -- <extra args>` 带入的字面量 `--`
  - 抽出 `scripts/mobile-env.mjs`，统一处理 repo root / mobile root / 本地 env 加载。
  - `scripts/mobile-run-local.mjs` 改为复用本地 env loader，避免 API base override 仍依赖手工 `source .env.local`。
  - `scripts/mobile-config-check.mjs` 强化为“渲染结果校验”：
    - 检查 `expo-dev-client` plugin 已进入 Expo config
    - 检查 `ios.infoPlist.ITSAppUsesNonExemptEncryption=false`
    - 若存在 `EXPO_EAS_PROJECT_ID`，检查 `extra.eas.projectId` 实际注入
  - 删除已被 wrapper 取代的 `scripts/mobile-assert-eas-env.mjs`。
- Why:
  - 之前的 root `mobile:devbuild:*` 依赖操作者手工注入 env，而且没有显式绑定 `apps/mobile` 作为执行目录，命令契约不稳。
  - `pnpm` 透传参数时会把分隔符 `--` 一起交给 Node wrapper；如果不剔除，会把后续 EAS flags 解析坏。
  - 对配置做渲染后校验，比只看文件存在更能发现 dev build 真实断点。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - none

## Phase 5 — Review-driven Android autolinking fix
- What changed:
  - 在 `apps/mobile` 中新增 `expo-modules-autolinking@~2.1.15` devDependency。
  - 复跑 `expo prebuild --platform android --clean` 后，确认生成的 `autolinking.json` 与 `PackageList.java` 都改为 `expo.modules.ExpoModulesPackage`。
  - 移除了此前试错留下但无效的 `@react-native-community/cli` direct devDependency。
- Why:
  - 本轮代码审查发现 Android dev build 仍然会在 `PackageList.java` 中生成错误的 `expo.core.ExpoModulesPackage` import，导致本地与 EAS Android 编译都不可靠。
  - 根因不是 app 代码，而是 `expo-modules-autolinking` 在 pnpm/symlink 路径下读取 `expo/react-native.config.js` 失败并退回了旧推断逻辑；给 `apps/mobile` 暴露直接可解析的 `expo-modules-autolinking` 后，该链路恢复正确。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - none

# 04 Verification — expo-development-build-foundation (T-060)

## Verification matrix
| Area | Command / Method | Expected outcome | Status |
|------|------------------|------------------|--------|
| mobile typecheck | `pnpm mobile:typecheck` | no TypeScript errors | PASS |
| mobile unit tests | `pnpm mobile:test` | existing suites green | PASS |
| config check | `pnpm mobile:config:check` | Expo/EAS config resolves | PASS |
| doctor | `pnpm mobile:doctor` | platform prerequisites reported accurately | PASS |
| Expo config render | `pnpm --dir apps/mobile exec expo config --json` | rendered config valid | PASS |
| EAS availability | `pnpm exec eas --version` | EAS CLI available | PASS |
| iOS local run dry-run | local command execution | fallback path valid | PASS |
| Android local run dry-run | local command execution | fallback path valid | PASS |
| CI scaffold | GitHub Actions | no-device mobile runtime job green | TODO |

## Verification log template
### <date> — <area>
- Command:
  - `<command>`
- Outcome:
  - PASS / FAIL / PARTIAL
- Notes:
  - <note>

### 2026-03-07 — governance bootstrap
- Command:
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- Outcome:
  - PASS
- Notes:
  - `F-030 / R-024 / T-060` 注册成功。
  - lint 仅报告与历史 active task 有关的 warning，无 blocking error。

### 2026-03-07 — env contract validate/generate
- Command:
  - `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/expo-development-build-foundation/artifacts/env/03-validation-log.md`
  - `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/active/expo-development-build-foundation/artifacts/env/04-context-refresh.md`
- Outcome:
  - PASS
- Notes:
  - 新增 `EXPO_PUBLIC_API_BASE_URL` 与 `EXPO_EAS_PROJECT_ID` 后，contract validate 通过。
  - 已刷新 `env/.env.example`、`docs/env.md`、`docs/context/env/contract.json`。

### 2026-03-07 — mobile static checks
- Command:
  - `pnpm mobile:typecheck`
  - `pnpm mobile:test`
  - `pnpm mobile:config:check`
  - `pnpm --dir apps/mobile exec expo config --type public --json`
  - `pnpm exec eas --version`
- Outcome:
  - PASS
- Notes:
  - `mobile:typecheck` 通过。
  - `mobile:test` 通过，4 个 suites / 34 个 tests 全绿。
  - `mobile:config:check` 通过，确认 `expo-dev-client`、`app.config.ts`、`eas.json`、`.gitignore`、`env/contract.yaml` 全部齐备。
  - Expo public config 渲染成功，输出包含 `plugins: [\"expo-dev-client\"]`。
  - EAS CLI 可用：`eas-cli/18.1.0 darwin-arm64 node-v20.19.6`。

### 2026-03-07 — local operator commands
- Command:
  - `pnpm mobile:doctor`
  - `pnpm mobile:run:ios -- --dry-run`
  - `pnpm mobile:run:android -- --dry-run`
  - `pnpm mobile:devbuild:ios`
  - `pnpm mobile:devbuild:android`
- Outcome:
  - PARTIAL
- Notes:
  - `mobile:doctor` 行为符合预期，准确报告当前机器缺口：
    - iOS 无可用 simulator devices
    - `adb` 缺失
    - `emulator` 缺失
  - `mobile:run:ios -- --dry-run` 输出默认 API base 为 `http://127.0.0.1:4000`。
  - `mobile:run:android -- --dry-run` 输出默认 API base 为 `http://10.0.2.2:4000`。
  - `mobile:devbuild:*` 在未设置 `EXPO_EAS_PROJECT_ID` 时按设计 fast-fail，错误信息明确。
  - 尚未在具备 simulator / emulator 与有效 EAS project id 的环境上执行真实 build / run。

### 2026-03-07 — local env bootstrap for runtime
- Command:
  - `python3 -B -S .ai/skills/features/environment/env-localctl/scripts/env_localctl.py doctor --root . --env dev --runtime-target local --workload api --out dev-docs/active/expo-development-build-foundation/artifacts/env-local/00-prereq-check.md`
  - `python3 -B -S .ai/skills/features/environment/env-localctl/scripts/env_localctl.py compile --root . --env dev --runtime-target local --workload api --out dev-docs/active/expo-development-build-foundation/artifacts/env-local/02-config-compile-report.md`
- Outcome:
  - PASS
- Notes:
  - `.env.local` 成功生成且权限为 `0600`。
  - 通过 `env/values/dev.local.yaml` 接入 `EXPO_EAS_PROJECT_ID=cbaaa503-bd7a-4fc4-b738-47d21a32a95c`。
  - 本地 backend 实际监听端口为 `8000`，因此运行态验证显式覆盖了 `EXPO_PUBLIC_API_BASE_URL`，未直接使用脚本默认的 `4000`。

### 2026-03-07 — EAS project linkage
- Command:
  - `pnpm exec eas login --browser`
  - `pnpm exec eas project:init --force --non-interactive`
  - `set -a; source /Volumes/DataDisk/Project/Fun-ForumAI/.env.local; set +a; pnpm exec eas project:info`
- Outcome:
  - PASS
- Notes:
  - Expo account 登录成功：`willyu1007`。
  - 新项目创建成功：`@willyu1007/fun-forum-ai`。
  - `project:info` 返回 project id：`cbaaa503-bd7a-4fc4-b738-47d21a32a95c`。
  - 因为 app 使用动态 `app.config.ts`，`eas project:init` 不能自动回写配置；最终通过本地 env 注入 `extra.eas.projectId`。

### 2026-03-07 — iOS runtime validation
- Command:
  - `xcodebuild -downloadPlatform iOS`
  - `xcrun simctl boot 1C45C147-D33E-43CD-A4CC-D3E801E5AC1B`
  - `pnpm --dir apps/mobile exec expo prebuild --clean`
  - `xcodebuild -workspace apps/mobile/ios/AITalkshow.xcworkspace -scheme AITalkshow -configuration Debug -sdk iphonesimulator -destination 'id=1C45C147-D33E-43CD-A4CC-D3E801E5AC1B' -derivedDataPath apps/mobile/.derived-data CODE_SIGNING_ALLOWED=NO build`
  - `xcrun simctl install booted /Volumes/DataDisk/Project/Fun-ForumAI/apps/mobile/.derived-data/Build/Products/Debug-iphonesimulator/AITalkshow.app`
  - `xcrun simctl launch booted ai.funforum.app`
- Outcome:
  - PASS
- Notes:
  - iOS simulator runtime 与可用 device 成功补齐。
  - 直接 `expo run:ios` 在当前 Xcode 26 环境里误走了 physical-device signing 分支；改用 `xcodebuild + simctl` 后，`AITalkshow.app` 成功 build / install / launch。
  - `simctl launch` 返回：`ai.funforum.app: 14833`。

### 2026-03-07 — Android runtime validation
- Command:
  - `emulator @codex-pixel-35 -wipe-data -no-snapshot -no-audio -no-boot-anim -gpu swiftshader_indirect -netdelay none -netspeed full -no-metrics`
  - `pnpm mobile:run:android`
  - `adb install -r /Volumes/DataDisk/Project/Fun-ForumAI/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
  - `adb shell monkey -p ai.funforum.app -c android.intent.category.LAUNCHER 1`
- Outcome:
  - PASS
- Notes:
  - 首次运行过程中自动补齐了 NDK `27.1.12297006` 与 CMake `3.22.1`。
  - `expo run:android` 最终 `BUILD SUCCESSFUL`，产出 `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`。
  - `adb install` 返回 `Success`，`monkey` 成功启动 `ai.funforum.app`。

### 2026-03-07 — static checks after runtime dependency alignment
- Command:
  - `pnpm mobile:typecheck`
  - `pnpm mobile:test`
  - `pnpm mobile:config:check`
  - `pnpm mobile:doctor`
- Outcome:
  - PASS
- Notes:
  - `mobile:test`：4 suites / 34 tests 通过。
  - `mobile:typecheck` 在将 mobile 的 `@types/react` 对齐到 workspace 根部 `19.2.14` 后恢复通过。
  - `mobile:doctor` 在本机 iOS runtime / Android toolchain 补齐后已全绿。

### 2026-03-07 — EAS dev build creation check
- Command:
  - `set -a; source /Volumes/DataDisk/Project/Fun-ForumAI/.env.local; set +a; pnpm exec eas build --profile development-ios-simulator --platform ios --non-interactive --no-wait`
  - `set -a; source /Volumes/DataDisk/Project/Fun-ForumAI/.env.local; set +a; pnpm exec eas build --profile development-android --platform android --non-interactive --no-wait`
- Outcome:
  - PARTIAL
- Notes:
  - iOS：命令已越过 project-id 检查并开始 archive/compress 流程，说明 local env 与 EAS linkage 有效；但为了避免在当前回合长时间占用上传流程，未等待云端 build 创建完成。
  - iOS 同时暴露出一个待补的元数据提醒：`ios.infoPlist.ITSAppUsesNonExemptEncryption`。
  - Android：命令已越过 profile / project linkage 检查，但在 `--non-interactive` 模式下因为 remote keystore 尚未初始化而停止：`Generating a new Keystore is not supported in --non-interactive mode`。

### 2026-03-07 — EAS build records and Android keystore initialization
- Command:
  - `set -a; source /Volumes/DataDisk/Project/Fun-ForumAI/.env.local; set +a; pnpm exec eas build --profile development-ios-simulator --platform ios --non-interactive --no-wait --json --message "T-060 iOS simulator baseline"`
  - `set -a; source /Volumes/DataDisk/Project/Fun-ForumAI/.env.local; set +a; pnpm exec eas build --profile development-android --platform android --no-wait --message "T-060 Android emulator baseline"`
  - `set -a; source /Volumes/DataDisk/Project/Fun-ForumAI/.env.local; set +a; pnpm exec eas build:list --limit 10 --json --non-interactive`
- Outcome:
  - PASS
- Notes:
  - iOS metadata 已通过 `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` 收口。
  - Android build 首次交互时成功创建 remote keystore：`✔ Created keystore`。
  - 已拿到真实云端 build 记录：
    - iOS: `21d058c3-7e39-412b-b20f-f6c077f0e661`
      - profile: `development-ios-simulator`
      - status at capture time: `IN_PROGRESS`
      - url: `https://expo.dev/accounts/willyu1007/projects/fun-forum-ai/builds/21d058c3-7e39-412b-b20f-f6c077f0e661`
    - Android: `9bb4b531-b277-437d-a6c1-211f7502646f`
      - profile: `development-android`
      - status at capture time: `NEW`
      - url: `https://expo.dev/accounts/willyu1007/projects/fun-forum-ai/builds/9bb4b531-b277-437d-a6c1-211f7502646f`
  - 这一步验证的是 T-060 所需的 EAS path closure 与可追踪 build record，不以云端构建最终结束状态作为本任务的额外阻塞条件。

### 2026-03-07 — operator command hardening
- Command:
  - `pnpm mobile:config:check`
  - `pnpm mobile:typecheck`
  - `pnpm mobile:test`
  - `pnpm mobile:doctor`
  - `pnpm mobile:run:ios -- --dry-run`
  - `pnpm mobile:run:android -- --dry-run`
  - `pnpm mobile:devbuild:ios -- --help`
  - `pnpm mobile:devbuild:android -- --help`
  - `pnpm --dir apps/mobile exec expo config --type public --json`
  - `pnpm exec tsc -p tsconfig.json --noEmit`
- Outcome:
  - PASS
- Notes:
  - root `mobile:devbuild:*` 已不再依赖手工 `source .env.local`。
  - `pnpm ... -- <extra args>` 的透传已被 wrapper 正确处理，`--help` 能从仓库根目录直接进入 EAS build 命令。
  - `mobile:config:check` 现在不仅校验文件存在，也校验渲染后的 Expo config 内容。
  - 渲染结果确认：
    - `plugins` 包含 `expo-dev-client`
    - `newArchEnabled=false`
    - `ios.infoPlist.ITSAppUsesNonExemptEncryption=false`
    - `extra.eas.projectId` 只在 env 存在时注入

### 2026-03-07 — review fix for Android autolinking under pnpm
- Command:
  - `pnpm --dir apps/mobile add -D expo-modules-autolinking@~2.1.15`
  - `node -e "console.log(require.resolve('expo-modules-autolinking/exports', { paths:['./apps/mobile/node_modules/expo'] }))"`
  - `node - <<'NODE' ... loadConfigAsync('./apps/mobile/node_modules/expo') ... NODE`
  - `pnpm --dir apps/mobile exec expo prebuild --platform android --clean`
  - `./gradlew app:compileDebugJavaWithJavac`
  - `jq '.dependencies.expo.platforms.android.packageImportPath' apps/mobile/android/build/generated/autolinking/autolinking.json`
  - `sed -n '1,90p' apps/mobile/android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java`
  - `pnpm --dir apps/mobile remove @react-native-community/cli`
  - `pnpm mobile:config:check`
  - `pnpm mobile:typecheck`
  - `pnpm mobile:test`
- Outcome:
  - PASS
- Notes:
  - 代码审查阶段复现了 Android 编译失败：生成的 `PackageList.java` 错误引用 `expo.core.ExpoModulesPackage`。
  - 直接检查 `expo/react-native.config.js` 与 `expo-modules-autolinking loadConfigAsync()` 后确认：问题出在 pnpm 下 `expo-modules-autolinking/exports` 对 `apps/mobile/node_modules/expo/react-native.config.js` 不可解析，导致 autolinking 回退到旧推断逻辑。
  - 给 `apps/mobile` 增加直接 `expo-modules-autolinking` 依赖后，`loadConfigAsync()` 恢复返回正确 config，生成物改为 `expo.modules.ExpoModulesPackage`。
  - Android `./gradlew app:compileDebugJavaWithJavac` 随后通过。
  - 试错加入的 `@react-native-community/cli` 已移除；移除后 `mobile:config:check`、`mobile:typecheck`、`mobile:test` 仍然通过。

### 2026-03-07 — post-review native rebuild
- Command:
  - `xcodebuild -workspace ios/AITalkshow.xcworkspace -scheme AITalkshow -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.3.1' build -quiet`
- Outcome:
  - PASS
- Notes:
  - iOS 在 review 后重新执行了完整 simulator build，退出码为 `0`。
  - 输出只剩 third-party warnings：
    - ExpoFileSystem nullability warnings
    - duplicate `-lc++` linker warning
    - several always-run CocoaPods script phase notes
  - 本轮仓库改动没有引入新的 iOS 编译错误。

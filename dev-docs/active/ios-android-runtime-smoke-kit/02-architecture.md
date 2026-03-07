# 02 Architecture — ios-android-runtime-smoke-kit (T-061)

## Design anchors
- Maestro 文件位于 `apps/mobile/.maestro/`。
- 目录结构：
  - `shared/`
  - `ios/smoke.yaml`
  - `android/smoke.yaml`
- 共享 fixture 脚本位于 repo root：`scripts/mobile-smoke-prepare.mjs`

## Fixture responsibilities
- 校验 backend 可达
- 注册并登录 smoke user
- 确保至少存在一个 agent
- 确保至少存在一个 private session
- 将运行时数据写入 `.ai/.tmp/mobile-smoke/<run-id>/`

## Script contract
- `mobile:smoke:prepare`
- `mobile:smoke:ios`
- `mobile:smoke:android`
- `mobile:smoke:validate`

## Maestro flow scope
- 匿名启动后仅看到 public tabs
- 登录成功
- Feed tab 加载成功
- Rooms tab 加载并打开一个房间
- Agents tab 加载成功
- XP tab 加载并完成刷新
- Private tab 新建或打开会话并发送一条人类消息

## Platform-specific rules
- iOS：使用 iOS Simulator + simulator dev build
- Android：使用 AVD emulator + emulator-installable build
- API base 默认值按平台区分，继承 `T-060` 的 host policy

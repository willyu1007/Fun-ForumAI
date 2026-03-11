# Roadmap — ios-android-runtime-smoke-kit (T-061)

## Objective
把移动端从“能编译和启动 Metro”提升到“iOS / Android 都有可重复的运行态 smoke”。

## Macro plan
- 设计 smoke fixture 和共享场景
- 落地 Maestro shared flows
- 分别接通 iOS simulator 与 Android emulator
- 增加 CI 无设备校验
- 形成 operator docs 与验证记录

## Risks
- 本机缺少 simulator / emulator
- 选择器在平台间漂移
- backend / DB 为空导致 smoke 不稳定

## Rollback
- 移除 Maestro 资产与 smoke 脚本
- 保留 `T-060` 的 dev build 基线，不影响普通 Expo 开发路径

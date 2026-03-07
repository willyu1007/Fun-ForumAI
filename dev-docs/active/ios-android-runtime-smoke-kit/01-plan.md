# 01 Plan — ios-android-runtime-smoke-kit (T-061)

## Phases
1. Runtime prerequisite and seed flow design
2. Maestro shared flows
3. iOS smoke package
4. Android smoke package
5. CI scaffold and docs
6. Evidence capture

## Acceptance criteria
- `pnpm mobile:smoke:prepare` 能准备 smoke fixture。
- `pnpm mobile:smoke:validate` 能在无设备环境下校验 Maestro 资产和脚本。
- iOS simulator smoke 覆盖匿名、登录、Feed、Rooms、Agents、XP、Private 主链路。
- Android emulator smoke 覆盖同一条主链路，并处理 Android host routing。
- 所有运行证据都记录到任务验证文档。

## Frozen decisions
- Harness 选型固定为 Maestro。
- Local runtime first，CI scaffold second。
- 一个共享 flow library，两个平台入口 flow。
- iOS / Android 都是必须覆盖的平台，而不是二选一。

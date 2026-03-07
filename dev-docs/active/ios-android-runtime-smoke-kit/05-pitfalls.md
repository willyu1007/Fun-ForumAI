# 05 Pitfalls — ios-android-runtime-smoke-kit (T-061)

## Template
- Symptom:
- Root cause:
- Failed attempts:
- Fix / workaround:
- Prevention note:

## Expected pitfalls to capture
### Maestro selectors drift across platforms
- Symptom:
  - iOS flow 可通过，但 Android 在同一交互节点失败。
- Root cause:
  - 组件文本、层级或可访问性标签在两端不一致。
- Failed attempts:
  - TBD
- Fix / workaround:
  - 将共享 flow 的 selector 语义前置为稳定 id / text contract。
- Prevention note:
  - 每次 UI 文案或导航改动都要检查 Maestro 入口选择器。

### Smoke fixtures fail because backend or DB is empty
- Symptom:
  - Flow 启动成功，但无 Agent / 无 session 可供验证。
- Root cause:
  - 运行前未准备测试数据，或本地 backend 不可达。
- Failed attempts:
  - TBD
- Fix / workaround:
  - 用 `mobile:smoke:prepare` 统一准备数据和运行时上下文。
- Prevention note:
  - smoke 执行说明必须把 fixture 准备列为强前置步骤。

### Android emulator uses wrong host
- Symptom:
  - Android smoke 在登录或刷新 XP 时持续失败。
- Root cause:
  - emulator 未使用 `10.0.2.2` 指向宿主机 backend。
- Failed attempts:
  - TBD
- Fix / workaround:
  - 继承 `T-060` 的 host policy，并在 Android flow 文档中明确要求。
- Prevention note:
  - Android smoke 前置检查必须显式输出当前 API base。

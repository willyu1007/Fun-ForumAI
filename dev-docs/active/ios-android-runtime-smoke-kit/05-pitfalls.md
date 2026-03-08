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

## Actual pitfalls encountered
### React Navigation keeps hidden tab screens mounted
- Symptom:
  - Maestro 在 iOS/Android 上都可能“看见”未选中的 tab screen，导致 tab 切换后仍然匹配到隐藏 screen 的 selector。
- Root cause:
  - bottom tabs 保持子 screen mounted，单靠 `feed-list-screen / rooms-list-screen` 这类静态 testID 无法表达“当前 tab 已聚焦”。
- Failed attempts:
  - 直接依赖 screen root `testID`。
  - 直接依赖 tab button `testID`。
- Fix / workaround:
  - 为每个 tab 根屏增加 `focused marker`。
  - 为每个 tab button 增加唯一 accessibility label，并让 Maestro 用这些 label 切 tab。
- Prevention note:
  - 以后所有 tab-based smoke 都要优先断言 focused marker，而不是断言 screen 已 mounted。

### iOS feed rows were not automation-stable
- Symptom:
  - iOS 能看到 seeded post 文本，但无法稳定从 feed list 打开帖子详情。
- Root cause:
  - iOS accessibility tree 对列表项、`Pressable` 和详情容器的暴露方式与 Android 不同，shared selector 语义不稳定。
- Failed attempts:
  - 直接点 row `testID`。
  - 用 `accessibilityLabel` 驱动 row。
  - 依赖第二个 `Pressable` button 的 `testID`。
  - 用 dev-only long press hook 复用 refresh button。
- Fix / workaround:
  - feed tab 必须先断言 focused marker。
  - iOS feed 最终走可见文本入口 `打开欢迎帖子` + 详情标题 marker。
- Prevention note:
  - 列表详情 smoke 不应假设两端 accessibility tree 一致；必要时拆平台 flow。

### Android dev-client overlay blocks the first screen
- Symptom:
  - Android 第一次进入 app 时，Expo dev-client overlay 覆盖在首页之上，Maestro 无法直接触达 tab bar 和业务控件。
- Root cause:
  - development build 容器自身会弹出 overlay / dev menu，这不是应用业务 UI。
- Failed attempts:
  - 仅在 Maestro flow 内点击 `Continue`。
- Fix / workaround:
  - `mobile-smoke-run.mjs` 在 Android 上先执行 `adb back`，再重新 foreground app。
  - `anonymous.yaml` 仍保留 `Continue` 兜底处理。
- Prevention note:
  - 任何 Android dev build smoke 都应把容器级 overlay 归一化放到 wrapper script，而不是堆在业务 flow 里。

### Android login and feed need platform-specific flows
- Symptom:
  - shared login/feed flow 在 Android 上会因为按钮行为、文本节点拆分方式不同而失败。
- Root cause:
  - Android 上登录按钮单击/双击行为、feed 文本节点结构与 iOS 不一致。
- Failed attempts:
  - 共用 iOS 的 login/feed selector 和点击节奏。
- Fix / workaround:
  - 新增 `apps/mobile/.maestro/android/login.yaml` 和 `apps/mobile/.maestro/android/feed.yaml`。
- Prevention note:
  - “共享语义”不等于“共享所有 selector 实现”；遇到平台差异应及时下沉到平台 flow。

### Current local/dev fixture strategy is not staging-safe
- Symptom:
  - 每次 smoke 都会在本地环境中留下唯一 run-id 数据。
- Root cause:
  - 当前任务明确锁定 `local/dev`，没有实现 cleanup 或 isolated-db。
- Failed attempts:
  - none
- Fix / workaround:
  - 使用 `run-id` 隔离 fixture，并在文档中明确声明不自动 cleanup。
- Prevention note:
  - 进入 shared staging 前必须单开任务补 `cleanup / isolated-db`；不能直接复用当前策略。

### Smoke markers leaked into normal UI
- Symptom:
  - 为 Maestro 添加的 `当前页:*` marker 和 `打开欢迎帖子` helper 直接显示在正常界面上。
- Root cause:
  - 自动化元素最初直接作为普通可见 UI 渲染，没有限定在 dev-only 运行态。
- Failed attempts:
  - none
- Fix / workaround:
  - 将 focused marker 和 feed helper 全部收敛到 `__DEV__`，只在本地开发 smoke 中暴露。
- Prevention note:
  - 以后新增 smoke selector 时，默认先判断它是不是只该存在于 dev build；不要把自动化辅助元素直接并入正式产品文案。

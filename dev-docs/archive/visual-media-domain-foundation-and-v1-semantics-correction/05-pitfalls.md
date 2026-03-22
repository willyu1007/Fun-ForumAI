# 05 Pitfalls

- 2026-03-22: DashScope 文本模型不能直接代替视觉模型
  - Symptom: owner upload / backfill 在真实环境中始终落 `fallback` snapshot，日志显示 `hidden_multimodal` 路由失败或 400。
  - Root cause: `qwen-flash-character` 这类文本模型不接受 OpenAI-compatible 的 `image_url` 多模态消息，但原隐藏路由把它当成了可用候选。
  - What was tried: 先检查 credential pool / profile，再直接用 DashScope OpenAI-compatible 请求分别验证 `qwen-flash-character` 与 `qwen-vl-plus`。
  - Fix/workaround: 将多模态偏好映射和 hidden vision profile 改到 `qwen-vl-plus` / `qwen-vl-max`，并给 DashScope pool 补 `hidden_multimodal` 能力标签。
  - Prevention: 任何“文本模型兜底视觉路由”的假设都必须先做真实 provider 请求验证，不能只凭模型名推断能力。

- 2026-03-22: 视觉模型的稀疏 JSON 不能按“全字段非空”来判失败
  - Symptom: provider 已成功返回结构化 JSON，但 `media_semantic_snapshots` 仍落成 `fallback/fallback`。
  - Root cause: `MediaSemanticService.tryParse()` 以前要求 `theme/scene/mood/discussion_points/public_safe_summary/internal_full_summary` 几乎都要显式非空；最小纯色图片常只返回 summary，导致有效结果被整体丢弃。
  - What was tried: 对真实返回样本做逐字段比对，确认 transport 成功而 parse 层拒绝。
  - Fix/workaround: 解析器改为接受“有结构化信号即可”，对缺失字段用 fallback summary 做补全。
  - Prevention: 多模态输出验收应以“结构化信号是否足够进入主域”为准，而不是把最小图像强行套进富语义模板。

- 2026-03-22: scheduler 的 pending agent 优先选择必须防 stale candidate
  - Symptom: 理论上存在 prioritized candidate 时，runtime 仍可能选到一个最终没有 `pending_asset` 的 agent，导致发帖成功但不挂图。
  - Root cause: `pickAgent()` 旧实现先按 id 选 agent，再单独取 `getPendingForAgent()`；如果候选在两次读取间失效，就会返回 `pending_asset = null` 的结果对象。
  - What was tried: 通过真实 `runtime/post` 与定向单测复现“优先列表存在，但 attach 丢失”的风险面。
  - Fix/workaround: 选择逻辑改成只返回仍能取到 `pending_asset` 的 prioritized agent；失效候选直接跳过。
  - Prevention: 任何“先拿 ID，再拿实体”的过渡 adapter 都要有 stale-read 防护，特别是 owner pool 这类会被 attach/归档快速改变的集合。

- 2026-03-22: 共享 app 单例会让路由测试出现 worker 级模块缓存污染
  - Symptom: `auth-api.test` 单跑稳定通过，但全量套件里偶发出现 `/v1/auth/login` 返回 `404`，而不是预期的 `401`。
  - Root cause: 路由测试直接复用共享 `app` 单例；当同一 worker 内其他用例做 `vi.resetModules()` / 动态导入时，`auth-api` 会继承不稳定的模块缓存状态。
  - What was tried: 先单跑 `auth-api.test`，确认业务逻辑正确；再对比全量执行，定位到是测试装配而不是 auth service 本身的错误。
  - Fix/workaround: `auth-api.test` 改为在 `beforeAll` 中显式 `vi.resetModules()` 后动态导入 `app`，并在 `afterAll` 做对应 teardown。
  - Prevention: 任何依赖全局 Express 单例的路由测试，只要同目录存在 `resetModules`/动态导入用例，就优先使用隔离 app 装配，避免把 worker 缓存当成测试前提。

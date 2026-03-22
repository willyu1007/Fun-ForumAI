# 03 Implementation Notes

- 2026-03-22: 创建任务包，补齐需求文档中 observability、lifecycle、rollout control 的独立承接缺口。
- 2026-03-22: 明确本包承接 dashboard、alerting、垃圾回收、snapshot 升级和带图率目标控制，不让这些内容分散到执行主链里。
- 2026-03-22: 将 T-124 切到 `in-progress`，实现方案采用追加式 `media_observability_events` + 持久化 `media_rollout_controller_overrides`，不复用 persona 的单行聚合表。
- 2026-03-22: root post 作为唯一自动 KPI；controller 通过覆盖 VisualDirective 的 threshold/generation/private-runtime 开关参与主链，但 comment/chat/highlights 只做诊断埋点。
- 2026-03-22: Prisma、repo、service、worker 全量落地：新增 observability event / rollout override 表、`MediaObservabilityService`、`MediaRolloutControllerService`、`MediaLifecycleService`、`MediaLifecycleWorker`，并接入 container/app 启停。
- 2026-03-22: root post、comment、chat room、private media、reuse governance、generation、write bridge 全部补齐埋点；critical private leak 会写 `risk_event_logs` 并通过 `PublicDisclosureCapService` 自动下发 `cap=0`。
- 2026-03-22: Admin control plane 已接通 `GET/PATCH/POST` 媒体运营接口，runtime dashboard 新增 media ops 区块、override 表单、gate/lifecycle 可视化；同时补了 observability/controller/lifecycle 单测和 admin API / dashboard 契约测试。
- 2026-03-22: 二次 code review 后收敛了 4 个真正影响 T-124 闭环的实现缺口：`MediaLifecycleService` 现在会排除 generation 关联资产、避免 orphan 与 backfill 同轮重叠；`MediaSemanticSnapshotRepository` 新增原子 `replaceCurrent()`，避免 refresh/backfill 时先清 current 再写新 snapshot 的丢失窗口；`MediaAssetService.refreshSemanticSnapshot()` 会同步更新 binding 的 `semantic_snapshot_id` 并重编译 retrieval/private runtime/private memory/public handoff/public runtime 投影，但显式跳过 `public_display`，保持已发布展示文案不漂移。
- 2026-03-22: 顺手修复了 3 个仓库既有测试基线漂移：LLM callsite inventory evidence pattern、`agent-create-post` prompt version 断言、以及 `ShellLeftRail` 导航文案断言；完整测试已恢复到全绿。
- 2026-03-22 21:49 CST: 本轮 deep review 又补齐了 3 个上线后才会暴露的 T-124 缺口。`MediaObservabilityService` 不再把 7d 窗口硬截断在 10k events，而是按 `created_at + id` 游标分页扫描，避免 dashboard / gates / controller 在高事件量下失真；`MediaLifecycleService` 不再只看最新 500 个 active assets，而是全量分页扫描，避免旧资产永远逃逸 orphan archive / snapshot backfill；`MediaRolloutControllerService` 现在会把 `AUTO` override 的 target band 贯穿到 boost/conserve/safe-mode 的 effective profile，并让 `force_safe_mode` 真正收紧 generation 与 private-derived path，而不再只是一个展示字段。
- 2026-03-22 21:49 CST: 顺手清理了一个阻断 `typecheck` 的死代码残留：删除已失效的 `pg-inclination-asset-repository.ts` 旧实现，避免它继续引用已经下线的 inclination repository/type contract。
- 2026-03-22 22:xx CST: 收尾清理确认没有新增 coverage/trace/tmp 测试产物残留；本轮真正需要清理的是任务治理状态本身，因此将 T-124 从 `active` 收口归档，并同步 project hub 的 path/status 指针，避免后续协作继续把它当作进行中任务。

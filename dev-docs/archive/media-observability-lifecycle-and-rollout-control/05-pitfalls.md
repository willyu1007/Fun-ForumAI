# 05 Pitfalls

- 2026-03-22
  - Symptom: T-124 首轮实现虽然有 lifecycle/backfill/controller 主链，但 snapshot refresh 只换了 current snapshot，没有同步 binding 与 future-use projection，且 orphan 判定会把同轮要归档的资产也放进 backfill。
  - Root cause: 生命周期逻辑只看 `bindings + post_media + source_kind`，没有把 generation output/job 关联纳入资产生存条件；snapshot repository 仍沿用 `clearCurrentByAssetId() + create()` 的两段式写法；projection refresh 被简化成 observability 事件，没有真正回写 runtime/retrieval payload。
  - What was tried: 先只补 observability 事件，随后发现这会让 backfill 在代码层看似“成功”，但认知路径和审计指针仍然是旧数据。
  - Fix/workaround: 为 lifecycle 引入 generation-output 豁免并排除 orphan/backfill 重叠；给 snapshot repo 加原子 `replaceCurrent()`；在 `MediaAssetService.refreshSemanticSnapshot()` 中统一更新 binding `semantic_snapshot_id` 和 retrieval/private runtime/private memory/public handoff/public runtime projection，同时保持 `public_display` 不回写。
  - Prevention note: 后续凡是做 snapshot/schema 升级，不要把“current snapshot 已切换”当成完成条件；必须同时检查 binding 指针、future-use projection payload 和已发布 display 的保守边界。
- 2026-03-22 21:49 CST
  - Symptom: deep review 发现 T-124 在测试量小的时候能通过，但一旦事件/资产规模上来，admin metrics 和 lifecycle sweep 会静默失真；另外 rollout override 上的 `force_safe_mode` 只是存储字段，没有真正改变 planner 输入。
  - Root cause: `MediaObservabilityService.getSnapshot()` 把 7d 事件硬编码截断为 10k；`MediaLifecycleService.previewCandidates()` 只扫描最新 500 个 active assets；`MediaRolloutControllerService` 在 boost/conserve/safe-mode 分支没有继承 `AUTO` override 的 target band，manual `force_safe_mode` 也没有强制关闭 generation/private-derived path。
  - What was tried: 先用定向 review 对照 T-124 任务包逐项检查，再补大窗口/多页单测复现。只有把扫描窗口推过原有上限，问题才会稳定暴露。
  - Fix/workaround: 给 media observability event / media asset repo 补 `created_at + id` 游标分页能力；observability 7d 聚合与 lifecycle candidate 扫描改为全量分页；controller 对 `AUTO` override 统一继承 target band，并让 `force_safe_mode` 真正下压 generation/private-runtime/private-inspired 开关。
  - Prevention note: 这类运营面功能不能只靠“小样本 happy path”验证。凡是 rolling window / lifecycle sweep / controller profile，都至少要补一条“跨页/跨上限”的回归用例，否则很容易在低流量测试里假闭环、到线上才失真。
- 2026-03-22 22:xx CST
  - Symptom: T-124 完成归档时，第一次 governance lint 误报 registry 仍指向 `active` 且状态仍是 `in-progress`。
  - Root cause: `sync --apply` 和 `lint --check` 被并行触发，lint 读取的是同步前快照，而不是归档后的最终 project hub 状态。
  - What was tried: 先检查 registry/task-index/dashboard 的实际内容，确认 sync 已经把 T-124 切到 `archive`；随后改为串行重跑 lint。
  - Fix/workaround: 任务归档和 project hub 修复必须使用“先 sync，后 lint”的串行顺序，不能并行执行。
  - Prevention note: 任何会重写 `.ai/project/main/*` 的命令后面，都不要把 lint/验证并到同一批并行工具调用里，否则很容易制造假的治理层失败。

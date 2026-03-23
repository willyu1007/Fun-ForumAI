# 01 Plan — visual-media-framework-v1-closure (T-914)

## Phases

1. Phase A: 建立 `T-914` 任务包并同步 project governance。`[done]`
2. Phase B: 扩展 schema / types / migration，落地 `thread_root_ref`、generation input contract、semantic v2。`[done]`
3. Phase C: 实现 planner / governance / promote / generation / safe-mode 主链修复。`[done]`
4. Phase D: 统一 root post read model，保留 `post_media` parity 兼容。`[done]`
5. Phase E: 补齐测试、context refresh 与验证记录。`[done]`

## Detailed Steps

- 为媒体 binding / projection continuity / image plan generation 合同新增 `thread_root_ref`、`input_mode`、显式 `aspect_ratio_hint`。
- 在 planner 中真正实现 `same_thread_public` 检索，并让 rollout controller 的 private-source 开关进入候选裁剪。
- 删除 write bridge 中的自动公开升级；新增 Owner-only `Promote` API/service，注册到 `self_public_archive`。
- 增加 scratch generation 决策与 job 路径，并在 generation 成功后用 output snapshot 重建当前 scene 的 display/public card。
- 把 semantic prompt 收回 registry v2，保持 reader 兼容 v1/v2，并为 lifecycle backfill 打通 refresh 路径。
- 将 root post feed/detail 切到 attachment/projection 主读，同时保留 `post_media` parity 验证与过渡兼容。
- 运行 targeted tests、media regression、typecheck、DB context refresh 和 governance sync/lint。

## Exit Criteria

- `00-overview.md` 的 acceptance criteria 全部满足。
- 关键主链与迁移文件已落地，且无需实现者再补决策。
- `04-verification.md` 记录完整，project hub 与 task bundle 状态一致。

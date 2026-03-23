# 04 Verification

## Governance

- Completed: `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: `[ok] Sync complete.`
  - Updates: `.ai/project/main/registry.yaml`、`.ai/project/main/dashboard.md`、`.ai/project/main/feature-map.md`、`.ai/project/main/task-index.md`
- Completed: `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: `[ok] Lint passed.`

## Target Verification Matrix

- Pending: 无公开 API/UI/search 继续依赖 comment-tree。
- Pending: runtime 中不存在 active `forum_comment`。
- Pending: 对外 contract 中不存在 `parent_comment_id` 或 `commentId`。
- Pending: anti-drift guard 能拦截旧语义回流。
- Pending: repo 中已无 active dual-track。
- Pending: `ForumSceneMetadata` 等 sidecar carrier 不再保留 comment target 查询与字段。
- Pending: media scene type / evidence ref / attachment lookup 中已无 `forum_comment`。
- Pending: relation、policy、XP、achievement、observability、prompt override 等共享 enum 中已无 active `forum_comment`。
- Pending: frontend query keys、hooks、shared API/search types 中已无 comment 主路径入口。

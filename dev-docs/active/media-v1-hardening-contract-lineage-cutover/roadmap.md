# Roadmap — media-v1-hardening-contract-lineage-cutover (T-918)

## Summary

围绕现有 media 主域做一次真正的 V1 硬化收口：语义契约升级到 v3、治理 fail-closed、lineage 图谱一期落地、generation compiler 结构化、根帖读侧与 media 命名切换完成。

## Milestones

1. 任务与治理建包：`[in-progress]`
2. semantic v3 + strict audit：`[completed]`
3. lineage edge graph + backfill：`[completed-in-repo / pending-db-apply]`
4. generation compiler cutover：`[completed]`
5. root-post/media naming cutover + verification：`[completed-in-repo]`

## Risks

- 变更面大，涉及 Prisma schema、repo/domain 映射、planner/gateway、route/frontend hooks 和测试。
- 旧 `inclination-asset` 与 `post_media` 兼容逻辑若切得不干净，会持续制造双轨；当前清理目标是把旧 route alias 完整移除。
- generation 和 lineage 两条链一旦 contract 不一致，会出现“写得出但查不回”的隐性数据债。

## Rollback

- semantic v3、strict audit、lineage-required、root-post attachment-only 仍可通过 rollout 开关降级。
- 旧媒体路由别名不再作为回滚手段；若需要回滚，只保留主 `media` 路径并通过代码回退处理。

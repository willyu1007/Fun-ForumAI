# 05 Pitfalls

- 把 thread root 当成 `turn_index=0` 会把两层舞台重新退化成伪评论树。
- 只改前端展示、不改 runtime context 和 director target selection，会留下最危险的语义漂移。
- 把 `anchor_turn_id` 当成新的结构父指针使用，会重新长出隐藏树语义。
- 把 route handoff 留成 UI 占位而不进入域模型，会让超限转场再次分散到各处。
- 不重做 scene sidecar carrier，只保留 `postId/commentId`，会直接卡住 continuity、selector 和 audit 串联。
- 不同步切 media scene type / evidence ref，会导致 attachments 能力在 thread/turn cutover 后断链。
- 不显式改 relation 和 source enum，系统表面能跑，但社交图、XP、achievement、policy telemetry 会悄悄失真。

## Resolved: 2026-03-23 `ForumSceneMetadata` sidecar uniqueness drift

- Symptom: 为同一个 thread 同时创建 `THREAD` sidecar 和 `TURN` sidecar 时，repository 直接抛出 `ForumSceneMetadata already exists for thread ...`，导致 continuity 无法同时验证 `turn_sidecar -> thread_sidecar` 优先级。
- Root cause: `ForumSceneMetadata` 的 repo/create 路径把所有带 `thread_id` 的 sidecar 都写进 thread 唯一 carrier，包括 `TURN` target；这让 thread-level sidecar 和 turn-level sidecar 共享了同一个唯一键。
- What was tried: 先在 continuity 测试里直接造 thread sidecar + turn sidecar，立即触发唯一键冲突；随后回查 Prisma/PG/InMemory repo 和 public-scene-write path，确认冲突来自 sidecar carrier 语义本身，而不是测试夹具。
- Fix/workaround: 统一改成“只有 `THREAD` target 占用 `thread_id` carrier，`TURN` target 只占用 `turn_id` carrier”，并同步修正 InMemory repo、PG repo 与 public-scene-write repository 的写入逻辑。
- Prevention note: 后续凡是新增 sidecar / carrier 字段，都必须先回答“这个字段是 lookup key 还是上下文冗余”。如果它要被用作唯一 continuity carrier，就不能在其他 target type 上复用。

## Resolved: 2026-03-23 media / policy / prompt runtime semantic backflow

- Symptom: thread/turn 主链已经落地后，media bridge、policy gateway、XP、achievement、prompt budget、overlay scene allow-list 仍持续使用 `forum_comment`，导致 attachment、risk attribution、成长来源和 editor/runtime scene 配置出现双轨。
- Root cause: 早期论坛回复语义同时嵌在 media scene type、safe-reply scene、XP source、achievement signal 和 prompt scene 枚举中，单独切 write/read API 不会自动把这些横向枚举一起更新。
- What was tried: 先用 repo-wide grep 定位所有 active `forum_comment` 命名，再以 `MediaSceneType / PromptScene / XpSource / AchievementSignalKind / PolicyGatewayChannel` 为骨架逐层收口，最后用 targeted tests 验证没有回流。
- Fix/workaround: 统一把公共回复链改成 `forum_thread / forum_turn`，同时把附件绑定、observability、relation attribution、prompt override UI、instruction editor、dev prompt render scene 一起切到新命名。
- Prevention note: 以后新增公共舞台相关枚举时，必须先检查它是否同时出现在 media、policy、growth、prompt/runtime、editor surfaces；这些地方任何一个漏改，都会让旧语义借枚举值重新回流。

## Resolved: 2026-03-23 route handoff only existed as storage skeleton

- Symptom: `active_route`、`thread_state` 和 `reply_budget` 已进入 thread domain 与 UI，但没有任何服务层决策或写回路径；结果是 thread card 虽然能渲染 route block，却永远拿不到真实 handoff/CTA。
- Root cause: 早期 cutover 先把 `RouteHandoff` 当成 read-model 字段冻结下来，但没有把 route seed、预算收口规则和 `THREAD_ROUTE_UPDATED` 事件一起落到写模型里。
- What was tried: 先用 repo-wide 搜索确认只有 repo/read/UI 在使用 `active_route`；随后回到 `comment-command`、`ForumWriteService`、validation 和 E2E 路由，把 route 作为 thread create / turn add 的正式输入合同补齐。
- Fix/workaround: 现在 thread create / turn add 支持显式 `route_handoff` seed；当 thread 接近预算上限时自动进入 `PEAKED` 并生成默认 `AFTERSHOW` handoff，预算耗尽时自动 `CLOSED`；同时写出 `THREAD_ROUTE_UPDATED` 事件，并在帖子页 thread card 内显示 CTA。
- Prevention note: 以后凡是先冻结“域对象字段”但延后“写路径和决策路径”的设计，都必须在任务文档里单列 closure gate；否则系统会出现“类型齐了、行为还没接上”的假完成。

## Resolved: 2026-03-23 Prisma thread-search model rename left stale index names

- Symptom: `pnpm tsc --noEmit` 通过后，`pnpm prisma validate` 仍然失败，提示 `ThreadSearchDoc` 的索引继续引用 `commentCreatedAt` 和 `authorSignalScore`。
- Root cause: 线程搜索模型已经把 Prisma field 改名成 `threadCreatedAt / threadSignalScore`，但 `schema.prisma` 里的 `@@index` 仍停留在旧字段名。
- What was tried: 先复现 validate 失败，再回查 `ThreadSearchDoc` 的 Prisma model 和 PG repo 映射，确认只是 Prisma field rename 收口不完整，而不是表结构不兼容。
- Fix/workaround: 把索引定义同步改成 `@@index([threadCreatedAt])` 与 `@@index([threadSignalScore])`，随后重新执行 `prisma validate / generate`。
- Prevention note: 以后只要 Prisma model 做字段重命名，就必须把 `@@index`、`@@unique`、relation field name 和 repo SQL alias 一起审一遍，不能只改 property 本身。

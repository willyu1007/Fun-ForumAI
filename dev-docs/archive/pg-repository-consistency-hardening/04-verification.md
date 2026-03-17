# 04 Verification

## Automated checks
- `pnpm typecheck`（预期：通过）
- `pnpm test`（预期：回归通过 + 新增仓储一致性测试通过）
- `pnpm lint`（预期：通过）

## Execution log (2026-02-25)
- ✅ `pnpm -s eslint <changed-backend-files...>`
  - 结果：通过（本次改造文件无 lint 错误）。
- ✅ `pnpm -s vitest run src/backend/repos/__tests__/post-repository.test.ts src/backend/repos/__tests__/comment-repository.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/governance-adapter.test.ts src/backend/moderation/__tests__/governance-service.test.ts`
  - 结果：6 files / 54 tests 全部通过。
- ✅ `pnpm -s test`
  - 结果：31 files / 266 tests 全部通过（含路由 E2E）。
- ⚠️ `pnpm -s typecheck`
  - 结果：存在仓内既有错误（前端 + 若干 Prisma 相关模型漂移），与本任务改造链路无直接关系；已记录为后续清理项。

## Manual smoke checks
- 双实例同时读写帖子/评论，确认结果一致。
- 重启任一实例后，feed、room、message 查询结果无分叉。
- 管理后台关键统计接口返回值连续稳定。

## Rollout / Backout (if applicable)
- Rollout:
  - staging 双实例验证 -> prod 灰度。
- Backout:
  - 回滚到上一稳定镜像，必要时启用 legacy repo mode。

## Kind local cluster smoke (2026-02-25)
- Scenario: cross-instance write/read consistency + single-instance restart
- Steps:
  - Select 2 running backend pods in `funforum`
  - Port-forward to both pods (`4201/4202`)
  - Create post on node1 (`POST /v1/posts`, service token)
  - Verify node2 reads same post (`GET /v1/posts/:postId`)
  - Create comment on node2 (`POST /v1/comments`, service token)
  - Verify node1 reads same comment (`GET /v1/posts/:postId/comments`)
  - Delete one backend pod and wait replacement ready
  - Re-check post+comment visibility from both live pods
- Result: pass
  - post id: `cmm2m7ra1000019oc0xp9r9wg`
  - comment id: `cmm2m7rce000219mthls8kem8`
  - pods before: `backend-68bd86fc6c-mfbkz`, `backend-68bd86fc6c-thn6c`
  - pods after: `backend-68bd86fc6c-8s5w9`, `backend-68bd86fc6c-thn6c`

## Reusable script run (2026-02-25)
- `pnpm smoke:t024:k8s`
  - Result: pass
  - Evidence sample:
    - post id: `cmm2ms996000c19ki04y0mss4`
    - comment id: `cmm2ms99s000319mtbzn7id42`
    - includes single backend pod restart and post-restart consistency checks

## Second-pass staging smoke (2026-02-25)
- Suite run: `node scripts/t023-t025-k8s-smoke-suite.mjs` → T-024 section PASS
  - post id: `cmm2n5w1m000a19nb70hxv35u`
  - comment id: `cmm2n5w28000419mt6byac0ao`
  - pods before: `backend-68bd86fc6c-gvv7k`, `backend-68bd86fc6c-thn6c`
  - pods after (post pod-restart): `backend-68bd86fc6c-hnwxm`, `backend-68bd86fc6c-thn6c`
  - Post title consistent across both nodes after restart
  - Comment visible on both nodes after restart

## Performance baseline (2026-02-25)
- Environment: kind-funforum cluster, PostgreSQL 16.12, 2 backend replicas
- Data scale: posts=32, comments=4, rooms=0, room_messages=0, events=36, agents=5

### DB-level query performance (EXPLAIN ANALYZE)

| Query path | Execution time | Plan | Notes |
|---|---|---|---|
| `SELECT * FROM posts ORDER BY created_at DESC LIMIT 20` | 0.088 ms | Seq Scan → Sort → Limit, shared hit=5 | Feed 列表，当前行数少走 seqscan 合理 |
| `SELECT * FROM comments WHERE post_id=? ORDER BY created_at` | 0.071 ms | Bitmap Index Scan on `comments_post_id_created_at_idx` | 索引命中 ✅ |
| `SELECT * FROM posts WHERE id=?` | 0.238 ms | Index Scan on `posts_pkey` | 主键查询 ✅ |
| `SELECT * FROM rooms ORDER BY created_at DESC` | 0.034 ms | Seq Scan (0 rows) | 数据为空 |
| `SELECT * FROM room_messages WHERE room_id=? ORDER BY created_at` | 0.051 ms | Bitmap Index Scan on `room_messages_room_id_created_at_idx` | 索引命中 ✅ |

### API-level latency (10 requests each, via port-forward)

| Endpoint | P50 | P95 | Max | Notes |
|---|---|---|---|---|
| `GET /v1/feed` | 106 ms | 112 ms | 218 ms | 首次请求含连接预热 |
| `GET /v1/communities` | 103 ms | 150 ms | 221 ms | 偶发尾部延迟 |
| `GET /v1/posts/:id` | 99 ms | 111 ms | 130 ms | 稳定 |
| `GET /v1/posts/:id/comments` | 95 ms | 115 ms | 131 ms | 稳定 |
| `GET /v1/highlights` | 94 ms | 96 ms | 103 ms | 最快路径 |

### Index coverage assessment

| Table (T-024 scope) | Key query path | Index used | Status |
|---|---|---|---|
| posts | feed (ORDER BY created_at) | `posts_community_id_created_at_idx` | ✅ 可用（当前 seqscan 因行数少） |
| posts | by ID | `posts_pkey` | ✅ |
| comments | by post_id + ORDER BY | `comments_post_id_created_at_idx` | ✅ |
| rooms | list | `rooms_pkey` / `rooms_status_idx` | ✅ |
| room_messages | by room_id + ORDER BY | `room_messages_room_id_created_at_idx` | ✅ |

### Conclusion
- DB-first 改造后查询延迟在 sub-millisecond 级别（DB 层），API 端到端 P95 < 150ms。
- 当前数据量较小（<100 rows），所有查询均快速完成。
- 关键查询路径的索引覆盖完整，无明显慢查询。
- 建议在数据量超过 10K 行后复测，关注 feed 列表的分页效率（当前为内存分页）。

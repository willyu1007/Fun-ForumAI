# 03 Implementation Notes

## Status
- Current status: `done`
- Last updated: 2026-03-04 (closeout)

## What changed
- PKG-1/2/3 主链路已落地：
  - StageSpec v1 类型/解析/降级策略（`rules_json.stage_spec_v1`）。
  - `GET/PATCH /v1/communities/:communityId/stage-spec`。
  - Agent Stage Tier 计算与快照仓储/服务。
  - `GET /v1/agents/:agentId/stage-tier`。
  - membership 状态扩展（`ACTIVE|MUTED|BANNED`）及状态更新 API。
  - casting pool + forum runtime 写入 gate（tier + membership status）。
- PKG-4/5 API 与数据层已接线：
  - incubation repository/service + `GET/POST` 接口（job/grant/review-verdict）。
  - audience repository/service + `GET /v1/posts/:postId/audience-thread`、`POST /v1/posts/:postId/audience-messages`。
  - aftershow repository/service + `POST /v1/posts/:postId/aftershow/trigger`（含 THRESHOLD/PERIODIC 语义）。
- PKG-6 模板资产与脚本已交付：
  - `docs/stage-templates/v1/templates/*.yaml`（50个）
  - `library.manifest.yaml`（20 launch + 30 hidden）
  - `dist/library.json`, `dist/launch.json`
  - `scripts/stage-templates-validate.mjs`
  - `scripts/stage-templates-export.mjs`
  - `scripts/stage-season-rotate.mjs`
  - `season-rotation-manual.md`
- 本轮补齐（按你的顺序）：
  - Prisma migration 已生成：`prisma/migrations/20260304031012_t049_rich_communities/migration.sql`。
  - migration 已做上线安全修正：
    - `human_votes` 从 TEXT/check 迁移到 enum 改为 cast（非删列重建）。
    - 保留历史 partial unique 索引（避免约束回退）。
    - 修复从空库回放时的约束/索引冲突（`DROP CONSTRAINT IF EXISTS` + `CREATE INDEX IF NOT EXISTS`）。
  - Web Admin 轻量入口已补齐：
    - 后端 `POST /v1/admin/stage/season-rotate`（`open_count: 3-5`，支持 `dry_run`）。
    - 前端 Admin Runtime 面板新增 Season Rotation 按钮与结果卡片。
  - K8s 配置冻结与稳定性修复已完成：
    - `ops/deploy/k8s/overlays/local-kind/patch-configmap.yaml` 固化 `RUNTIME_LEADER_TTL_MS: "120000"`。
    - `scripts/runtime-staging-smoke.mjs` 与 `scripts/k8s-smoke-utils.mjs` 的 Pod 发现逻辑升级为 `Running + Ready + 非终止中`，并优先最新 Pod。
    - 回归结果：`T-023` 与 `T-023~T-025` 套件在 `kind-funforum/funforum` 均通过。

## Files/modules touched (high level)
- `prisma/schema.prisma`
- `docs/stage-templates/v1/*`
- `scripts/stage-templates-validate.mjs`
- `scripts/stage-templates-export.mjs`
- `scripts/stage-season-rotate.mjs`
- `src/backend/stage/*`
- `src/backend/services/{forum-write-service,agent-stage-tier-service,incubation-service,audience-service,aftershow-service}.ts`
- `src/backend/repos/*`（membership/tier/incubation/audience/aftershow + pg）
- `src/backend/routes/{control-plane,read-api}.ts`
- `src/backend/lib/config.ts`
- `env/contract.yaml`

## Decisions & tradeoffs
- Decision:
  - 兼容旧行为优先：在 StageSpec/role gate 未开启时，不强制社区存在与 gate 拦截。
  - Rationale:
    - 避免对既有 e2e/data-plane 用例和现网默认路径产生回归。
  - Alternatives considered:
    - 无条件强制 stage/membership gate；已放弃（会导致大面积回归）。

## Deviations from plan
- 当前无偏离（本轮已补齐轻量 Admin 按钮）。

## Known issues / follow-ups
- 全量测试仍有 2 个既有失败（未在本次变更中引入）：
  - `src/backend/allocator/__tests__/candidate-selector.test.ts`（PPR bonus 排序断言）
  - `src/backend/repos/__tests__/ppr-snapshot-repository.test.ts`（snapshot 查询断言）
- 收口结论：
  - 上述失败归类为 pre-existing residual risk，不阻塞 T-049 功能包交付收口；
  - 后续以独立任务处理全量测试清零与生产灰度期指标观测。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).

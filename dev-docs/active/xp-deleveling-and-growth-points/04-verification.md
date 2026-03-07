# 04 Verification — xp-deleveling-and-growth-points

## Verification matrix
| Area | Command / Method | Expected outcome | Status |
|------|------------------|------------------|--------|
| governance sync | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | task / requirement 注册成功 | PASS |
| governance lint | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | no blocking errors | PASS |
| schema migration dry run / apply | Prisma validate + real `migrate deploy` on local dev DB | schema valid and T-059 applied | PASS |
| XP award paths | targeted vitest + authenticated HTTP smoke | message/post/comment/digest/vote write XP | PASS |
| stats formula sync | targeted vitest | `floor(xp / 50)` stable and non-duplicating | PASS |
| old API removal | TypeScript compile + code search | `/growth` family unavailable | PASS |
| prompt/runtime rename | targeted vitest | `layer1_traits` path green | PASS |
| web profile/dashboard rendering | browser smoke on local dev frontend | no `Lv.` / slots / level lock | PASS |
| mobile growth rendering | Expo Metro + simulator availability check + TS compile | bundler ok; native runtime blocked by missing simulator device | PARTIAL |
| UI governance gate | `ui_gate.py run --mode full` | evidence captured; touched files introduce no new gate findings | PARTIAL |
| achievements/stage tier regression | targeted vitest e2e + service/stage tests | unaffected behavior | PASS |

## Verification log template
### <date> — <area>
- Command:
  - `<command>`
- Outcome:
  - PASS / FAIL
- Notes:
  - <note>

### 2026-03-06 — governance sync
- Command:
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- Outcome:
  - PASS
- Notes:
  - `R-023` / `T-059` 注册成功；derived views 更新了 `dashboard.md`、`feature-map.md`、`task-index.md`。
  - sync 输出了若干历史 active task 的 warning，但不影响本任务注册。

### 2026-03-06 — governance lint
- Command:
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- Outcome:
  - PASS
- Notes:
  - 无 blocking error，当前任务包与 registry 映射一致。

### 2026-03-06 — prisma schema validation
- Command:
  - `pnpm exec prisma format`
  - `pnpm exec prisma validate`
- Outcome:
  - PASS
- Notes:
  - `prisma/schema.prisma` 通过校验；migration SQL 为手写文件，尚未对真实数据库执行 apply。

### 2026-03-06 — TypeScript compile
- Command:
  - `pnpm exec tsc -p tsconfig.json --noEmit`
- Outcome:
  - PASS
- Notes:
  - 前后端与移动端的 XP / traits 命名切换已通过编译。

### 2026-03-06 — targeted Phase 1 tests
- Command:
  - `pnpm exec vitest run src/backend/services/__tests__/nurture-orchestrator.test.ts src/backend/services/__tests__/stats-service.test.ts src/backend/services/__tests__/relation-service.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/proactive-interaction-service.test.ts src/frontend/features/agents/components/__tests__/StatsPanel.test.tsx`
  - `pnpm exec vitest run src/backend/runtime/__tests__/context-builder.layer-stack-v2.test.ts src/backend/routes/__tests__/dev-prompts-render.test.ts`
- Outcome:
  - PASS
- Notes:
  - 覆盖了 XP dedup、stats 公式同步、固定 relation cap、prompt/runtime 改名、dev prompt render 占位符以及前端 Stats 面板。

### 2026-03-06 — DB context refresh
- Command:
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- Outcome:
  - PASS
- Notes:
  - `docs/context/db/schema.json` 已根据新的 Prisma SSOT 刷新。

### 2026-03-06 — local migration apply
- Command:
  - `pnpm exec prisma migrate status`
  - `pnpm exec prisma migrate resolve --rolled-back 20260305045650_t052_t057_events_governance`
  - `pnpm db:migrate:deploy`
  - `psql 'postgresql://yurui@localhost:5432/llm_forum_dev' -P pager=off -c "SELECT to_regclass('public.agent_xp') AS agent_xp, to_regclass('public.agent_growth') AS agent_growth, to_regclass('public.xp_events') AS xp_events, to_regclass('public.legacy_growth_events_archive') AS legacy_growth_events_archive;"`
  - `psql 'postgresql://yurui@localhost:5432/llm_forum_dev' -P pager=off -c "SELECT 'agent_xp' AS table_name, COUNT(*) AS row_count FROM agent_xp UNION ALL SELECT 'xp_events', COUNT(*) FROM xp_events UNION ALL SELECT 'legacy_growth_events_archive', COUNT(*) FROM legacy_growth_events_archive;"`
  - `psql 'postgresql://yurui@localhost:5432/llm_forum_dev' -P pager=off -c "SELECT event_type, COUNT(*) FROM legacy_growth_events_archive GROUP BY event_type ORDER BY event_type;"`
- Outcome:
  - PASS
- Notes:
  - 本地 dev DB 上实际应用了 `20260305162000_t054_control_plane_full_alignment`、`20260306090000_t054_control_plane_stage_spec_normalization` 和 `20260306153000_t059_xp_deleveling_phase1`。
  - 结构核验结果：
    - `agent_xp` 存在，`agent_growth` 不存在。
    - `xp_events` 与 `legacy_growth_events_archive` 均存在。
    - `agent_xp=5 rows`，`xp_events=32 rows`，`legacy_growth_events_archive=42 rows`。
    - archive 中事件分布为 `level_up=1`、`milestone=9`、`xp_gain=32`，符合“主账本只承接 XP 事件”的预期。

### 2026-03-06 — Prisma client regeneration
- Command:
  - `pnpm exec tsx -e "import { getPrismaClient, disconnectPrisma } from './src/backend/persistence/prisma-client.ts'; (async () => { const prisma = getPrismaClient() as any; console.log('agentXp', typeof prisma.agentXp); console.log('xpEvent', typeof prisma.xpEvent); console.log('agentGrowth', typeof prisma.agentGrowth); console.log('growthEvent', typeof prisma.growthEvent); await disconnectPrisma(); })().catch((err) => { console.error(err); process.exit(1) })"`
  - `pnpm exec prisma generate`
  - `pnpm exec tsx -e "import { getPrismaClient, disconnectPrisma } from './src/backend/persistence/prisma-client.ts'; (async () => { const prisma = getPrismaClient() as any; console.log('agentXp', typeof prisma.agentXp); console.log('xpEvent', typeof prisma.xpEvent); console.log('agentGrowth', typeof prisma.agentGrowth); console.log('growthEvent', typeof prisma.growthEvent); await disconnectPrisma(); })().catch((err) => { console.error(err); process.exit(1) })"`
- Outcome:
  - PASS
- Notes:
  - regenerate 前本地 client 仍暴露 `agentGrowth/growthEvent`，导致 `/xp` 和 `/dashboard` 运行时 500。
  - regenerate 后 delegate 正确切换为 `agentXp/xpEvent`。

### 2026-03-06 — authenticated API smoke
- Command:
  - 启动 backend：
    - `DB_PERSISTENCE=true FF_AGENT_STATS_V1=true FF_AGENT_STATS_UI=true FF_NURTURE_PIPELINE_V2=true pnpm dev:backend`
  - 使用 dev bearer token 执行：
    - `POST /v1/agents`
    - `POST /v1/agents/:agentId/rooms` x5
    - `GET /v1/agents/:agentId/xp`
    - `GET /v1/agents/:agentId/xp-events?limit=6`
    - `GET /v1/agents/:agentId/dashboard`
    - `GET /v1/agents/:agentId/stats`
    - `GET /v1/agents/:agentId/xp` without auth
    - `GET /v1/agents/:agentId/stats` as another user
- Outcome:
  - PASS
- Notes:
  - 真实会话中，创建新 agent 后连续创建 5 个房间，`room_created` 累计得到 `50 XP`。
  - `/xp` 返回：
    - `xp=50`
    - `xp_per_growth_point=50`
    - `growth_points_total=1`
    - `growth_points_available=1`
  - `/xp-events` 返回 5 条 `room_created -> +10 XP` 事件。
  - `/dashboard` 返回 `data.xp` 与 `recent_events`，不再包含 `level` 语义。
  - `/stats` 返回 `unspent_points=1` 与 `granted_points_total=1`，证明 `floor(xp / 50)` 同步已生效。
  - 负例结果：
    - `/xp` 无 token 返回 `401 UNAUTHORIZED`
    - `/stats` 非 owner 返回 `403 FORBIDDEN`

### 2026-03-06 — web profile/dashboard browser smoke
- Command:
  - 启动 frontend：
    - `pnpm dev:frontend`
  - 使用 chrome-devtools 打开 `http://localhost:3000/`
  - 在浏览器内通过 `fetch('/v1/auth/register', ...)` 注册测试用户并建立登录态
  - 打开：
    - `/agents/0eb99c65-dfbe-4dec-be3c-8778346a989e`
    - `/agents/0eb99c65-dfbe-4dec-be3c-8778346a989e/dashboard`
  - 通过 DOM 文本检查 `Lv.` / `槽位` 是否消失，`XP` / `成长点` 是否存在
- Outcome:
  - PASS
- Notes:
  - Profile 页展示 `XP 60 XP` 与 `成长点 1 / 1`，未出现 `Lv.` 或 `槽位`。
  - Dashboard 页展示：
    - `经验值 60 XP`
    - `每点成长需求 50 XP`
    - `成长点总额 1`
    - `已花费成长点 0`
    - `可用成长点 1`
  - 页面级文本检查结果：
    - `hasLv=false`
    - `hasSlot=false`
    - `hasGrowthPoints=true`
    - `hasXP=true`
  - Web runtime smoke 覆盖成功；mobile 仍只做了 compile-level 验证，没有运行态 emulator smoke。

### 2026-03-06 — smoke data cleanup
- Command:
  - `psql 'postgresql://yurui@localhost:5432/llm_forum_dev' -P pager=off <<'SQL' ... COMMIT; SQL`
  - 主要删除目标：
    - smoke agents: `de2f3d36-3166-43ee-95e3-5cde18a34b8d`, `0eb99c65-dfbe-4dec-be3c-8778346a989e`
    - UI smoke user: `ui-smoke-1772807070715@example.com`
  - 删除后核验：
    - `SELECT 'agents' AS entity, COUNT(*) AS remaining FROM agents WHERE id IN (...) UNION ALL SELECT 'rooms', COUNT(*) ... UNION ALL SELECT 'ui_smoke_users', COUNT(*) ...;`
- Outcome:
  - PASS
- Notes:
  - 已删除：
    - `room_messages=30`
    - `room_memberships=10`
    - `xp_events=15`
    - `agent_xp=1`
    - `agent_stat_events=1`
    - `agent_states=2`
    - `agent_stats=2`
    - `agent_traits=2`
    - `rooms=10`
    - `agents=2`
    - `human_users=1`
  - 核验结果：
    - `agents remaining = 0`
    - `rooms remaining = 0`
    - `ui_smoke_users remaining = 0`

### 2026-03-06 — achievements and stage-tier regression
- Command:
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/stage/__tests__/agent-stage-tier.test.ts`
- Outcome:
  - PASS
- Notes:
  - 4 个 test files 全绿，18 个 tests 全通过。
  - 覆盖内容：
    - achievements / chronicle owner/admin 访问语义
    - public highlights backward compatibility
    - chronicle 压缩与 signal policy
    - stage tier 评分、降级和 trust penalty 计算
  - 这轮回归说明 XP 去 level 化没有影响 achievements / chronicle / stage tier 主语义。

### 2026-03-06 — mobile runtime environment check
- Command:
  - `xcrun simctl list devices available | sed -n '1,200p'`
  - `pnpm mobile:typecheck`
  - `pnpm mobile:dev`
  - 在 Expo 交互里执行 `i`
- Outcome:
  - PARTIAL
- Notes:
  - `pnpm mobile:typecheck` 通过。
  - Expo Metro 能正常启动，并输出 `exp://192.168.0.10:8081`。
  - 但本机 `simctl` 仅返回 `== Devices ==`，没有可用设备。
  - 在 Expo 中执行 `i` 时返回：`CommandError: No iOS devices available in Simulator.app`。
  - 结论：mobile bundler 正常，但这台机器当前缺少可用 simulator 设备，无法完成原生运行态 smoke。

### 2026-03-07 — product copy tightening compile and test
- Command:
  - `pnpm exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/mobile typecheck`
  - `pnpm exec vitest run src/frontend/features/agents/components/__tests__/StatsPanel.test.tsx`
- Outcome:
  - PASS
- Notes:
  - Web 与 Mobile 的 XP / 成就线文案调整均通过类型检查。
  - `StatsPanel` 相关测试全绿；补充了对缺失 `granted_points_total` 旧数据的兼容，避免已分配成长点显示为 `NaN`。

### 2026-03-07 — UI governance gate
- Command:
  - `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full --repo-root . --run-id t059-xp-copy-20260307-070137 --evidence-root .ai/.tmp/ui`
  - `rg -n "src/frontend/features/dashboard/pages/AgentDashboardPage.tsx|src/frontend/features/agents/pages/AgentProfilePage.tsx|src/frontend/features/agents/components/AchievementChroniclePanel.tsx|src/frontend/features/agents/components/LevelBadge.tsx|src/frontend/features/agents/components/StatsPanel.tsx|apps/mobile/src/navigation/growth-stack.tsx|apps/mobile/src/navigation/main-tabs.tsx|apps/mobile/src/navigation/auth-screen.tsx|apps/mobile/src/navigation/agents-stack.tsx" .ai/.tmp/ui/t059-xp-copy-20260307-070137/ui-gate-report.md`
- Outcome:
  - PARTIAL
- Notes:
  - gate 生成了完整 evidence：`.ai/.tmp/ui/t059-xp-copy-20260307-070137/`。
  - 仓库级 UI 基线仍有大量既有问题，report 总计 `2530 errors / 82 warnings`，因此 gate 整体未通过。
  - 但本次触达的 Web / Mobile 文件没有出现在 gate report 中，说明这轮文案收口没有新增 gate 可见问题。

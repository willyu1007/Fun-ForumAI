# 02 Architecture

## Context & current state
Stats 功能已有完整数据/API/行为层实现，但当前 launch capability wiring 回归成硬编码默认值，前端 modal 也不再按 `VITE_FF_AGENT_STATS_UI` 控制入口显示。

## Proposed design

### Components / modules
- `src/frontend/shared/config/frontend-flags.ts`
- `src/frontend/shared/config/frontend-capabilities.ts`
- `src/frontend/features/agents/components/modal/TabIntro.tsx`
- `src/backend/lib/config.ts`

### Interfaces & contracts
- Frontend env:
  - `VITE_FF_AGENT_STATS_UI`
- Backend env:
  - `FF_AGENT_STATS_V1`
  - `FF_AGENT_STATS_BEHAVIOR`
  - `FF_AGENT_STATS_RELATION_POLICY`
  - `FF_AGENT_STATS_VOTE_POLICY`
  - `FF_AGENT_STATS_UI`
- API endpoints:
  - `/v1/agents/:agentId/stats`
  - `/v1/agents/:agentId/stats/events`
  - `/v1/agents/:agentId/stats/state-timeline`
  - `/v1/agents/:agentId/stats/preview-allocation`
  - `/v1/agents/:agentId/stats/allocate`

### Boundaries & dependency rules
- 前端只依赖 `frontend-flags` / `frontend-capabilities`，不直接读取 `import.meta.env`。
- `TabIntro` 只负责按 capability 控制入口和内容，不承担 backend fallback 逻辑。
- 后端 `config.launch.capabilities` 必须是 env-driven，而不是 Stats 特例硬编码。

## Data migration (if applicable)
- Migration steps: 无。
- Backward compatibility strategy: 保持 flags off 时完全隐藏 Stats UI，flags on 时恢复既有链路。
- Rollout plan: 先修 wiring，再用定向测试验证 on/off 两种状态。

## Non-functional considerations
- Security/auth/permissions: Stats API 仍保持 requireHumanAuth + owner-only 校验。
- Performance: 无新增重查询，只恢复现有门控。
- Observability (logs/metrics/traces): 无新增 telemetry；依赖现有 runtime feature/debug 面。

## Open questions
- 是否在后续把本地 dev 默认值切到 on；本任务先恢复 capability wiring，不改 env contract 默认值。

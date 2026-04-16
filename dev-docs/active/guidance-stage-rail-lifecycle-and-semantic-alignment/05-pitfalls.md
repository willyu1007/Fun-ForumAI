# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要把右 rail 再做成教程页、步骤条或双入口模式选择器。
- 不要重新把用户分成“看戏用户 / 养成用户”作为首页主叙事。
- 不要为新 rail 私造第二套 Guidance state / item / receipt 生命周期。
- 不要让 retained 用户继续常驻看到 Day 0 式解释文案。
- 不要为了强调 Guidance 而侵占首页主视觉层级。

## Pitfall log (append-only)

### 2026-04-16 - Bundle initialization
- Symptom: N/A
- Context: Task bundle created.
- What we tried: N/A
- Why it failed (or current hypothesis): N/A
- Fix / workaround (if any): N/A
- Prevention (how to avoid repeating it): N/A
- References (paths/commands/log keywords): N/A

### 2026-04-16 - Cleanup ordering must not invert
- Symptom: Planning review found that schema/type cleanup could easily be started before runtime de-dependency was complete.
- Context: `current_track` / `explained_two_tracks` still exist in Prisma, repo mappings, runtime code paths, and tests.
- What we tried: Added explicit implementation slices and hard gates between S4 and S5.
- Why it failed (or current hypothesis): Without a hard gate, “remove fields quickly” looks attractive but would break runtime and blur whether failures come from semantic reset or mechanical cleanup.
- Fix / workaround (if any): Treat S4 as the mandatory dead-data gate before any Prisma/schema/type deletion in S5.
- Prevention (how to avoid repeating it): Never drop `GuidanceTrack`-related schema or API fields until `rg` confirms no runtime decision branch still depends on them.
- References (paths/commands/log keywords): `prisma/schema.prisma`, `src/backend/guidance/guidance-state-service.ts`, `src/backend/guidance/guidance-orchestrator.ts`, `rg -n "current_track|explained_two_tracks|GuidanceTrack" src prisma docs/context/db`

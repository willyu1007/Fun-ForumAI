# 01 Plan — xp-deleveling-and-growth-points

## Frozen decisions
- `50 XP = 1 growth point`
- points wallet merges into Stats
- old growth APIs removed in Phase 1
- relation capacity fixed to `180`
- historical XP total preserved
- legacy level/milestone events archived out of main XP ledger

## Phase 1 — Governance + schema migration
- Deliverables:
  - 新任务注册到 project governance
  - `agent_growth -> agent_xp`
  - `growth_events -> legacy archive + xp_events`
  - stats 增加 `granted_points_total`
- Affected subsystems:
  - Prisma schema
  - migrations
  - governance registry / task docs
- Acceptance checks:
  - migration 可生成并通过 schema 校验
  - registry sync / lint 通过
- Rollback note:
  - 保留 legacy archive，回滚时可恢复旧读路径

## Phase 2 — Backend XP service and stats sync refactor
- Deliverables:
  - `XpService` 替代旧 `GrowthEngine`
  - XP earning 统一写入 `xp_events`
  - Stats 按 XP 公式持续同步点数
  - `vote_received` 接入 XP 发放
- Affected subsystems:
  - backend services / routes / repos
  - stats sync path
- Acceptance checks:
  - XP award paths 全部通过
  - 重复读取不会 double-grant
- Rollback note:
  - 回切旧 service 前需确认 schema backward path

## Phase 3 — Trait / instruction / prompt / relation deleveling
- Deliverables:
  - trait 去 `minLevel` / 去 slot
  - instruction 去 level gate / 去 slot
  - prompt override 去 Lv.4 校验
  - relation capacity 固定为 `180`
  - `layer1_growth -> layer1_traits`
- Affected subsystems:
  - trait/instruction/relation/prompt runtime
- Acceptance checks:
  - 不再存在 `LEVEL_TOO_LOW` / `trigger_requires_level_*`
  - runtime prompt 组装测试更新通过
- Rollback note:
  - 若出现行为异常，可暂时只回滚 relation cap 固定值

## Phase 4 — Web / mobile / API cleanup
- Deliverables:
  - 删除 `/growth` 家族接口
  - 新增 `/xp` 与 `/xp-events`
  - dashboard `growth` 改 `xp`
  - Web / Mobile 移除 `Lv.`、slot、旧进度条与 lock UI
- Affected subsystems:
  - backend API
  - frontend web
  - mobile app
- Acceptance checks:
  - 旧接口下线
  - 新 XP 界面稳定显示
- Rollback note:
  - 若客户端未同步，可临时补兼容 adapter，但不恢复 level 语义

## Phase 5 — Verification + handoff
- Deliverables:
  - typecheck / tests / targeted smoke
  - dev-docs 更新齐全
  - handoff notes / remaining risks
- Affected subsystems:
  - verification docs
  - governance sync
- Acceptance checks:
  - 关键回归全绿
  - task bundle 可支持跨 session 接手
- Rollback note:
  - 若未完成闭环，不归档，保持 in-progress

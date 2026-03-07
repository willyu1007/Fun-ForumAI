# Roadmap — XP Deleveling and Growth Points

## Goal
收敛仓库中的成长语义：保留 XP 作为无上限经历账本，统一用稳定公式产出成长点并并入 Stats，彻底去除 level 化门槛与过期 growth 命名。

## Scope
- schema / migration
- backend XP service and stats sync
- trait / instruction / prompt / relation deleveling
- web / mobile / API cleanup
- governance / verification / handoff

## Milestones
1. Governance and task registration
2. XP schema + archive strategy
3. Backend XP / Stats refactor
4. Product surface cleanup (API + Web + Mobile)
5. Verification and handoff

## Key risks
- migration drift across XP / Stats / archive tables
- historical fairness for pre-existing agents
- stale client types or hidden runtime references to level fields
- residual naming drift (`growth` vs `xp` vs `traits`)

## Rollback
- Preserve legacy archive and migration provenance.
- Prefer read-path rollback over destructive data rollback.
- If client/API migration is partial, stop at the boundary rather than restoring level semantics.

## Verification
- governance sync + lint
- prisma schema / migration checks
- backend tests for XP earning and stats sync
- UI smoke for web/mobile growth views
- regression checks for achievements / chronicle / stage tier

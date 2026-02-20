# 01 Plan

## Phases
1. Discovery and boundary confirmation
2. Implementation by roadmap phases
3. Verification and handoff update

## Detailed steps
- 阅读并确认 dev-docs/active/runnable-core-baseline/roadmap.md 的范围与依赖。
- 按 Lane A/Lane B 先后顺序推进，并为 Lane C 预留可复用 API 合同与鉴权边界。
- 按 roadmap 逐阶段执行与记录。
- 每阶段后更新 dev-docs/active/runnable-core-baseline/03-implementation-notes.md 与 dev-docs/active/runnable-core-baseline/04-verification.md。

## Risks & mitigations
- Risk:
  - 跨 cluster 边界漂移导致重复实现。
  - Mitigation:
    - 严格按本子任务 roadmap 范围推进，并在变更记录中标注接口边界。

# 02 Architecture

## Coordination boundaries

- `T-946` 只负责 program-level coordination、owner mapping、gate 管理、风险裁决和 closeout 证据归档。
- `T-946` 同时拥有：
  - cross-pack integrated acceptance suite
  - migration / compat exit timeline
  - anti-drift review checklist and terminology guardrails
- `T-941` 负责 lifecycle/projection 共享真相：
  - lifecycle snapshot
  - route handoff
  - writeability contract
  - projection version guardrails
- `T-942` 负责 discussion forest UX residual：
  - de-thread-card grouping
  - late-entry visual insertion
  - projection-field UX consumption
  - human anchor-reply affordance
- `T-945` 只负责 forum runtime 的语义真相：
  - event target
  - perceived focus
  - final write anchor
- `T-943` 只负责 canonical viewer write plane 与 accepted-write fanout 主链。
- `T-947` 只负责导演层质量：
  - local-structure-aware broker
  - scoped recall
  - recall telemetry
- `T-948` 只负责论坛/搜索/运行时的内部读路径瘦身，不改 public API version。
- `T-915` 只消费 `T-948` 的 lean surfaces，补 search-side reconcile/health/regression。
- `T-949` 只负责活文档、context 入口与叙事世界观对齐。

## Dependency rules

- `T-945` 和 `T-943` 完成前，`T-947` 不得锁定最终 recall/broker implementation，因为 actor focus 与 write-plane side effects 仍可能变化。
- `T-941` 完成 lifecycle/writeability/route contract 收口前，`T-943` / `T-945` / `T-942` 不得各自发明第二套 thread-state 解释。
- `T-948` 不得重写 Phase 1 已冻结的 anchor/write semantics；若需要新的内部派生值，只能从现有 canonical 字段推导。
- `T-915` 不得自行发明第二套 search bundle 或 thread summary DTO；必须消费 `T-948` 提供的内部 lean read surfaces。
- `T-949` 不得把 archive/historical docs 当作整改目标；只改主入口和当前活文档。

## Gate definitions

### Gate 1

- selected/perceived/write anchor 三分语义已稳定。
- viewer accepted write 与 agent write 的基础 fanout 面一致。
- lifecycle snapshot / route handoff / writeability semantics across read/runtime/write are consistent.

### Gate 2

- recall 抑制不再跨 thread 泄漏。
- broker/recall telemetry semantics are stable enough for later dashboarding.
- discussion forest no longer reads as a thread-card list.
- late-entry and human anchor-reply UX both reflect “follow this point” instead of generic posting.

### Gate 3

- thread summary/detail、runtime/orchestration/search refresh 已默认走 bounded-window / projection-first 路径。
- search hit hydration 不再逐条回读完整 thread。
- 顶层 overview/PRD/context 入口全部切到当前真实世界观。

### Gate 4

- forest / lifecycle / search / contract integrated acceptance suite exists and is rerunnable.
- compat route / migration / deprecation timeline is explicit.
- anti-drift review checklist and terminology guardrails are landed for future work.

## Phase Review Packet Rules

| Phase | Active packs | Required review packet before gate | Unlocks |
|---|---|---|---|
| Phase 1 | `T-941`, `T-945`, `T-943` | lifecycle/writeability/route note; resolved-anchor triad note; unified fanout matrix | `T-947`, `T-942` can safely consume frozen semantics |
| Phase 2 | `T-947`, `T-942` | broker/recall policy matrix; telemetry dictionary; branch-cluster/late-entry UX rules | `T-948`, `T-915`, `T-949` can optimize around stable behavior |
| Phase 3 | `T-948`, `T-915`, `T-949` | lean bundle inventory; search adoption report; wording freeze note | `T-946` can assemble final acceptance, deprecation, anti-drift governance |
| Phase 4 | `T-946` | integrated acceptance index; compat timeline; anti-drift checklist | program closeout |

## No-Go Conditions

- 若 `T-941` 未冻结 lifecycle/writeability/route contract，则 `T-943` / `T-945` / `T-942` 不得各自定义 thread-state 解释。
- 若 `T-945` 的 anchor triad 仍不稳定，则 `T-947` 不得锁定 branch/source policy。
- 若 `T-943` 尚未证明 accepted-write fanout parity，则任何 UX 或 docs 包都不得把 viewer public write 描述为“与 agent 同链路”。
- 若 `T-948` 的 lean bundle inventory 未冻结，则 `T-915` 不得自己拼接 internal read surface。
- 若 `T-949` 的 wording freeze 未完成，则 `T-946` 不得关闭术语守卫。

## Required handoff outputs

- `T-945`: resolved-anchor contract note + branch-revive verification
- `T-943`: unified write-plane/fanout matrix + compat route note
- `T-941`: lifecycle/writeability/route contract note
- `T-947`: broker/recall policy matrix + telemetry note
- `T-942`: branch-cluster / late-entry UX rule note + manual UX evidence
- `T-948`: lean bundle inventory + call-site migration list
- `T-915`: search consumer adoption report + reconcile/runtime health evidence
- `T-949`: document inventory + wording freeze note
- `T-946`: integrated acceptance suite + compat timeline + anti-drift checklist

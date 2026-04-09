# 01 Plan

## Phases

1. Phase A: inventory active entry docs and stale claims. `[pending]`
2. Phase B: freeze canonical wording and terminology. `[pending]`
3. Phase C: update active entry docs and context references. `[pending]`
4. Phase D: run grep/context verification and record closeout evidence. `[pending]`

## Entry Contract

- 开工前必须接受：
  - `T-943` 和 `T-945` 的 Phase 1 语义已经冻结
  - `docs/context/registry.json` 中的现有 context artifacts 是 live truth
- 若产品行为仍在变化，本包只允许先冻结 wording candidate，不得提前把未落地能力写进入口文档。

## Detailed Steps

- Build a doc inventory covering:
  - repo root entry docs
  - `docs/project/overview/*`
  - relevant live context/onboarding entry docs
- Mark each stale claim as one of:
  - remove
  - rewrite as current truth
  - keep only as historical-phase note
- Freeze wording for:
  - thread-first public stage
  - dual-lane public participation
  - discussion forest and local perception
  - unified governance boundary between public stage and private/control inputs
- Explicitly record that `docs/context/api/openapi.yaml`、`api-index.json`、`glossary.json` already exist and are the live artifact set, so the task fixes entry-doc drift instead of recreating contract infrastructure.
- Prepare wording/term guard inputs for `T-946` anti-drift checklist so future reviews can catch “LLM-only public participation” regressions early.
- Verify using grep plus context tooling that active docs no longer carry outdated claims.

## Handoff Review Before Program Closeout

- 在 `T-946` 固化 anti-drift checklist 前，必须 review：
  - active entry-doc inventory 是否完整
  - wording freeze 是否已区分当前真实行为、历史阶段和 archive
  - context artifact references 是否都指向现有 live files
- review 输出必须落到：
  - `03-implementation-notes.md`：edited-doc inventory + wording freeze note
  - `04-verification.md`：grep/context verification evidence

## Stop / Escalation Conditions

- 若任何入口文档需要靠“计划中会做”才能自洽，本包不得 closeout。
- 若 archive/historical docs 与 active docs 边界不清，本包不得把 grep 审计视为通过。

## Exit Criteria

- `00-overview.md` acceptance criteria are satisfied.
- Every edited active entry doc is listed in `03-implementation-notes.md`.
- Verification includes a grep/audit record that distinguishes active docs from archive docs.

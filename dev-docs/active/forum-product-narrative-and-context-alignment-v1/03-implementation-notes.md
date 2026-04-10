# 03 Implementation Notes

## 2026-04-09

- Created `T-949` to isolate narrative/context alignment from product-code tasks.
- No document edits have landed yet.
- This package starts after Phase 1 semantics are frozen so wording can reflect final canonical behavior.

## 2026-04-10

### Active Entry-Doc Inventory

- Root entry docs:
  - `README.md`
  - `AGENTS.md`
- Active project overview docs:
  - `docs/project/overview/START-HERE.md`
  - `docs/project/overview/LLM_forum_PRD.md`
  - `docs/project/overview/requirements.md`
  - `docs/project/overview/non-functional-requirements.md`
  - `docs/project/overview/domain-glossary.md`
  - `docs/project/overview/LLM_forum_DevSpec.md`
  - `docs/project/overview/project-blueprint.json`
- Live context entry docs inspected, not rewritten:
  - `docs/context/AGENTS.md`
  - `docs/context/INDEX.md`
  - `docs/context/registry.json`
- Archive / historical docs were intentionally left out of the edit set.

### Wording Freeze

- Current product description:
  - agent 主舞台 + 受治理的人类公开参与 + 可审计 runtime + forest-first 阅读体验。
- Human public participation:
  - human users are not public-stage observers only.
  - public human writes must enter through canonical `/viewer/*` contracts or audience-lane contracts.
  - accepted human writes carry auditable provenance and remain under lifecycle/writeability governance.
- Agent runtime boundary:
  - agents remain the main public-stage performers.
  - humans must not realtime-remote-control agent speech or bypass governance by writing through agent runtime paths.
- Viewing model:
  - discussion forest / branch cluster is the primary reading mental model.
  - thread remains an implementation container, not the dominant product narrative.
- Frozen Phase 1 semantics remain unchanged:
  - `ThreadLifecycleSnapshot.writeability` is the writeability truth.
  - `forum_targeting` is the runtime write-target truth.
  - `/viewer/*` is the canonical viewer-facing public write contract.

### Edited Doc Summary

- `README.md`
  - root one-line description now matches agent-led forum + governed public participation + auditable runtime + forest-first reading.
- `AGENTS.md`
  - repo instruction header now matches the same current product description.
- `docs/project/overview/START-HERE.md`
  - updated current conclusion, primary users, core flows, must-have capabilities, and out-of-scope boundaries.
- `docs/project/overview/LLM_forum_PRD.md`
  - replaced stale LLM-only public participation framing with viewer write plane, audience lane, discussion forest, and runtime-boundary wording.
- `docs/project/overview/requirements.md`
  - updated scope, users, goals, MUST/SHOULD requirements, and agent/data-plane constraints to reflect governed human participation.
- `docs/project/overview/non-functional-requirements.md`
  - updated security/privacy and authorization boundaries across agent runtime write plane, viewer write plane, audience lane, and control plane.
- `docs/project/overview/domain-glossary.md`
  - updated Agent / Observer / Control Plane / Data Plane terms and added Participant, Viewer Public Write Plane, Audience Lane, and Discussion Forest.
- `docs/project/overview/LLM_forum_DevSpec.md`
  - updated invariants, threat model, architecture notes, API domains, viewer write/audience API section, and test expectations.
- `docs/project/overview/project-blueprint.json`
  - updated project description while leaving the existing project slug/name stable.

### Context Artifact Disposition

- Existing live context artifacts remain the contract set:
  - `docs/context/api/openapi.yaml`
  - `docs/context/api/api-index.json`
  - `docs/context/glossary.json`
- This package did not recreate or redesign context infrastructure.
- `docs/context/AGENTS.md`, `docs/context/INDEX.md`, and `docs/context/registry.json` already point to the live context artifacts and were left unchanged.

### Anti-Drift Term Guard Inputs For `T-946`

- Flag as stale-current wording if active docs claim:
  - "Only-LLM-participates" as the current product truth.
  - humans can only observe / only read / cannot write in public areas.
  - public discussion has a single writer class and that class is only agent runtime.
  - `docs/context` lacks `openapi.yaml`, `api-index.json`, or `glossary.json`.
- Allow wording that remains true:
  - humans cannot realtime-remote-control agent speech.
  - humans cannot bypass governance or write through agent runtime paths.
  - agents remain the main public-stage performers.

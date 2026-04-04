# 01 Plan — forum-semantic-convergence-governance-program (T-142)

## Phases

1. Bootstrap the program: create `M-030 / F-100 / R-101~R-105 / T-142~T-146`, write dev-docs bundles, sync governance.
2. Run requirement coverage audit against `/Users/phoenix/Downloads/forum_semantic_convergence_plan.md` and append missing scope to child bundles.
3. Freeze the naming constitution:
   - community axes
   - three-part interaction contract
   - five status axes
   - high-frequency word prefix rules
   - compat policy
4. Orchestrate child execution:
   - `T-143` first
   - `T-144` and `T-145` after `T-143`
   - `T-146` after `T-144` and `T-145`
5. Review each pack before the next dependency starts:
   - review `T-143` before `T-144/T-145`
   - review `T-144` before `T-146`
   - review `T-145` before `T-146`
   - review `T-146` before program closeout
6. Close the loop: roll child-pack verification into program acceptance and authorize compat cleanup completion.

## Program Gates

- Gate A: `T-143` must define canonical taxonomy, shared contract shapes, three-axis interaction semantics, five status axes, and alias-ingress policy before any governance or DTO cutover begins.
- Gate B: `T-144` and `T-145` must converge on the same shared semantics before `T-146` expands search/analytics fields.
- Gate C: `T-144` must fully absorb `A|B|C` and legacy participation booleans into the named interaction contract before `T-146` can backfill related fields.
- Gate D: `T-146` cannot remove compat paths until `T-144` and `T-145` APIs and UI contracts are stable and the `T-927` boundary is documented.

## Deliverables

- Program governance bundle with roadmap, architecture, implementation notes, verification, and pitfalls
- Child bundles `T-143` to `T-146`, each with clear scope, boundary, and acceptance criteria
- Requirement-to-pack ownership matrix and program-level acceptance checklist
- Pack-by-pack review workflow with handoff artifacts and closeout gates
- Project hub mapping and synced derived views

## Pack Review Workflow

1. The active pack MUST finish its own contract draft, dependency notes, and acceptance deltas before downstream work begins.
2. The program review for that pack MUST confirm:
   - required inputs were frozen
   - outputs are explicit and consumable
   - unresolved naming or boundary questions are closed
   - downstream consumers have a clear handoff artifact
3. Any unresolved item that would force the next pack to reinterpret semantics MUST be closed in the current pack, not pushed downstream.
4. The next pack may start only after its upstream review checklist is satisfied and recorded in the relevant task bundle.

## Final Program Review

- After `T-146` completes its own review, `T-142` performs an overall pass across all five packs.
- The overall pass MUST confirm:
  - execution order remains valid
  - shared contracts are consistent across packs
  - review gates were satisfied in order
  - compat removal is still gated on stable downstream consumers
  - no major requirement-doc clause is left without an owner or verification path

## Exit Criteria

- `T-143` to `T-146` have stable ownership boundaries and accepted dependency sequencing.
- The program bundle documents every major requirement-doc gap and its owning child pack.
- Every child pack has a completed review/handoff checklist that can be used as the start condition for the next pack.
- Project hub and dev-docs remain aligned without lint drift.
- The remaining work can proceed as execution tasks, not as another planning exercise.

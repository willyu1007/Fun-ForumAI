# 03 Implementation Notes

## 2026-04-09

- Created the program bundle `T-946 forum-orchestration-experience-closeout-program-v1`.
- Froze the delivery model as:
  - one coordination program
  - three new child packs
  - three reused active packs with rewritten ownership boundaries
- Locked two-phase sequencing:
  - Phase 1 closes behavior truth and unified write-plane effects
  - Phase 2 closes hot-path slimming and narrative/context alignment
- No product-code changes are owned by `T-946`; this bundle is governance-only.

## 2026-04-10

- Adjudication added for `T-943`:
  - issue: `allocator/event-bridge author_agent_id mandatory assumption blocks viewer-write runtime parity`
  - classification: `cross-pack integration issue`
  - owner pack: `T-943 forum-participation-contract-and-viewer-write-plane-v1`
  - disposition:
    - do not reopen `T-941` lifecycle / route contract
    - do not defer to `T-947` broker/recall policy work
    - patch runtime bridge + allocator input contract in `T-943` so human-authored `THREAD_OPENED` / `THREAD_TURN_ADDED` can enter the frozen runtime path without spoofing `author_agent_id`
  - compatibility note:
    - agent-authored events keep existing `author_agent_id` semantics
    - human-authored events must carry explicit provenance (`author_actor_type`, `author_user_id`) and allow downstream no-op behavior where agent-only signals do not apply.
- Adjudication added for deploy-window UX drift found during `T-943` live validation:
  - issue: `stale dynamic-import chunk failure leaves old tabs on React Router default crash screen after rollout`
  - classification: `cross-pack integration issue`
  - owner pack: `T-946 forum-orchestration-experience-closeout-program-v1`
  - disposition:
    - do not treat as `T-943` write-plane semantic failure
    - patch frontend route error boundary + guarded one-shot reload so future deploy windows recover without exposing raw chunk URLs to end users
    - add live deploy-window navigation smoke to Gate 4 acceptance checklist
  - compatibility note:
    - fix only guarantees recovery for tabs already carrying the patched root bundle
    - long-term deploy policy should still avoid deleting current + immediately-previous chunk assets too aggressively.

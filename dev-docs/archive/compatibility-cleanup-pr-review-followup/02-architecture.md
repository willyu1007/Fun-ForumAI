# 02 Architecture — compatibility-cleanup-pr-review-followup

## Boundaries
- Scope is limited to the surfaces directly touched by PR review:
  - env contract and generated env artifacts
  - app bootstrap scheduler startup
  - scheduled post runtime selection
  - chatroom scene contract resolution and related control/runtime flows

## Key decisions
- Dead runtime flags should be removed from env/docs rather than reintroduced in code.
- Launch-catalog-dependent background jobs should only start when the required artifact exists.
- Scheduled posting remains scene-aware when possible, but runtime must still be able to create posts without launch-catalog artifacts.
- Chatroom runtime should prefer room-specific bindings, then degrade to a canonical template-based room-program contract for rooms created dynamically at runtime.

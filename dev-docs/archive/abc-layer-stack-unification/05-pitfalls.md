# 05 Pitfalls — abc-layer-stack-unification (T-034)

## Do-not-repeat
- Symptom: `POST /v1/dev/prompts/render` expected `400/404`, but tests observed `401`.
- Root cause: `notificationRouter` was mounted at `/v1` with router-level `use(requireHumanAuth)`, unintentionally intercepting unrelated later routes.
- What was tried: verified route registration and app env path first; reproduced with targeted route test to confirm preemption before dev handler.
- Fix: changed notification auth from router-global middleware to per-endpoint middleware (`/me/notifications*` only).
- Prevention: avoid global auth middleware on broad mount roots; keep auth guards path-scoped when router is mounted at a shared prefix.

- Symptom: TypeScript showed `never` narrowing errors in tests for captured async callback context.
- Root cause: control-flow treated a locally initialized variable as effectively constant in synchronous branch analysis.
- Fix: used mutable capture object (`{ ctx?: InstructionContext }`) with explicit non-null assertion at assertion site.
- Prevention: in async callback capture tests, prefer mutable holder objects over local primitive/null sentinels to avoid false `never` narrowing.

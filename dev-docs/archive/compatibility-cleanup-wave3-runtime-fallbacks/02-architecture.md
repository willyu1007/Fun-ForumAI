# 02 Architecture — compatibility-cleanup-wave3-runtime-fallbacks

## Boundaries
- Prompt composition: `PromptOrchestrator` becomes the sole runtime composition path when present.
- Private boundary: private/proactive scenes always suppress `layer_showrunner` and render against the boundary-safe prompt contract.
- Public scene runtime: scheduled posts and forum continuity always use public scene catalog/selector outputs when the services are wired.

## Risk notes
- Removing silent fallbacks turns previously masked orchestration failures into visible failures; tests must pin the intended failure/skip behavior.
- Scheduled-post fallback removal changes runtime behavior from “post anyway with legacy prompt” to “skip/abort when no scene can be selected”.
- Removing dead rollout flags requires updating every live env propagation surface together (`config.ts`, env contract artifacts, local-kind overlay, and staging helper assertions) or local tooling will drift from the runtime feature payload.

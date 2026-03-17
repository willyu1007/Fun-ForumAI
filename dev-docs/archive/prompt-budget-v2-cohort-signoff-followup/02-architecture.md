# 02 Architecture

## Scope boundary
- `T-905` consumes the runtime that `T-114~T-116` already built.
- The primary artifacts are evidence, comparisons, and sign-off decisions.
- Any code changes discovered here must be treated as new defects against the closed V2 baseline, not as silent continuation of the original implementation packages.

## Evidence contract
- For each sampled case, collect:
  - scene
  - cohort label
  - request envelope
  - local layer envelope
  - bucket tokens / survival
  - overflow reason / warnings
  - rendered output excerpt
  - reviewer note
- Prefer storing evidence under this task bundle rather than scattering temporary logs across the repo root.
- This sign-off pass used a temporary evidence runner that stayed on the real visible-path contract:
  - `PromptOrchestrator` composes the prompt blocks and audit
  - `PromptEngine` renders the real template versions from registry
  - `LLMGateway` performs real routing / capability / cost accounting
  - only the final upstream LLM text call was swapped for a deterministic synthetic responder
- The temporary generated artifacts were cleaned during archive preparation after the sign-off verdict was recorded into this task bundle.

## Closure rule
- `T-114` closes as the public-scene contract package.
- `T-115` closes as the memory-authority package.
- `T-116` closes as the sensitive-scene cutover package.
- `T-905` becomes the only open owner for remaining cohort / sign-off evidence.
- Once six-scene / three-cohort evidence says “no new structural follow-up”, `T-905` can flip to `done` without reopening the implementation packages.

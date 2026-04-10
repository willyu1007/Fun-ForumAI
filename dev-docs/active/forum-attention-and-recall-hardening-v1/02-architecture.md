# 02 Architecture

## Ownership boundary

- Inputs:
  - `T-941` frozen shared orchestration contracts
  - `T-945` frozen anchor semantics
  - `T-943` frozen viewer write-plane side-effect truth where relevant to telemetry
- Outputs:
  - broker selection logic that respects local structure
  - thread-scoped recall windows
  - executable recall decay
  - explainable telemetry for attention/recall decisions

## Frozen rules

- Do not introduce new public contract fields when an internal policy or telemetry shape is sufficient.
- Do not let broker/read-model concerns leak into `T-948`; `T-947` can consume forest/projection inputs, but it does not own projection slimming.
- Do not treat participant-count heuristics as the only signal for duel risk or entropy once branch/local cues are available.

## Review gate

- The final broker must be able to explain why it chose:
  - this thread
  - this branch
  - this source
- The final recall policy must be able to explain why it suppressed or allowed:
  - within this thread
  - for this agent pair
  - under this decay/quota policy

## Handoff Outputs

- broker decision matrix for old-branch revive / late entry / audience push
- thread-scoped recall window policy
- executable decay / quota policy note
- telemetry dictionary for spontaneity / branch entropy / duel risk

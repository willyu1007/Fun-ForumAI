# 05 Pitfalls — T-995

## Do-Not-Repeat Summary
- Do not resume historical v3 Step 3 runs for v4 generation, even if `current-run.yaml` still points at them before startup correction.
- Do not treat Step 5 export completion as remote import or warmup completion.
- Do not let prompt-only visual briefs close a live checkpoint; v4 live media slots require final assets.
- Do not preserve raw model drafts as canonical evidence in this task; only final approved artifacts should drive audit.
- Do not change Step 2 slot structure during Step 3 unless the run is explicitly routed back to Step 2.

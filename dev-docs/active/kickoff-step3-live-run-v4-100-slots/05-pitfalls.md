# 05 Pitfalls — T-995

## Do-Not-Repeat Summary
- Do not resume historical v3 Step 3 runs for v4 generation, even if `current-run.yaml` still points at them before startup correction.
- Do not treat Step 5 export completion as remote import or warmup completion.
- Do not let prompt-only visual briefs close a live checkpoint; v4 live media slots require final assets.
- Do not preserve raw model drafts as canonical evidence in this task; only final approved artifacts should drive audit.
- Do not change Step 2 slot structure during Step 3 unless the run is explicitly routed back to Step 2.
- After wave-06, avoid repeating street-text observation, personal style moodboard, fictional badge sheet, gift ritual table, queue-flow notebook map, or locked-room floorplan as default media shortcuts.
- In wave-07, keep `emotion-jury-07` and `values-stage-08` text-only; do not invent visual bindings for those slots.
- Do not carry wave-07's possible partial real-information image waiver forward; later visuals must actively avoid readable real addresses, venue names, labels, platform UI, product UI, or private chat surfaces.
- In wave-08, keep `hot-arena-08` and `fail-postmortem-08` text-only; do not invent visual bindings for those slots.
- Wave-09 and wave-10 Director files are pre-generated future drafts only; do not treat either wave as active until the previous wave's package refresh has been approved.
- Wave-10 `public_debate=4` is a final remaining-seed distribution exception, not a reusable wave-planning cap. Keep three of the four public-debate slots text-only or process-led and do not turn the final wave into a verdict stack.

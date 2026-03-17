# 01 Plan

## Phases
1. [x] Freeze cohort definition and scene matrix.
2. [x] Build or script reproducible sampling for six scenes.
3. [x] Capture evidence across low / medium / high-memory agents.
4. [x] Review outcomes, decide whether attenuation/tuning follow-up is needed, and close the task.

## Detailed steps
- [x] Define low / medium / high-memory cohorts using repo-visible memory richness signals instead of subjective labels.
- [x] Reuse the current `PromptOrchestrator` / `LLMGateway` path to collect audit + output evidence; do not create a side-channel prompt composer.
- [x] Prefer deterministic synthetic checks when live variability would blur diagnosis; record the synthetic boundary explicitly.
- [x] Summarize scene-by-scene findings with explicit verdicts: healthy / tuning-needed / defect.

## Risks
- Live LLM output variance can make “scene fidelity” judgments noisy.
  - Mitigation: pair live samples with audit metrics and require repeated evidence before declaring a defect.
- Memory-rich cohorts may be hard to reproduce in local/in-memory data.
  - Mitigation: allow seeded fixtures or scripted synthetic agents, but record the synthetic boundary clearly.

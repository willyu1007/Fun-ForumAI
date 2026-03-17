# 01 Plan

## Phases
1. Freeze cohort definition and scene matrix.
2. Build or script reproducible sampling for six scenes.
3. Capture evidence across low / medium / high-memory agents.
4. Review outcomes, decide whether attenuation/tuning follow-up is needed, and close the task.

## Detailed steps
- Define low / medium / high-memory cohorts using repo-visible memory richness signals instead of subjective labels.
- Reuse the current `PromptOrchestrator` / `LLMGateway` path to collect audit + output evidence; do not create a side-channel prompt composer.
- Prefer Qwen-Flash live calls for consistency, but keep deterministic synthetic checks where live variability would blur diagnosis.
- Summarize scene-by-scene findings with explicit verdicts: healthy / tuning-needed / defect.

## Risks
- Live LLM output variance can make “scene fidelity” judgments noisy.
  - Mitigation: pair live samples with audit metrics and require repeated evidence before declaring a defect.
- Memory-rich cohorts may be hard to reproduce in local/in-memory data.
  - Mitigation: allow seeded fixtures or scripted synthetic agents, but record the synthetic boundary clearly.

# 05 Pitfalls — warmup-closure-verifier-and-diagnostics-v1

## Do-Not-Repeat Summary

- Do not let verifier probes inherit warm-up batch lineage, or the verifier will pollute suite readiness and richness counts.
- Do not require the probe post itself to appear on `home` or `highlights`; those are baseline-health surfaces, not probe-identity surfaces.
- Do not collapse all failures into baseline admission blockers; the verifier must preserve stage-specific evidence.

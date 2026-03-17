# 05 Pitfalls

- Do not keep “experience sign-off pending” inside implementation packages after the code path is already stable; that leaves package state permanently ambiguous.
- Do not treat a single live sample as enough evidence for cohort verdicts across six scenes.
- Do not treat raw `bucket_survival_ratio` absolute percentages as a defect signal by themselves; the repo intentionally allows concise control/context blocks, so the real question is whether hard control, compact control, and current context stay present and uncorrupted under richer cohorts.

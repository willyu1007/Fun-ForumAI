# 05 Pitfalls (do not repeat) — T-206

## do-not-repeat summary
- Do not assume `executionPolicyId` changes the selected model profile.
- Do not mutate shared `qwen-director-v1` profiles for a biography-only experiment.
- Do not reuse the overloaded `agent-bio` policy name for a biography-exclusive rollout.
- Do not combine prompt rewrites and routing rewrites in the first measurement slice.

## Pitfall 1
- Symptom: biography changes appear to work locally, but another digest chain silently inherits the same model ordering.
- Prevention note: isolate at the routing key level, not only at the policy-default level.

## Pitfall 2
- Symptom: the team cannot tell whether improved output came from the model or the prompt.
- Prevention note: first rollout changes routing/model selection only; prompt changes must be versioned separately later.

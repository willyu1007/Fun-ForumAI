# 05 Pitfalls (do not repeat) — T-205

## do-not-repeat summary
- Do not bypass the repo’s existing gateway and prompt-governance system.
- Do not let the writer decide chapter boundaries or source facts.
- Do not publish text that fails factual or privacy audit.

## Pitfall 1
- Symptom: the writer prompt starts consuming old chapter prose as factual memory.
- Prevention note: only skeleton, digest, chapter digest, memory, and tone profile are allowed as writer inputs.

## Pitfall 2
- Symptom: unsupported names, events, or relationship claims appear in visible chapter text.
- Prevention note: audit must block claims that cannot be grounded in the current skeleton or digest.

## Pitfall 3
- Symptom: private-owner material becomes directly readable in public-facing biography text.
- Prevention note: keep the private-material policy conservative and enforce it as a publish gate, not just a prompt hint.

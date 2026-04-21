# 05 Pitfalls (do not repeat) — T-204

## do-not-repeat summary
- Do not let transitional story-meta keys become persistent chapter identity.
- Do not couple planner work to page-open latency.
- Do not overwrite closed chapters without revision/later-note history.

## Pitfall 1
- Symptom: month and source dimension still decide chapter boundaries.
- Prevention note: chapter planning must be driven by stage change in the agent’s growth line, not reporting windows.

## Pitfall 2
- Symptom: every event triggers synchronous replanning or body generation.
- Prevention note: event handlers only mark dirty; scheduled orchestration owns compile work.

## Pitfall 3
- Symptom: later material silently rewrites old chapters.
- Prevention note: preserve chapter revisions and use later notes for reinterpretation instead of invisible replacement.

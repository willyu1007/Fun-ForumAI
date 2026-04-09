# 05 Pitfalls

## Do Not Repeat

- Do not keep runtime-only closeout work inside forum-semantic task bundles; that hides LLM acceptance evidence inside unrelated scope.
- Do not rely on runtime build fingerprints unless the basis includes the actual execution layer and the live registries that affect routing, credential selection, pricing, and prompt resolution.
- Do not leave internal request fields like `stop` hanging off provider wrappers after the gateway contract has already removed the corresponding control surface.
- Do not treat stale media-binding races as fatal semantic-refresh failures. Background refresh can legitimately discover that a binding disappeared after enumeration; that case should be observable and skipped, not promoted into generic error noise.

## Historical Notes

- 2026-04-10: the first local kind rollout failed because `src/backend/container/llm.ts` still depended on `config` outside the LLM client wiring path. Removing config-backed execution defaults requires a whole-file dependency scan, not just local constructor edits.

# Change Intent

- Add `FF_GUIDANCE_V1` as the backend master switch for guidance routes, ingestion, SSE delivery, and fan-out hooks.
- Add `VITE_FF_GUIDANCE_V1` as the frontend master switch for guidance queries and UI surfaces.
- Keep both defaults at `false` so T-078 can support gradual rollout and safe rollback without rewriting the runtime contract.

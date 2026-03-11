# T-071 Env Contract Change Intent

- Add missing persona runtime env keys that are already consumed by `src/backend/lib/config.ts`.
- Align env SSOT with local-kind/base k8s config so runtime flags are not silently absent in deployed environments.
- Keep changes backward compatible by using optional keys with explicit defaults.

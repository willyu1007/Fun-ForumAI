# 02 Architecture

## Review scope
- Backend bootstrap and background service start ordering
- Runtime gating and scheduler enablement semantics
- Human auth transport contract across REST and SSE
- SSE event naming contracts for vote updates
- Secret/config validation behavior at startup

## Expected boundaries
- App/container construction should be distinct from warm-up and background-service start.
- Auth transport should have one clear primary path for the web client.
- SSE event names consumed by the frontend must match the server broadcast contract.
- Production security-sensitive configuration must fail fast when required secrets are missing.

## Verification lens
- Treat import-time side effects, environment fallback secrets, and mismatched event names as high-signal defects.
- Treat naming drift and legacy comments as defects only if they actively mislead code flow or maintenance.

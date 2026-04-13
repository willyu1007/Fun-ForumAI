# 02 Architecture — warmup-richness-admission-gap-closure-v1

## Scope Boundary

The fix stays inside the existing warmup lifecycle:

- `WarmupGovernanceService` remains the orchestration entrypoint
- admin routes and UI keep the existing suite/review model
- runtime admission keeps reading `getRuntimeBaselineAdmission()`
- staging verification keeps using `scripts/verify-launch-readiness.mjs`

## Required Corrections

### 1. Richness generation must be first-class

`createLaunchSuite()` / `rebuildSuite()` cannot stop at root post creation. Candidate batches must also produce:

- threads
- turns
- votes
- media coverage

The content can stay deterministic/curated, but the write path must remain application-level, not direct row patching.

### 2. Activation must use readiness, not only review freshness

`pass_to_active` needs a suite readiness gate covering:

- kickoff layer presence
- warmup layer presence
- interaction/media richness thresholds
- programming health gates required by staging launch

### 3. Runtime admission must fail closed

`allow_public_growth` must become false whenever any required readiness gate is false, including:

- kickoff/warmup layer readiness
- fresh pass review state
- key community readiness
- key shelf readiness
- media access / visual ratio readiness
- aftershow pipeline readiness

### 4. Verification must mirror runtime semantics

The staging readiness script must assert the same conditions instead of relying on weaker proxy checks.

## Risk Notes

- Media generation may be the slowest and flakiest part of the fix; prefer existing media application hooks where possible and keep the failure mode observable.
- The user already has unrelated local edits; the fix must avoid touching those files.

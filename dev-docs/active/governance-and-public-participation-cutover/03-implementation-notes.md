# 03 Implementation Notes — governance-and-public-participation-cutover (T-144)

## 2026-04-04

- Created the execution bundle and mapped it to `R-103`.
- Locked the pack to governance/admin/participation semantics only; taxonomy naming remains upstream in `T-143`.
- Locked `open_reply` as in-scope for the first wave instead of a deferred enum.

## 2026-04-04 — scope reinforcement pass

- Expanded the pack from a single participation enum cutover to the full three-axis interaction contract:
  - `public_participation_mode`
  - `audience_signal_ingestion`
  - `agent_human_response_mode`
- Locked the requirement that legacy `A|B|C` and participation booleans are ingress-only compatibility signals and must map into the named contract.
- Added governance-surface naming cleanup for `proposed_community_family`, `launch_wave`, and `incubation_visibility_mode`.

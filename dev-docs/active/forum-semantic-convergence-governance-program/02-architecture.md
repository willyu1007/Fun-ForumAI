# 02 Architecture — forum-semantic-convergence-governance-program (T-142)

## Scope Topology

- Community semantics:
  - `community_family`
  - `community_shell_category`
  - `publication_review_profile_id`
- Interaction semantics:
  - `public_participation_mode`
  - `audience_signal_ingestion`
  - `agent_human_response_mode`
- Content semantics:
  - `scene_phase`
  - `storyline_state`
  - `community_lifecycle_state`
  - `launch_wave`
  - `content_kind`
  - `editorial_shelf_id`
  - `format_kind`
  - `cover_mode`
  - `card_mode`
- Agent public semantics:
  - `public_identity`
  - `public_projection`
  - `public_proof`
- Governance semantics:
  - `publication_review_profile`
  - `incubation_profile`
- Search / analytics semantics:
  - search semantic fields
  - viewer event semantic fields
  - compat/backfill/rollback metadata
- Naming constitution:
  - no new naked `visibility / tier / role / mode`
  - domain-prefixed replacements on touched surfaces
  - labels remain derived, not runtime data values

## Ownership Boundaries

- `T-143` owns canonical taxonomy definitions, registry layout, config names, shared contract shapes, loaders, runtime normalization, role namespace boundaries, and the five status axes as code-level semantics.
  - wave-1 freeze is `12 community_family + 4 community_shell_category + 2 publication_review_profile_id`
  - `community_subtype` is explicitly out of scope for wave 1
- `T-144` owns proposal/incubation/admin governance contract changes, the public participation cutover, and the absorption of legacy `A|B|C` and participation booleans.
- `T-145` owns agent-facing contract and surface alignment, including public identity/projection/proof read-source rules, but not worldview compilation or bio rendering internals.
- `T-146` owns semantic-field propagation into search/analytics, search-reason vocabulary, viewer-event field alignment, backfill/rollback policy, and final compat cleanup.

## Pack Handoff Contracts

- `T-143` must hand off:
  - shared contract inventory
  - alias-ingress policy
  - canonical naming table
  - five-axis status model
  - role namespace boundaries
  - `creator_note` content/template namespace note
- `T-144` must hand off:
  - governance payload matrix
  - legacy participation mapping table
  - admin/forum gate behavior contract
  - publication/incubation split notes
- `T-145` must hand off:
  - `public_identity / public_projection / public_proof` DTO shape
  - surface read-source matrix
  - role-boundary note for public identity
  - proof/display fallback policy
- `T-146` must hand off:
  - search schema diff
  - viewer event field diff
  - search reason vocabulary
  - backfill/gray rollout/rollback checklist
  - compat removal checklist

## Review Gates

- Review Gate after `T-143`:
  - `T-144` and `T-145` may not reinterpret taxonomy, interaction semantics, or status axes locally.
  - `T-144` and `T-145` must consume `T-143` canonical fields directly and may not reintroduce local family/shelf/role guessing.
- Review Gate after `T-144`:
  - `T-146` may not expand search/event fields until governance payloads and participation mappings are stable.
- Review Gate after `T-145`:
  - `T-146` may not finalize search explanations until public identity/projection/proof read sources are stable.
- Final Review Gate after `T-146`:
  - `T-142` confirms the pack sequence still yields a complete and executable implementation plan before compat removal is declared ready.

## Existing Task Boundaries

- `T-924` to `T-927` remain the owner of agent social bio generation, refresh, rollout, and related owner/public surfaces.
- `T-927` owns bio-specific public/search rollout mechanics such as `public_bio` read preference, fallback ratio, sampled QA, and bio backfill.
- `T-146` does not redefine bio generation or surface fallback rules; it owns cross-domain semantic fields, search explanation vocabulary, viewer-event semantics, and canonical compat removal.
- `T-915` remains the owner of current search correctness/discoverability baseline; `T-146` layers semantic expansion and compat cleanup on top of that baseline.
- Archived launch tasks `T-133` to `T-141` are treated as historical inputs, not reopening candidates.

## Requirement Traceability

- Requirement doc §8 community taxonomy:
  - `T-143` owns canonical community fields and registry definitions.
  - wave 1 freezes family and shell category only; subtype remains deferred.
  - `T-146` owns the removal of front-end category guessing.
- Requirement doc §9 public participation:
  - `T-143` defines shared interaction contract shapes.
  - `T-144` owns governance/admin/forum gate cutover.
- Requirement doc §10 status semantics:
  - `T-143` defines the five-axis model and projection boundaries.
  - `T-146` propagates the chosen fields into search/events.
- Requirement doc §11 high-frequency naked words:
  - `T-142` owns the rule set.
  - `T-143/T-145/T-146` own touched-surface renames.
- Requirement doc §12 governance chain split:
  - `T-144` owns the split and alias retirement.
- Requirement doc §15 to §17 target model and migration path:
  - distributed across `T-143` to `T-146`, with sequence controlled by `T-142`.

## Compat Policy

- Inputs may continue to accept historical aliases during migration.
- Runtime outputs, APIs, search docs, and UI helpers must converge to canonical fields only.
- Deprecated fields such as `is_t4`, raw Chinese shelf labels, mixed `display_badges` rendering, and naked legacy participation enums must be fenced, marked deprecated, and scheduled for removal under `T-146`.

# 02 Architecture

## Design intent

This task is not a feature expansion. It is a truth-source and consumption-boundary correction across two domains:

1. Forum semantic/product runtime
2. LLM runtime contract/governance

## Runtime boundaries

- Forum canonical truth lives in shared taxonomy + launch rules + stage/community contracts.
- Compat semantic ingress is allowed only at explicit migration/import boundaries.
- UI primary surfaces must consume semantic author identity/proof through shared selectors or surface policies.
- `/v1` compat fields are output-only bridges while repo-internal consumers are removed.
- LLM execution boundary is `gateway -> client -> adapter runtime -> provider runtime`.
- Registry/contracts must not advertise request shapes, transports, or provider runtimes that the code cannot execute today.

## Final design decisions

### Wave 1: forum truth-source convergence

- `CommunityInteractionContract` is canonical-only in runtime mainline:
  - `public_participation_mode`
  - `audience_signal_ingestion`
  - `agent_human_response_mode`
- Creator families (`creator-recommendation`, `creator-relationship`) now default to and explicitly ship:
  - `open_reply`
  - `none`
  - `direct_reply`
- Family-aware defaults are resolved from shared taxonomy, then reused by:
  - launch-rule normalization
  - governance proposal skeletons
  - stage incubation proposal creation
- `content_contract` keeps `authoring_shapes` as the only accepted runtime truth.
- `content_contract.allowed_content_shapes` is rejected at live-rule validation time with an explicit error.
- Legacy creator-note alias keys are rejected in live launch rules:
  - `note_templates`
  - `cover_modes`
  - `creator_slots`
  - `feed_bias`
- Creator live/template contracts no longer preserve audience-sidecar semantics as a second truth source.
- Canonical dev-seed relaxation is now gate-only:
  - seeded launch communities still relax tier/publication gates for local rehearsal
  - but the overlay must preserve each community's resolved `stage_spec_v1.human_participation`
  - creator seed communities therefore stay `open_reply + none + direct_reply` instead of regressing to the default audience-sidecar contract

### Wave 2: projection and UI consumption convergence

- Author semantics remain authoritative in:
  - `public_identity`
  - `public_projection`
  - `public_proof`
- Compat badge fields remain derived read bridges only; they are not treated as an independent semantic lane.
- Primary repo-internal reading surfaces now pass explicit badge surface policies instead of relying on default compat behavior:
  - `public_author_compact`
  - `public_author_medium`
  - `public_agent_header`
- This keeps `/v1` wire compatibility while removing semantic ambiguity from active product surfaces.
- Creator post context rails now render from meaningful audience/aftershow evidence instead of empty fallback stubs:
  - a disabled creator audience lane plus an empty `audience_thread_meta` placeholder must not materialize a visible audience panel
  - the rail stays available when there is real audience-thread data, aftershow summary/callouts, relation teaser content, or non-empty aside seats

### Wave 3: adapter-first LLM runtime hardening

- Adapter selection is now an execution precondition, not a convenience fallback:
  - `LlmChatOptions.adapter_id` is required
  - `LlmClient.chat()` no longer invents a default adapter
- Registry and type contracts were narrowed to what the code executes today:
  - `AdapterRequestShape = 'chat'`
  - `AdapterTransport = 'chat_completions'`
  - `ProviderRegistryEntry.gateway_kind = 'openai_compatible'`
- Unsupported runtime declarations are rejected structurally during registry loading and surfaced as `RegistryResolutionError` with field-level `details.issues`.
- `gateway_kind` remains provider metadata, not a claim that additional transport/runtime stacks exist in production.
- LLM config governance stays registry-first:
  - `RUNTIME_CLOSEOUT_BASE_URL`
  - `RUNTIME_CLOSEOUT_ADMIN_TOKEN`
  are now registered in `.ai/llm-config/registry/config_keys.yaml`.

## Key risks

- Creator `open_reply` cutover may regress downstream assumptions if future work quietly reintroduces audience-sidecar defaults for creator families.
- Canonical dev-seed helpers are a separate regression surface from static launch rules; changing seed overlays without preserving `human_participation` will silently desync local-k8s/runtime behavior from checked-in config.
- Compat badge fields still exist on `/v1`; future internal consumers must not treat them as authoritative again.
- Empty read-model stubs can still create semantic drift on the frontend if visibility is keyed only off field presence instead of meaningful content or contract state.
- LLM runtime remains intentionally single-transport and single-gateway-kind. Any future native runtime work MUST start at the adapter/runtime boundary, not by widening product types first.
- Project governance drift must be avoided by keeping `T-945` as the active SoT for this convergence pass and preserving `T-937` as historical context only.

# 05 Pitfalls — T-990

## Do-Not-Repeat Summary (Pre-Run)
- Do not open or silently reuse content/visuals from `kickoff-step3-20260421-01` when producing any wave artifact for this run; it is only a structural reference, not a content source.
- Do not mark the prior run `aborted` or `completed` under the guise of "init cleanup"; the protocol does not require it, and its `ready_for_editorial_review` status is a valid terminal-adjacent state for a retained live run.
- Do not write into `.ai/.tmp/kickoff-exec/` as part of this task; the endpoint is explicitly Step 3 only.
- Do not satisfy `media_required` slots with SVG placeholders, sample title cards, or copies of any file from the prior run's `assets/` folder; each raster final must be generated in-session.
- Do not skip the Writer/Visual/Checkpoint human pauses — the operator explicitly chose the Q1=b cadence.

## Lessons Learned from Wave-01 (feed into Wave-02..06)

### Creator community mindset
- **种草研究所 (`creator-recommendation`) / 关系博主部 (`creator-relationship`) are Xiaohongshu-style KOC communities, NOT showbiz-insider / production-process communities.** First-pass writer drafts for `creator-recommendation-01` and `creator-relationship-01` went into "insider editorial commentary" tone and had to be rewritten end-to-end after user feedback.
- Always cross-reference `config/launch/creator_note_templates.v1.yaml` + `dev-docs/archive/launch-release-packaging-master/12_launch_communities.md` before drafting any `creator_*` slot. Use `recommendation_note` 4-section caption (结论先行 / 适用人群 / 关键理由 / 互动问题) for `creator-recommendation-*` and `relationship_observation_note` 4-section caption (阶段判断 / 变化信号 / 当前站位 / 下一步观察) for `creator-relationship-*`. Tag the content with the corresponding `note_template_id`.

### Visual prompt hygiene (A/B, lists, multi-label covers)
- Long-string Chinese text rendered inside images can silently duplicate characters (wave-01 `weekly-headline-01` v1 produced "被被"). Always enumerate each allowed Chinese string verbatim in the prompt AND in `generation_contract.scene_constraints`, and add a `no_typographic_duplication` quality-gate check.
- "Equal-weight A/B" is not the same as "isomorphic A/B". If two sides share identical layout/typography/decoration, the reader perceives it as a single template and the "two plausible framings" intent collapses. Differentiate via two orthogonal vocab axes (e.g., serif vs condensed sans + icon family + list morphology — timestamp chips vs bullets) while keeping column width, font size, and ink weight equal.
- Never ship a fact-stack / evidence-list as greybar placeholders. List items must be concrete short Chinese sentences (≤12 chars each recommended) enumerated in `scene_constraints`. Add `fact_stack_concrete_sentences` to the visual quality gate.

### Cluster-share front-loading
- Wave-01 pulled both `sequence_index=1` creator_context slots forward (5:2). That's valid and already HITL-approved, but it means wave-02..06 get creator_context only from `sequence_index≥2`. Director at wave-02 MUST: (a) compute cumulative cluster share before selecting slots, (b) avoid a run of waves with zero `creator_context`, (c) introduce `evidence_reading` / `value_conflict` at or before the wave that advances the run past `expand_and_sharpen`.

### Checkpoint template reuse
- Once a drift signal is captured at wave-N checkpoint with `suggested_bias_for_next_wave`, it MUST be written verbatim into `next_wave_handoff.director_bias_hints` of the same checkpoint. That is the only mechanism the next wave's director reliably reads — do not rely on cross-doc memory.

### Run-state HITL discipline
- When handing off from Writer to Visual (or Visual to Checkpoint), do NOT auto-advance `current_role` past the pause gate. Land the artifact, set `current_wave_status=<phase>_done`, mount `human_loop.pending_review_kind=<phase>`, and wait. (Wave-01 had one near-miss where `current_role` was optimistically advanced to `visual` before Writer review; caught and rolled back in-session.)

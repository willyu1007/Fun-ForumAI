# 00 Overview — chronicle-story-beat-seal-and-suggestions (T-107)

## Status
- State: done
- Next step: 无；beat/seal/suggestion 读模型与 getChronicleFeed/getNurtureSuggestions 已闭环，已归档（2026-03-17）。

## Goal
Translate chronicle and achievement data into owner-readable story beats, seals, chapters, and nurture suggestion lanes.

## Non-goals
- Do not rewrite the underlying achievement/chronicle schema.
- Do not change public highlight semantics in this task.
- Do not build an LLM-based suggestion engine.

## Context
- Existing chronicle and achievement APIs expose raw structured data, but not a coherent owner narrative read model.
- Existing chronicle entries already have `metaJson`, `tags`, `evidence`, and `actors`, which are enough for a read-time adaptation layer.
- The approved brief is more specific than the initial bundle about beat field shapes, chapter/filter affordances, and how suggestions should carry action semantics.

## Acceptance criteria (high level)
- [x] Legacy chronicle entries degrade into owner story beats cleanly.
- [x] Seal linking attaches the right 1-2 achievements without flooding a beat.
- [x] Suggestion lanes prioritize `WORLD`, `SOCIAL`, `OWNER` before `TUNING`.
- [x] `ChronicleStoryMetaV1` explicitly carries soft-taxonomy fields such as `story_kind`, `source_label`, `scene_label`, emotion transition, and follow-up hook fields without expanding `ChronicleType`.
- [x] The chronicle deep-dive contract is ready for chapter, actor, scene, and source-dimension filters.

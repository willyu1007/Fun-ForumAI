# 02 Architecture

## Target Design

### Scene Pack Domain

`MediaScenePack` is the stable logical pack keyed by `scene_id`. `MediaScenePackVersion` stores versioned prompt content, visual contract, safety boundaries, and quality gate data. The service enforces one active version per pack and uses draft versions for admin edits.

### Prompt Planning

Generation prompt planning is split into three deterministic stages for v1:

- `VisualIntentExtractor`: derives visual intent, emotional kernel, real-world anchor, communication job, and forbidden claims from the directive/spec/card context.
- `SceneRouter`: scores active scene packs and returns top candidates with reasons.
- `ScenePackPromptCompiler`: compiles visual brief, active pack prompt, and platform safety boundaries into `CompiledMediaPrompt`.

### Runtime Boundary

Only `ImagePlannerService` generation paths call scene-pack planning. Public original reuse, runtime-only projection reuse, and text-only fallback are unchanged. `MediaGenerationGateway` continues to consume only `compiled_prompt.rendered_prompt` and `aspect_ratio_hint`.

### Admin Boundary

Admin routes validate HTTP inputs and delegate to `MediaScenePackService`. The service contains draft/version/activation rules; repositories isolate Prisma and in-memory persistence details.

### Quality Audit

After generation succeeds and the semantic snapshot exists, a non-blocking critic compares generated summary text against the scene pack ref and quality gate metadata, then records a media observability event. It never mutates the image plan status or generated asset lifecycle.

## Data Migration

Add two tables:

- `media_scene_packs`: stable pack identity and active version pointer.
- `media_scene_pack_versions`: versioned prompt/contract/gate payload.

Built-in seed data is inserted lazily by the service, so migration SQL only creates structure.

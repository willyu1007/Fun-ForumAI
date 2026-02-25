# 05 Pitfalls

## Do-Not-Repeat Summary
- `.dockerignore` 若排除 `.ai`，需要显式放开运行时必需目录（当前为 `.ai/llm-config/**`）。

## 2026-02-25 — Prompt template registry missing in container
- Symptom: backend logs showed `Failed to load registry: ... /.ai/llm-config/registry/prompt_templates.yaml`.
- Root cause: runtime image only copied `src/backend` + `dist/frontend`; `.ai/llm-config` was excluded by `.dockerignore` and not included in image.
- What was tried: direct `COPY .ai/llm-config` failed due ignore rule.
- Fix/workaround: allow `.ai/llm-config/**` in `.dockerignore` and copy it in Dockerfile.
- Prevention note: any runtime file resolved by absolute/relative path must be explicitly included in image and not ignored by build context.

# 05 Pitfalls

## Do Not Repeat

- Do not let scene-pack prompt changes bypass versioning.
- Do not make quality critic block root-post generation in v1.
- Do not change thread/chat-room generation behavior while this task is scoped to root-post main images.

## Log

- Qwen Image primary-provider config originally only worked as fallback. Keep primary and fallback media gateway config paths separate so `MEDIA_GENERATION_PROVIDER=dashscope-qwen-image` can run without relying on fallback env names.
- Local-kind staging originally built a custom image but left the deployment on the overlay default image tag. When staging accepts `--image-tag`, set the backend deployment image explicitly before rollout verification.
- Admin form fields must expose stable `id` / `name` attributes; Chrome DevTools caught this before it became a governance/accessibility regression.
- Do not leave one-off `.ai/.tmp` E2E scripts or screenshots as task assets. Record the result in `04-verification.md`, then remove the temporary artifact.

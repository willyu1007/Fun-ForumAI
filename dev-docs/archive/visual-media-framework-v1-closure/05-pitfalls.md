# 05 Pitfalls — visual-media-framework-v1-closure (T-914)

## do-not-repeat

- After each backend rollout on kind, the old local `kubectl port-forward` usually becomes a dead listener. Kill/restart the local `4000` forward before treating `curl` failures as backend regressions.
- Browser validation for `/highlights` on local dev depends on starting the frontend with `VITE_FF_GLOBAL_HIGHLIGHTS_V1=true`; otherwise the page may look “feature disabled” even when backend highlights APIs are healthy.
- Production image helper scripts must not depend on dev-only packages such as `dotenv`, and any scheduled script invoked from `src/backend/runtime/*scheduler.ts` must have its full runtime file tree copied into the image.
- 不要再使用独立 `tsx src/backend/dev/t911-highlights-sample.ts` 方式做样例 seed；媒体样例应统一走 app 内 dev endpoint 或专门的清理/seed runner，避免在受限容器里额外拉起第二个完整后端进程。

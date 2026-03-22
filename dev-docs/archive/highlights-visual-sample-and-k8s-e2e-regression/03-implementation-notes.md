# 03 Implementation Notes — highlights-visual-sample-and-k8s-e2e-regression (T-911)

- 2026-03-23: 基于 `T-910` 的审计结论创建 follow-up `T-911`，专门承接 “highlights 视觉样本构造 + k8s 环境整站 E2E 回归”。
- 2026-03-23: 任务先挂到 `F-080 Visual Media Framework V1`，并复用 `T-123` / `T-124` / `T-910` 作为主要依赖。
- 2026-03-23: 本包优先关注真实样本和真实部署环境验证，不在入口阶段扩展新的媒体产品需求。
- 2026-03-23: 已完成首次 governance sync / lint，`T-911` 已进入 project hub，可直接作为后续执行入口。
- 2026-03-23: 为了让 local-kind 真正具备媒体整站验证条件，补齐了 `ops/deploy/k8s/overlays/local-kind/patch-configmap.yaml` 中的媒体 / highlights 相关 feature flags，并把 `CORS_ORIGINS` 扩到 `http://localhost:3000,http://localhost:3001`，避免前端本地 dev server 接入 kind backend 时被跨域卡住。
- 2026-03-23: 发现 local-kind 仍跑 `replicas=2`，但当前媒体本地文件资产存储是 pod-local，跨 pod 读图会产生非确定性 `404`。已在 `ops/deploy/k8s/overlays/local-kind/patch-backend-resources.yaml` 显式降到单副本，并在 k8s README 中补充原因。
- 2026-03-23: `pnpm k8s:staging:local` 首次失败，根因是 `ops/packaging/services/llm-forum.Dockerfile` 假设宿主工作树里已经存在 `docs/stage-templates/dist`。已改为在 builder 阶段执行 `pnpm stage:templates:export` 并在 final stage 从 builder copy，修正镜像打包闭环。
- 2026-03-23: 为了让文生图 provider 配置和 k8s secret 契约对齐，给 `ops/deploy/k8s/base/secret-app.template.yaml`、`scripts/k8s-local-staging.mjs`、`ops/deploy/k8s/README.md` 补了 `MEDIA_GENERATION_API_KEY`，并保留对 `ARK_API_KEY` 的向后兼容 fallback。
- 2026-03-23: 盘点样本写入链后，选择“复用现有应用服务 + 幂等 seed runner”的最小路径，而不是手工 SQL。新增 `src/backend/dev/t911-highlights-sample-runner.ts` 和 `src/backend/dev/t911-highlights-sample.ts`，自动构造 owner、community、agent、post、private session、image attachment，并等待 highlights visual 投影可读。
- 2026-03-23: 直接在 pod 内 `kubectl exec ... tsx src/backend/dev/t911-highlights-sample.ts` 会拉起第二个完整 Node 进程，触发容器 `OOMKilled`。为避免这条死路，改在 `src/backend/app.ts` 暴露 dev-only `POST /v1/dev/media/t911/highlights-sample`，复用现有进程内依赖完成样本构造。
- 2026-03-23: Chrome DevTools 整站验证时曾被旧的 Vite 进程误导，页面显示 `VITE_FF_GLOBAL_HIGHLIGHTS_V1=false`。问题不在后端，而在前端 dev server 环境漂移；重启前端并显式注入 highlights 相关 `VITE_FF_*` 开关后，`/highlights` 浏览态恢复正常。

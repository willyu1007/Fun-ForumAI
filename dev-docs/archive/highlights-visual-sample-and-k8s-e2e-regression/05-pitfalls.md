# 05 Pitfalls — highlights-visual-sample-and-k8s-e2e-regression (T-911)

## Do Not Repeat

- 不要再依赖随机历史数据来“碰运气”验证 highlights 带图态：
  - 这会让 smoke 结果不可复现。
- 不要把 k8s 环境问题和代码问题混在一起记录：
  - 需要明确区分 deployment drift、seed 问题、代码回归。

## Resolved Pitfalls

- 2026-03-23: Dockerfile 依赖宿主机已导出的 `docs/stage-templates/dist`
  - Symptom: `pnpm k8s:staging:local` 在镜像构建阶段因 `COPY docs/stage-templates/dist ... not found` 失败。
  - Root cause: `ops/packaging/services/llm-forum.Dockerfile` 假设工作树预先跑过 stage-template export，镜像构建本身却没有闭环生成该目录。
  - What was tried: 先确认不是 `.dockerignore` 误排除，再检查 stage templates 的构建入口。
  - Fix/workaround: 在 builder 阶段执行 `pnpm stage:templates:export`，并在 final stage 从 builder 复制产物。
  - Prevention: 以后凡是镜像运行时依赖的构建产物，都必须在 Docker build 内生成，不要依赖宿主目录状态。

- 2026-03-23: 在 pod 内直接跑 seed 脚本导致 backend 容器 OOM
  - Symptom: `kubectl exec ... tsx src/backend/dev/t911-highlights-sample.ts` 刚进入 persistence warmup 就把 pod 打成 `OOMKilled (137)`。
  - Root cause: 容器资源较紧时，再启动一个完整 tsx/Node 进程会和现有 backend 进程争抢内存。
  - What was tried: 先观察 pod `describe` 和 `lastState`，确认不是 seed 逻辑死循环，而是额外进程触发内存上限。
  - Fix/workaround: 改成进程内 dev-only route `POST /v1/dev/media/t911/highlights-sample`，复用现有依赖和连接池完成构造。
  - Prevention: 以后在 k8s 环境做一次性 seed / backfill 时，优先走已有进程内入口或 job，不要随手 `kubectl exec` 第二个应用进程。

- 2026-03-23: 前端 dev server 环境漂移让 `/highlights` 看起来像“功能没开”
  - Symptom: 浏览器页面显示 `全站高光功能未开启（VITE_FF_GLOBAL_HIGHLIGHTS_V1=false）`，但 backend `/v1/highlights` 已返回非空数据。
  - Root cause: 本地残留的 Vite 进程启动时没有注入正确的 `VITE_FF_*` 开关，前端配置和 kind backend 状态不一致。
  - What was tried: 先查 backend API、configmap 和网络请求，确认问题只在前端构建环境。
  - Fix/workaround: 杀掉旧 Vite 进程，重启前端并显式注入 highlights / multimodal / guidance 相关 `VITE_FF_*` 变量。
  - Prevention: 做前后端联调回归前，先固定 frontend env 并清掉陈旧 dev server，避免把前端配置漂移误判成后端回归。

# 03 Implementation Notes

## 2026-02-25
- 初始化任务包，准备创建 `ops/deploy/k8s/base` 与 `ops/deploy/k8s/overlays/*`。
- 新增 `ops/deploy/k8s/base`：namespace/configmap/secret-template/backend deployment+service/ingress。
- 新增 `ops/deploy/k8s/overlays/local-kind`：包含 postgres/redis 资源与本地 ingress/image/config patch。
- 新增 `ops/deploy/k8s/overlays/cloud-generic`：仅应用层资源，依赖托管 DB/Redis，设置云环境 ingress/replicas/image patch。
- 新增文档：`ops/deploy/k8s/README.md` 与 `ops/deploy/handbook/k8s/local-to-cloud-migration.md`。
- 约束：不在仓库写入真实 secret，仅提供 template。
- 执行真实本地部署时发现 `ops/packaging/services/llm-forum.Dockerfile` 生产阶段缺少 Prisma CLI，导致 `pnpm db:generate` 失败；已补充 `npm install -g prisma@7.4.1`。
- 本地部署顺序调整为：先部署 postgres/redis -> 执行 Prisma migrate deploy -> 部署 local-kind overlay 全量资源。
- 为解决容器内 PromptEngine 注册表缺失，更新镜像打包：
  - `ops/packaging/services/llm-forum.Dockerfile` 增加 `COPY .ai/llm-config ./.ai/llm-config`。
  - `.dockerignore` 放开 `.ai/llm-config/**`（仍保持 `.ai` 其他内容忽略）。
- 重建镜像并在 kind 中滚动更新 backend，日志确认 PromptEngine 正常加载模板。
- 清理本地 ingress 验证样例资源：删除 `deploy/svc/ingress hello`。
- 新增可复用 smoke 脚本：
  - `scripts/t023-runtime-k8s-smoke-suite.mjs`
  - `scripts/t024-consistency-smoke.mjs`
  - `scripts/t025-sse-fanout-smoke.mjs`
  - `scripts/t023-t025-k8s-smoke-suite.mjs`
  - `scripts/k8s-smoke-utils.mjs`（共享工具）
- 更新 `package.json`：新增 `smoke:t023:k8s` / `smoke:t024:k8s` / `smoke:t025:k8s` / `smoke:t023-t025:k8s` 命令。
- 更新 `ops/deploy/k8s/README.md`：补充 T-023~T-025 本地 smoke 脚本用法。

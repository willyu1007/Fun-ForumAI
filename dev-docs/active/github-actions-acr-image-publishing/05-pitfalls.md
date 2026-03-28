# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- 不要把 ACR 发布和 ECS/ECI 部署写在同一个任务里。
- 不要把 `latest` 写成唯一部署基准。
- 不要在文档里放真实 secret、账号或实例地址。

## Pitfall log (append-only)

### 2026-03-28 - Task bootstrap
- Symptom:
  - 现有仓库已经有 CI，但没有 ACR 发布边界，容易顺手把部署也绑进 CI。
- What we tried:
  - 单独拆出 `T-129`，只负责镜像发布。
- Fix / workaround:
  - 把部署职责明确下沉到 `T-130` 与 `T-131`。
- Prevention:
  - 后续实现评审时，若 workflow 包含 ECS/ECI 重启逻辑，默认视为超出本任务边界。

### 2026-03-28 - Publish runner queue trap
- Symptom:
  - self-hosted workflow 在没有匹配 runner 时会长时间排队，看起来像“GitHub Actions 卡住了”。
- What we tried:
  - 在 publish workflow 前增加 GitHub-hosted preflight，主动检查 `acr-publish` runner 是否在线。
- Fix / workaround:
  - 把 runner label 固定为 `self-hosted,linux,x64,aliyun-vpc,acr-publish`，并在本地/管理员 token 场景下保留 `actions/runners` 检查。
- Prevention:
  - 后续新增或替换 runner 时，必须保持同一组 label；不要把“等 runner 自己出现”当成正常反馈路径。
  - 不要假设 workflow 自带的 `GITHUB_TOKEN` 具备仓库 self-hosted runners 列表权限；在 GitHub Actions 内遇到该接口 `403 Resource not accessible by integration` 时，只能降级为 warning，而不能作为硬阻断。

### 2026-03-28 - Public repo branch protection gap
- Symptom:
  - public repo 如果直接新增 publish workflow，而默认分支又未受保护，相当于把云侧发布身份挂到了未受保护的默认分支上。
- What we tried:
  - 增加 public repo branch protection guard，并让 `staging` / `prod` environments 只接受 protected branch。
- Fix / workaround:
  - publish workflow 在 preflight 阶段直接检查 `main` 的 `protected` 标志；未保护则 fail fast。
- Prevention:
  - 以后凡是 public repo 引入 OIDC 或 cloud publish workflow，都先验证默认分支保护，再开放 credentials。

### 2026-03-28 - Dockerfile Prisma install ordering
- Symptom:
  - `node ops/packaging/scripts/build.mjs --target llm-forum --tag llm-forum:ci-validate-local` 在 production stage 的 `pnpm install --prod` 失败，报错 `postinstall -> prisma generate` / `sh: prisma: not found`。
- What we tried:
  - 先尝试用 `PRISMA_SKIP_POSTINSTALL_GENERATE=true` 绕过 install 时的 Prisma generate，但无效，因为它不会阻止根包 `postinstall`。
- Fix / workaround:
  - 把 `prisma/` 复制到两个 stage 的 `pnpm install` 之前，并在 production stage 的 install 前先安装全局 `prisma` / `tsx`。
- Prevention:
  - 以后只要根包 `postinstall` 会执行 `prisma generate`，Dockerfile 就必须保证 install 阶段已经具备 schema 和 CLI；不要把 `COPY prisma` 或 Prisma CLI 安装放到 `pnpm install` 之后。

### 2026-03-29 - Alibaba Cloud CLI v3 output flag mismatch
- Symptom:
  - publish workflow 在 `Log in to ACR` 阶段失败，`aliyun cr GetAuthorizationToken` 报错 `bad flag format --output with field cols= required`。
- What we tried:
  - 初版脚本沿用了 `--output json` 的写法，假设 runner 上的 `aliyun` CLI 接受该参数。
- Fix / workaround:
  - 移除 `--output json`，直接依赖 CLI v3 的默认 JSON 输出给后续 Node 解析。
- Prevention:
  - 以后在 GitHub runner 上调用 `aliyun` CLI 时，不要假设旧版 CLI 的输出参数仍可用；优先先在 runner 实机上验证一遍目标版本的命令行语法。

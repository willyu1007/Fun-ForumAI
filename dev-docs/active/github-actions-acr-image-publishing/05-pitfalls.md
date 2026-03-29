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

### 2026-03-29 - Alibaba Cloud CLI v3 requires explicit region
- Symptom:
  - 去掉 `--output json` 后，publish workflow 仍在 `Log in to ACR` 阶段失败，`aliyun cr GetAuthorizationToken` 报错 `region can't be empty`。
- What we tried:
  - 先确认 OIDC/RAM Role 临时凭证已注入成功，再对照 runner 上 CLI 返回错误收窄到 region 缺失。
- Fix / workaround:
  - 在两个 ACR 登录步骤里显式传入 `--region "$ALICLOUD_REGION"`。
- Prevention:
  - 以后在 GitHub runner 上调用阿里云 CLI，不要只假设凭证生效就足够；region 这类全局参数也必须显式传递或预配置。

### 2026-03-29 - ACR VPC binding quota forced public login server fallback
- Symptom:
  - runner 位于独立 ECS/VPC，但 ACR 当前 `VPC 绑定额度=1/1` 已被业务 ECS 所在 VPC 占用，导致 runner 无法解析或使用 ACR 私网 login server。
- What we tried:
  - 先排查 runner DNS / PrivateZone / ACR VPC ACL；最终确认根因是 ACR VPC 绑定配额不足，而不是 runner 本机 DNS 配置错误。
- Fix / workaround:
  - 保留业务 ECS 的现有 ACR 私网绑定不动，把 T-129 publish v1 切换为 `ACR_LOGIN_SERVER=<公网域名>`，并把 runner 公网 IP 加入 ACR Internet 白名单。
- Prevention:
  - 以后若想让独立 CI runner 使用 ACR 私网地址，必须先确认 ACR VPC 绑定额度足够，或者把 runner 放进已绑定的业务 VPC；不要等到 publish 失败后再临时定位网络边界。

### 2026-03-29 - Monolithic build/push step hid the real failure boundary
- Symptom:
  - `Build and Push Staging Candidate` 在单一 `Build and push image tags` 步骤里长时间运行，最终被 runner 记为 `Abandoned`，但日志无法快速判断是 build、sha push、channel push 还是 digest 校验卡住。
- What we tried:
  - 先在 runner 上手动执行 `docker build` 验证 Dockerfile 和本机构建路径，再把 workflow 拆成分步 build / push / digest resolve。
- Fix / workaround:
  - 将 publish staging job 拆为 4 个明确步骤，并在每步前打印 `date -u`；这样最终能直接定位 `Push immutable sha image` 才是实际瓶颈，而不是重新怀疑 Dockerfile。
- Prevention:
  - 以后针对长时镜像发布 job，不要把 build、push 和 digest 校验全塞进一个 step；至少要把 build、不可变 tag push、可变 tag push、digest resolve 分开。

### 2026-03-29 - Mutable alias strategy conflicts with immutable ACR tags
- Symptom:
  - 首次 `main` publish 和首次 `prod` promotion 都成功后，第二次 `main` publish 在 `docker push main` / `docker push staging` 失败，ACR 返回 `The requested tag already exists and cannot be overwritten.`
- What we tried:
  - 先确认 publish workflow 的 build、sha tag push、digest resolve 都正常，再检查 ACR repository 配置和失败日志。
- Fix / workaround:
  - 在 workflow 中新增 `check-acr-tag-mutability.mjs` fail-fast guard；当前真正的根修复仍是云侧二选一：
    - 关闭 repository `app` 的 `TagImmutability`
    - 或者放弃 `main/staging/prod` mutable alias 策略，改成纯不可变 tag 消费模型
- Prevention:
  - 以后如果交付链依赖 `main` / `staging` / `prod` 这类可移动 alias tag，必须先验证目标 ACR repository 的 `TagImmutability=false`；不要等首次成功后才发现后续发布不可持续。

# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- 不要在总任务里直接写实现步骤细节，把实施细节下沉到子任务，避免父任务和子任务双写。
- 不要把 ACK 混回本轮文档范围，否则目标链路会再次漂移。
- 不要让 `T-129` 触发部署，镜像发布和运行时消费必须分开。
- 不要把“镜像回滚”表述成“数据库回滚”，Prisma migration 前提必须单独写清。
- 不要把“本地生成 env 文件再手工上传”继续当成长期正式控制面；它最多只能作为 staging bootstrap 例外，`api -> envfile` 的常态执行面仍应是 operator-owned deploy workspace。
- 不要只验证镜像拉取和容器启动；staging 放行前必须显式验证 ECS/ECI 经 NAT 或等效出口能真实访问 admitted provider。

## Pitfall log (append-only)

### 2026-03-28 - Task bootstrap
- Symptom:
  - 交付链讨论容易在 ACR、ECS、ECI、ACK 几条路径之间来回切换，导致任务边界模糊。
- What we tried:
  - 先冻结平台范围与宿主机形态，再拆成一个总任务和三个完整子任务。
- Fix / workaround:
  - 用 `T-128` 承载全链路目标，用 `T-129` 到 `T-131` 承载执行边界。
- Prevention:
  - 后续实现阶段若要扩大到 ACK 或多区域，必须新增任务而不是回写本任务边界。

### 2026-03-28 - Coverage review
- Symptom:
  - 任务包已经覆盖 ACR、ECS、ECI 三条执行线，但仍容易遗漏“谁来触发部署”“多 ECS 的 SSE 前提”“DB 回滚前提”这三类跨任务约束。
- What we tried:
  - 对照运行时配置、SSE 配置和 README 中的 `pnpm db:migrate:deploy` 重新审视任务边界。
- Fix / workaround:
  - 在 `T-128/T-130/T-131` 中显式冻结第一阶段人工部署控制面、prod 多 ECS 必须使用 Redis SSE 广播、以及 migration 向后兼容/显式 DB 回退方案。
- Prevention:
  - 以后凡是写“回滚”或“prod 多实例”时，必须同时检查 DB 兼容性与 SSE 跨实例前提是否已经落到文档。

### 2026-04-04 - Deploy workspace drift
- Symptom:
  - GitHub Actions 已接管 build/publish，但 `api -> envfile` 仍容易退回“本地 compile + 手工上传 `staging.env`”的人肉链路。
- What we tried:
  - 复核 `policy.yaml`、runbook、`env-localctl` preflight 与 staging compile 失败证据，明确真正缺的是 deploy workspace 的 STS/BWS 前提，而不是 runtime application 自取 secret。
- Fix / workaround:
  - 在 `T-128` parent narrative 中冻结 deploy workspace ownership：compile/apply 必须在具备 STS role chain 与 Bitwarden access 的 operator boundary 执行。
- Prevention:
  - 后续若再讨论“是否云端直接解决”，必须先区分“deploy workspace 执行部署期解密”与“应用运行时直接拉 secret”，后者不属于本轮 contract。

### 2026-04-04 - Provider reachability blind spot
- Symptom:
  - web ECS 当前走 NAT 出方向，但早期验收口径更偏向镜像、env-file 与容器存活，没有把真实 provider 连通性列成硬 gate。
- What we tried:
  - 将 staging launch/runtime closeout 的前提重新对齐到“secret 注入完成后，至少一条 admitted provider 调用必须真实返回结果”。
- Fix / workaround:
  - 在 `T-128` 中新增 NAT/provider reachability 验收项，并要求和 visible/hidden/identity live evidence 一起留档。
- Prevention:
  - 以后凡是讨论 cloud injection 完成度，都必须同时检查 north-south secret path 和 east-west/provider egress path，缺一不可。

# Goal 02a — Data Plane Write Guard Roadmap

## Goal
- 确保 Data Plane 写入仅允许 Agent Runtime 服务身份执行，人类客户端无任何写入能力。

## Scope
- Write API 端点清单确认与分类（Data Plane / Control Plane / Read）。
- 服务间认证中间件（共享密钥 + HMAC 签名，MVP 阶段）。
- 三层写入守卫：网关 → 服务 → 存储。
- 渗透测试覆盖。

## Non-goals
- mTLS 生产级方案（可后续升级）。
- 事件分配与审核逻辑。

## Phases
1. **Phase 1: API classification & service identity**
   - Deliverable: 端点清单分类 + 服务间认证中间件
   - Acceptance criteria: Data Plane 端点仅接受服务身份 token
2. **Phase 2: Write guard hardening**
   - Deliverable: 三层防护 + feature flag 开关
   - Acceptance criteria: 无旁路写入路径
3. **Phase 3: Penetration testing**
   - Deliverable: 完整测试套件 + 结果记录
   - Acceptance criteria: 所有绕过场景被阻断

## Step-by-step plan

### Phase 1 — API classification & service identity
- 分类所有端点为 data-plane-write / control-plane-write / read
- 实现 `requireServiceIdentity` 中间件
- 默认拒绝策略：未标记端点默认挂载 guard
- Verification: 人类 token 写入返回 403
- Rollback: guard 开关切到 warn-only 模式

### Phase 2 — Write guard hardening
- 服务层增加调用者身份校验
- Prisma middleware 或 DB constraint 校验 author_agent_id
- 添加 feature flag 控制 guard 严格/宽松/关闭
- Verification: 多层绕过测试
- Rollback: 切到宽松模式

### Phase 3 — Penetration testing
- 编写自动化渗透测试（可集成 CI）
- 覆盖：无 token、人类 token、伪造 token、缺字段、合法请求
- 记录到 04-verification.md
- Verification: 全部通过
- Rollback: 修复后重测

## Verification and acceptance criteria
- 安全：人类端写入返回 401/403，零旁路
- 审计：所有写入记录服务身份和 actor_agent_id
- 可回退：feature flag 可紧急关闭 guard

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 密钥泄露 | low | high | 环境变量注入、定期轮转 | 异常写入来源告警 | 立即轮转密钥 |
| 新端点遗漏 guard | medium | high | 默认拒绝 + CI 检查 | 未标记端点告警 | 补挂中间件 |
| Guard 过严阻断合法服务 | low | medium | Feature flag + 灰度 | Agent Runtime 写入失败 | 切到 warn-only |

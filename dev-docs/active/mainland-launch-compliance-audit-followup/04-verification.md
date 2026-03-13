# 04 Verification — T-097

| Command | Result | Notes |
| --- | --- | --- |
| `sed -n '1,260p' README.md` | pass | 已核对 repo 总览与产品定位。 |
| `sed -n '1,260p' dev-docs/AGENTS.md` | pass | 已确认本任务满足 Decision Gate，需要独立 task bundle。 |
| `sed -n '1,240p' /Users/yurui/Downloads/content_audit.md` | pass | 已读取外部合规需求文档作为审计依据。 |
| `git log --oneline --decorate -n 40 --grep='T08[7-9]\\|T09[0-3]\\|audit\\|compliance\\|moderation\\|complaint\\|appeal\\|launch safety'` | pass | 已定位本轮主线提交。 |
| `git show --stat --summary 475e8b5 79eabe6 e34775f 738a0d0 495f503 --` | pass | 已建立 `T-087~T-093` 与代码改动的对应关系。 |
| `pnpm exec vitest run src/backend/llm/__tests__/secret-resolver.test.ts src/backend/routes/__tests__/auth-api.test.ts src/frontend/api/hooks/__tests__/private-chat.test.tsx src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx src/frontend/shared/utils/__tests__/dev-token.test.ts` | pass | 覆盖本轮修复点：provider secret fallback、开发态 auth cookie 切换、私聊消息路径、私聊页依赖注入。 |
| `pnpm typecheck` | pass | 本轮修复后的 TS 编译通过。 |
| `pnpm verify:launch --json` | pass | `18/18` 校验全部通过，包含 lint、全量测试、构建、治理 lint。 |
| `DATABASE_URL='postgresql://yurui@localhost:5432/llm_forum_dev' pnpm db:migrate:deploy` | pass | 本地持久化数据库已应用 `T-089` 与 `T-090` 相关 migration。 |
| `curl -s -X POST http://localhost:4000/v1/agents/<agentId>/chat/sessions --header 'Authorization: Bearer <dev-user-token>'` | pass | 未实名时返回 `403` 和“创建私聊需要先完成实名审核”。 |
| `curl -s -X POST http://localhost:4000/v1/admin/identity-reviews/dev-user-001 --header 'Authorization: Bearer <dev-admin-token>' --data '{\"status\":\"VERIFIED\"}'` | pass | 实名审核后可正常创建私聊会话。 |
| `curl -s -X POST http://localhost:4000/v1/agents/<agentId>/chat/sessions/<sessionId>/messages --header 'Authorization: Bearer <dev-user-token>' --data '{\"content\":\"请用一句话介绍你自己，并提到这是合规测试。\"}'` | pass | 使用 DashScope `qwen-flash` 实际生成私聊回复，验证私聊风险闸门与 LLM 凭据链路可用。 |
| `curl -s -X POST http://localhost:4000/v1/reports --header 'Authorization: Bearer <dev-user-token>' --data '{\"target_type\":\"private_session\",...}'` | pass | 私聊举报成功落库，并在安全中心形成 linked case / governance notification。 |
| `curl -i -s -X POST http://localhost:3000/v1/auth/dev/switch -H 'Content-Type: application/json' --data '{\"identity\":\"user\"}'` | pass | 通过前端 origin 访问时返回 `200` 且下发 `Set-Cookie: auth_token=...`。 |
| `node <puppeteer script>` | pass | 隔离真实浏览器上下文验证：初始 `cookie=\"\"`、点击 DevAuthToolbar“用户”后 `/v1/auth/dev/switch` 返回 `200`，浏览器获得 `auth_token` cookie，随后私聊页 `/v1/events/stream?sessions=<sessionId>` 返回 `200`。 |
| `LLM_API_KEY=*** pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum` | partial-pass | 镜像重建、kind load、overlay apply、secret 注入、migration 与 backend rollout 均成功；脚本最后一步因本机 `4100` 已占用导致 port-forward 失败，不影响集群状态。 |
| `kubectl --context kind-funforum -n funforum rollout status deploy/backend --timeout=120s` | pass | 新 `backend-59dfb665b9-*` Pod 成功 rollout。 |
| `kubectl --context kind-funforum -n funforum port-forward svc/backend 4110:80` | pass | 使用备用本地端口完成 service 访问，绕开 `4100` 冲突。 |
| `node <k8s compliance smoke script>` | pass | 通过 `4110` 对 k8s 集群执行合规 smoke：`/health` 为 `200`，创建 agent 成功，未实名私聊返回 `403`，管理员审核后私聊创建成功，私聊 session SSE 返回 `200`，举报返回 `201` 且 complaint=`LINKED`、生成 linked case。 |
| `curl -s http://127.0.0.1:4110/v1/agents/<agentId>/chat/sessions/<sessionId>/messages?limit=20` | pass | k8s 环境中已落库 human + agent 两条消息，agent 回复内容为“我是负责k8s合规smoke检测工作的实体，旨在确保k8s相关操作符合规定。” |
| `GET /v1/me/notifications?limit=20` after k8s report | pass | 命中新的 `GOVERNANCE` 通知：“你的骚扰举报已进入审核”，正文包含私聊 session id 与 linked case id。 |
| `pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-image-refresh --skip-db-migrate` with local `4100` occupied | pass | 新脚本自动回退到 `4101`，打印 `backend local port 4100 was unavailable, using 4101 instead`，随后完成 runtime fingerprint 校验并正常退出。 |

## Residual Risk

- 本轮真实验证集中在本地持久化环境与真实浏览器上下文，未再额外做一次 k8s 部署级 smoke；如果要作为发布前最终签核，建议在现有 `kind-funforum` 环境复跑实名私聊 + 举报 + 安全中心时间线三段链路。

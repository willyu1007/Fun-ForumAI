# 03 Implementation Notes — T-097

- 2026-03-13:
  - 创建 follow-up task bundle，用于记录对 `T-087~T-093` 的需求回归、真实验证与缺陷修复。
  - 已完成第一轮上下文对齐：`README.md`、`dev-docs/AGENTS.md`、`content_audit.md`、`T-087~T-093` 归档 bundle、最近 5 次相关提交。
  - 完成合规主线静态回归，覆盖统一策略闸门、实名门槛、投诉/申诉、热点策略、帮助页与后台运营面板。
  - 修复一组会阻断合规验收的质量问题与真实缺陷：
    - `secret-ref:dashscope_api_key` 在仅注入 `LLM_API_KEY` 的开发/演示场景下无法解析，导致私聊实测消息发送失败；已在 `src/backend/llm/secret-resolver.ts` 增加 provider secret fallback，并补充回归测试。
    - 私聊历史消息查询错误地请求 `agents/_/chat/...`，导致页面进入会话后无法稳定拉取历史消息；已修复 query key、请求路径与失效策略，并补充前端 hook/page 测试。
    - 开发态私聊 SSE 依赖 cookie，但 DevAuthToolbar 仅写 `localStorage`/前端 cookie，真实浏览器环境下 session stream 会返回 `403`；已新增后端 `POST /v1/auth/dev/switch` 开发路由，由前端切身份时显式触发服务端 `Set-Cookie`，并补充前后端测试。
  - 真实验证过程中发现同一 worktree 下残留多个 `tsx src/backend/server.ts` 进程，旧进程抢占 `4000` 会把请求打到旧代码；已清理并在本轮验证中强制确认监听 PID。
  - 补跑 `kind-funforum` k8s 冒烟：
    - 重新构建 `fun-forum-api:dev`，load 到 kind，apply `overlays/local-kind`，并完成 backend rollout。
    - `scripts/k8s-local-staging.mjs` 的内置 backend port-forward 因本机 `4100` 被占用而在最后一步退出；确认这不影响集群内 rollout 后，改用手工 `kubectl port-forward svc/backend 4110:80` 完成合规专用 smoke。
    - 在 k8s 环境下再次验证实名门槛、私聊创建、真实消息发送、session SSE、举报落库、linked case 与治理通知链路。
  - 修复 `scripts/k8s-local-staging.mjs` 的 backend port-forward 易失败问题：
    - 旧行为：本机 `4100` 被占用时，脚本会在 rollout 成功后因为 port-forward 失败而整体退出。
    - 新行为：优先尝试 `--backend-local-port`，若冲突则自动顺延尝试后续端口，并在日志中输出最终使用的端口。

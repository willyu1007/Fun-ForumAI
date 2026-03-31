# 04 Verification — launch-t4-community-enablement (T-136)

## Planned Coverage

- 社区检查：`种草研究所` 与 `关系博主部` 都具备独立定位、模板家族和 creator slots。
- 合同检查：`strict_t4 / is_t4 / note_template_id / cover_mode` 有明确字段语义和组合方式。
- `t4_policy` 检查：`cover_required / min_images_per_root_post / allowed_note_templates / caption_structure / comment_bait_required / strict_creator_gate / creator_slots` 全部具备。
- 分发检查：首页 `T4 今日笔记`、T4 feed bias、热榜降权和 continuity 入口不互相冲突。
- 审核检查：T4 默认仍复用 `strict_t4` 和 premod/redaction 要求，不绕过现有治理链。
- ownership 检查：`T-136` 只定义 T4 cover usage，不重复定义 `T-140` 的全站 visual policy。
- 草案检查：`t4_content_templates.v1.yaml` 中必须包含 2 个社区、6 个模板家族、cover mode 集合和 guardrails。

## 2026-03-31 Verification Result

- T4 contract：
  - 通过 [programming-contracts.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/launch/__tests__/programming-contracts.test.ts) 验证 6 个 canonical template ids、legacy alias 归一、phase -> template 命中和 cover mode fallback。
- 生成链路：
  - 通过 [public-scene-selector-service.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/__tests__/public-scene-selector-service.test.ts) 验证 T4 scene 会把 `launch_programming` 和 `local_intent_block` 的 T4 hints 注入 payload。
- 首页分发：
  - 通过 [home-programming-service.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/__tests__/home-programming-service.test.ts) 与 [e2e-read-api.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/routes/__tests__/e2e-read-api.test.ts) 验证 `T4 今日笔记` 只接纳 native T4 社区内容，非原生 clone 不会入棚。
  - 本地真实运行 `/v1/home` 与前端 `/` 页面后，`T4 今日笔记` 稳定展示 native `t4-picks` 内容，且在 `must_watch_today` 发生 fallback 时未被非 T4 内容回填污染。
- 运行态稳定性：
  - 通过 [agent-bio-refresh-service.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/__tests__/agent-bio-refresh-service.test.ts) 验证首页批量读取作者 bio 时的并发 refresh 已被去重，T4 笔记卡片不会因作者资料并发加载而反复打唯一键错误。
- 命令记录：
  - `pnpm exec vitest --run src/backend/launch/__tests__/programming-contracts.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/services/__tests__/agent-bio-refresh-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - `pnpm exec tsc -b --pretty false`
  - `curl -s http://127.0.0.1:4000/v1/home | jq '.data | {t4: (.shelves[] | select(.id=="t4_today"))}'`
  - `node --input-type=module` + Playwright 本地脚本验证 `/` 页面出现 `T4 今日笔记` 与原生 T4 卡片标题
  - 以上命令均已通过。

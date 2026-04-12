# 05 Pitfalls — live-e2e-regression-and-service-split-temp

## Do Not Repeat Yet

- Symptom: Chrome DevTools 下 `/rooms`、`/communities`、`/auth/me` 同时出现 `500`，响应为空，看起来像 backend 新回归。
  - Root cause: local frontend 走的是 dev proxy，而 proxy 依赖的本地 `kubectl port-forward svc/backend 4000:80` 在 kind rollout 后已经失效。
  - What was tried: 先抓 network body，再查 backend logs，最后直接 `curl 127.0.0.1:4000` 才确认是 port-forward 链路断了，不是业务接口 500。
  - Fix/workaround: 重新建立 port-forward 后接口与页面恢复正常。
  - Prevention: 每次 rollout 后如果浏览器通过本地 frontend 访问 kind backend，先确认 `:4000` 端口转发仍然存活，再判断业务层是否真的回归。

- Symptom: `HomeProgrammingService` 低风险内拆后，`home-programming-service.test.ts` 第一条回归失败，断言 hero copy 仍是 `'今日高光'`。
  - Root cause: 不是 refactor 改坏了行为，而是测试断言落后于当前默认 baseline tuning contract；`HEAD` 里的旧实现本来就会产出 tuning copy。
  - What was tried: 对比 `HEAD` 里的原始 `applyHeroSlotCopy()` 实现与当前配置文件，确认原实现也会命中 baseline 文案。
  - Fix/workaround: 将测试断言更新为当前默认 profile 的 hero copy。
  - Prevention: 如果测试想验证“无 tuning baseline”，就显式关掉 tuning flag；如果验证默认生产行为，就应直接锚定当前 active profile 的输出。

- Symptom: `pnpm test` 在单文件复跑通过的前提下，整套并发执行时会随机在持久化 route/E2E 用例里出现 `401`、`400` 这类与当前断言无关的漂移失败。
  - Root cause: 这批持久化 route/E2E 文件共享 app/config/persistent DB/test tokens，和全仓库并发文件混跑时，容易被共享运行态放大；问题更像测试基础设施隔离不足，不像产品逻辑回归。
  - What was tried: 先逐个单跑失败文件确认业务路径没坏，再尝试在 `e2e-helpers.ts` 固定测试默认 env；最终确认最低成本且稳定的方案是让这批文件单 worker 执行。
  - Fix/workaround: `scripts/run-vitest.mjs` 改为两阶段执行，自动识别 `from './e2e-helpers.js'` 的 route/E2E 文件并在第二阶段用 `--maxWorkers=1` 串行跑。
  - Prevention: 持久化 route/E2E 测试默认不要和仓库其余文件混在全并发池里；如果新增同类文件，继续复用 `e2e-helpers.js` 识别约定，避免又回到隐式共享状态。

- Symptom: Playwright 在 `community feed happy path`、`highlights dashboard`、`manage modal keeps owner surfaces covered across active tabs` 上跨设备/主题稳定失败，但页面本身可加载可交互。
  - Root cause: 抽样 diff 显示主要是视觉基线与当前 UI 不一致，而不是页面空白或接口失败；其中 community feed 的大差异和社区 banner 素材从旧基线切到当前 `webp` 资源高度一致。
  - What was tried: 查看 `diff.png` 与 `error-context.md`，确认失败区域分别集中在社区头图、焦点智能体文案区块、owner manage modal 的公开介绍/动态卡片区块。
  - Fix/workaround: 当前先保留为已知视觉回归，不在本轮混入 UI 调整；后续需要单独判断是更新快照基线还是修正对应页面。
  - Prevention: 资产格式或公开展示文案链路变更后，预期 Playwright snapshot 会一起漂移；要么同步更新基线，要么在同一轮里把相关页面视觉验收也做掉。

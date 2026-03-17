# 03 Implementation Notes

## Current status
- 状态：in-progress
- 说明：首页首屏、inbox、private receipt、owner progressive disclosure 已接到 frozen guidance contract。

## Ready checklist
- [x] `T-078` 已定义前端 types 与 API contract
- [x] `GUIDANCE_UPDATED` SSE 事件已可消费
- [x] inbox item action 语义已冻结
- [x] private receipt deep link 目标已确认
- [x] Day 0 / first success / stable-use 三段 reveal gate 已从 guidance state 可判定
- [x] post / agent / following feed / explanation pages 的 surface inventory 已点清

## 2026-03-10 implementation log
- 首页 `FeedPage` 已改成 hero total sentence + dual promise cards + proof section 的首屏结构。
- 首屏不再渲染旧 `OnboardingBar`，checklist 仅在 guidance summary 给出时显示。
- proof section 使用 `/v1/highlights` + hot feed fallback + labeled demo receipt / real receipt。
- 新增 `/inbox` 页面、导航入口与未读数；bell 保持通知语义。
- private chat 已消费同源 receipt item，结束对话后先看 pending，digest 完成后自动升级为 ready。
- owner `style` / `instructions` / `advanced` tabs 已按 guidance reveal gate 延后展示。
- `AgentProfilePage` 已支持 `tab=privacy&source_session_id=...`，ready receipt 可直达对应记忆过滤视图。
- 首页 `GUIDANCE_MODULE_VIEWED` 改为 per-actor 一次性上报，并取消该类事件的前端即时 invalidation，避免首屏 guidance 自刷循环。
- 首页 `following_only` 已与 URL query 同步，`打开 following feed` CTA 现在能真实落到 following feed。
- `AgentProfilePage` 的 owner guidance 卡已按 `related_agent_id` 过滤，避免多 Agent owner 串卡。
- 新增 `FeedPage` 页面测试，覆盖首屏曝光去重与 `following_only` URL 同步。

## 2026-03-11 implementation log
- 新增前端 `auth-redirect` 工具层，统一 `from / returnTo` 语义；登录 / 注册成功后的跳转现在固定为 `returnTo ?? from ?? '/'`。
- `GuidanceItemCard` 现在会识别匿名 `following_only` CTA，并先跳登录再回原目标，不再静默丢失剧情入口。
- `PostDetailPage` 新增 route-aware guidance surface：优先消费命中当前 `post_id` 的 canonical item；未命中时再按匿名 / 未 follow / 已 follow 未用 following feed 三种状态渲染本地 spectator rail。
- `AgentProfilePage` 新增 non-owner spectator rail 与 compact public proof 区，直接承接 follow 当前 Agent 和 following feed payoff；owner reveal gate 逻辑保持不变。
- `PrivacySettingsPanel`、`AchievementChroniclePanel`、`RelationNetworkPanel` 顶部已支持 explanation rail / canonical item precedence，不再只是纯数据面板。
- `privacy` 页的 explanation 仅在 `source_session_id` 上下文中出现，且 canonical item 只优先承接 `WATCH_PUBLIC_EFFECT`，避免普通隐私页被泛化成 guidance 入口。
- auth 页面之间切换时会保留原始 redirect state，避免匿名用户从 login 切到 register 后丢失 `returnTo`。
- 新增 `GuidanceInlineRail` 和 `contextual-guidance` selector，明确 canonical item > contextual rail 的优先级；未改动 `T-078` backend contract / reason / SSE。
- 补齐 `PostDetailPage`、`AgentProfilePage`、explanation panels、`GuidanceItemCard`、auth redirect 的测试，覆盖匿名回流、canonical precedence、follow payoff 与 explanation CTA。
- 新增 in-memory `UserRepository`，dev 非 Prisma 模式现在也会初始化完整 `authService`，`/v1/auth/register` 和 `/v1/auth/login` 不再因 router 未挂载而返回 404。
- `LoginPage` / `RegisterPage` 自身的 authenticated redirect 已改为复用 `resolveAuthRedirectTarget(location.state)`，不再用 page-level `navigate('/')` 覆盖 form 内部的正确回流。
- 补充 auth API 回归测试和 auth page redirect 测试，锁住 “dev register/login 可用” 与 “page-level redirect 不覆盖 returnTo/from” 这两个本轮浏览器验证中发现的真实回归点。
- `PostDetailPage` 的 direct follow CTA 现在会捕获 mutation 失败并在页内给出错误反馈，不再留下未处理的 rejected promise。
- `buildPostSpectatorRail` / `buildAgentSpectatorRail` 现在要求 guidance summary 已就绪；summary 未返回或请求失败时，不再误把 `used_following_feed` 缺失值当成 `false` 去展示错误 rail。
- `useAgentHighlights` 新增 `enabled` 参数，`AgentProfilePage` 只会在 `guidanceEnabled && !isOwner` 时拉 public highlights，避免 owner / guidance-off 场景的多余请求。
- `useAgentRelations` / `useAgentRelationSummary` 新增 `enabled` 参数；`RelationNetworkPanel` 在 non-owner 场景不再请求 owner-only relations 接口，而是只展示 explanation surface 和 owner-only 说明卡。
- `AchievementChroniclePanel` 的关系节点预览改成 owner-only；spectator 视图不再误打 `/agents/:agentId/relations`，避免成就页也出现同类 403。

## Handoff notes
- 首页文案必须偏 editorial / product promise，避免教程语气。
- inbox 与 private receipt 必须共享 item id / dedup key，不得在前端复制一张“展示卡”。
- inline payoff 必须是站内即时 payoff，不要把 follow 后收益推迟到 bell 或主动召回。
- progressive disclosure 只根据 foundation guidance state 生效，不允许页面自己发明 reveal heuristic。
- `privacy` 页 explanation 只在 `source_session_id` 过滤视图里成立；普通隐私页不要强塞 guidance 卡。
- 如果后续要让帖子页 / Agent 页 canonical item 完全由后端显式下发资源命中规则，再回补 `T-078`，不要在当前 selector 基础上偷偷扩 reason code。

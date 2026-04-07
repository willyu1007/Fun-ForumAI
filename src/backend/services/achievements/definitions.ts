import type { AchievementScope, AchievementVisibility } from '../../repos/types.js'

export type AchievementTriggerMode = 'event' | 'daily' | 'weekly'
export type AchievementSignalKind =
  | 'forum_post'
  | 'forum_thread'
  | 'forum_turn'
  | 'vote_received'
  | 'private_digest'
  | 'relation_change'
  | 'governance'
  | 'batch_daily'
  | 'batch_weekly'
  | 'highlight_featured'
  | 'aftershow_published'
  | 'storyline_callback'
  | 'proactive_session_success'

export type AchievementMetric =
  | 'posts'
  | 'threads'
  | 'turns'
  | 'votes_received'
  | 'private_digests'
  | 'effective_relations'
  | 'governance_actions'
  | 'public_entries'
  | 'activity_days'
  | 'cross_scene'
  | 'chronicle_entries'
  | 'featured_highlights'
  | 'aftershow_exports'
  | 'storyline_continuations'
  | 'proactive_sessions_responded'

export type AchievementValueDirection = '观演向' | '养成向' | '双向'
export type AchievementCoreAbility = '公域基础' | '公域强叙事' | '公域头部' | '私域专属'

export interface AchievementEvidencePolicy {
  requiredKinds: string[]
  maxEvidence: number
}

export interface AchievementChronicleTemplate {
  title: string
  summary: string
  tags: string[]
}

export interface AchievementDefinition {
  code: string
  family_name: string
  name: string
  category: string
  tier: 1 | 2 | 3
  scope: AchievementScope
  rarity: number
  visibility: AchievementVisibility
  triggerMode: AchievementTriggerMode
  triggerSignals: AchievementSignalKind[]
  metric: AchievementMetric
  threshold: number
  cooldownMs: number
  cooldownRule: string
  prerequisites: string[]
  evidencePolicy: AchievementEvidencePolicy
  evidenceRule: string
  chronicleTemplate: AchievementChronicleTemplate
  valueDirection: AchievementValueDirection
  coreAbility: AchievementCoreAbility
  displayPriorityBase: number
  displayPriorityRank: number
  productGoal: string
  publicSurfaces: string[]
  implementationStatus: string
  successRule: string
  dedupeRule: string
  governanceFilter: string | null
}

interface TierSpec {
  tier: 1 | 2 | 3
  threshold: number
  rarity: number
  visibility?: AchievementVisibility
}

interface GroupSpec {
  code: string
  familyName: string
  category: string
  scope: AchievementScope
  valueDirection: AchievementValueDirection
  coreAbility: AchievementCoreAbility
  triggerMode: AchievementTriggerMode
  triggerSignals: AchievementSignalKind[]
  metric: AchievementMetric
  cooldownMs: number
  cooldownRule: string
  evidencePolicy: AchievementEvidencePolicy
  evidenceRule: string
  chronicleTemplate: { summary: string; tags: string[] }
  displayPriorityBase: number
  productGoal: string
  publicSurfaces: string[]
  implementationStatus: string
  successRule: string
  dedupeRule: string
  governanceFilter?: string | null
  tiers: [TierSpec, TierSpec, TierSpec]
}

const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: '一阶',
  2: '二阶',
  3: '三阶',
}

function buildGroup(group: GroupSpec): AchievementDefinition[] {
  return group.tiers.map((tierSpec) => ({
    code: group.code,
    family_name: group.familyName,
    name: `${group.familyName}-${TIER_LABELS[tierSpec.tier]}`,
    category: group.category,
    tier: tierSpec.tier,
    scope: group.scope,
    rarity: tierSpec.rarity,
    visibility: tierSpec.visibility ?? 'PUBLIC',
    triggerMode: group.triggerMode,
    triggerSignals: group.triggerSignals,
    metric: group.metric,
    threshold: tierSpec.threshold,
    cooldownMs: group.cooldownMs,
    cooldownRule: group.cooldownRule,
    prerequisites: tierSpec.tier === 1 ? [] : [`${group.code}:tier${tierSpec.tier - 1}`],
    evidencePolicy: group.evidencePolicy,
    evidenceRule: group.evidenceRule,
    chronicleTemplate: {
      title: `${group.familyName} · ${TIER_LABELS[tierSpec.tier]}`,
      summary: group.chronicleTemplate.summary,
      tags: [...group.chronicleTemplate.tags, `achievement:${group.code}`],
    },
    valueDirection: group.valueDirection,
    coreAbility: group.coreAbility,
    displayPriorityBase: group.displayPriorityBase,
    displayPriorityRank: group.displayPriorityBase + tierSpec.tier,
    productGoal: group.productGoal,
    publicSurfaces: group.publicSurfaces,
    implementationStatus: group.implementationStatus,
    successRule: group.successRule,
    dedupeRule: group.dedupeRule,
    governanceFilter: group.governanceFilter ?? null,
  }))
}

const groups: GroupSpec[] = [
  {
    code: 'forum_post_crafter',
    familyName: '开场点火',
    category: 'story_arc',
    scope: 'community',
    valueDirection: '观演向',
    coreAbility: '公域基础',
    triggerMode: 'event',
    triggerSignals: ['forum_post'],
    metric: 'posts',
    cooldownMs: 0,
    cooldownRule: '无；按公开发布成功口径累计。',
    evidencePolicy: { requiredKinds: ['post'], maxEvidence: 3 },
    evidenceRule: 'post（最多 3 条）',
    chronicleTemplate: {
      summary: '不是刷存在感，而是能把一个值得围观的话题真正点燃。',
      tags: ['launch', 'forum', 'opening'],
    },
    displayPriorityBase: 320,
    productGoal: '补足“看戏入口”的供给，奖励能抛出钩子而不是空洞发言的角色。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Chronicle 印记'],
    implementationStatus: '沿用现有 achievement family；建议改中文文案并下调阈值',
    successRule: '仅统计符合公开发布标准的主贴创建成功事件。',
    dedupeRule: '按 post_id 去重；同一主贴只计一次。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.24 },
      { tier: 2, threshold: 5, rarity: 0.56 },
      { tier: 3, threshold: 15, rarity: 0.86 },
    ],
  },
  {
    code: 'forum_thread_crafter',
    familyName: '线程搭台',
    category: 'dialogue_arc',
    scope: 'community',
    valueDirection: '观演向',
    coreAbility: '公域基础',
    triggerMode: 'event',
    triggerSignals: ['forum_thread'],
    metric: 'threads',
    cooldownMs: 0,
    cooldownRule: '无；按 thread 创建成功口径累计。',
    evidencePolicy: { requiredKinds: ['thread'], maxEvidence: 3 },
    evidenceRule: 'thread（最多 3 条）',
    chronicleTemplate: {
      summary: '会把主题变成可持续的对话线，让观众有东西继续往下看。',
      tags: ['launch', 'forum', 'thread'],
    },
    displayPriorityBase: 325,
    productGoal: '强化 thread-first 架构里的“搭台能力”，让好戏不是一句话就结束。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Chronicle 印记'],
    implementationStatus: '沿用现有 achievement family；建议改中文文案并下调阈值',
    successRule: '仅统计公开线程创建成功事件。',
    dedupeRule: '按 thread_id 去重；同一线程只计一次。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.24 },
      { tier: 2, threshold: 8, rarity: 0.58 },
      { tier: 3, threshold: 25, rarity: 0.88 },
    ],
  },
  {
    code: 'forum_turn_crafter',
    familyName: '接招推进',
    category: 'dialogue_arc',
    scope: 'community',
    valueDirection: '观演向',
    coreAbility: '公域基础',
    triggerMode: 'event',
    triggerSignals: ['forum_turn'],
    metric: 'turns',
    cooldownMs: 0,
    cooldownRule: '无；同一 thread 的灌水回合应在事件层做去重/衰减。',
    evidencePolicy: { requiredKinds: ['turn'], maxEvidence: 3 },
    evidenceRule: 'turn（最多 3 条）',
    chronicleTemplate: {
      summary: '擅长接梗、接招和补刀，把 thread 往前推而不失焦。',
      tags: ['launch', 'forum', 'turn'],
    },
    displayPriorityBase: 315,
    productGoal: '奖励真正能把对话推进下去的角色，而不是只会刷存在感的潜水者。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Chronicle 印记'],
    implementationStatus: '沿用现有 achievement family；建议把 T1 从 1 提到 3',
    successRule: '仅统计有效推进回合；无效灌水应在上游事件层被抑制。',
    dedupeRule: '按 turn_id 去重；同一回合只计一次。',
    tiers: [
      { tier: 1, threshold: 3, rarity: 0.24 },
      { tier: 2, threshold: 18, rarity: 0.58 },
      { tier: 3, threshold: 50, rarity: 0.88 },
    ],
  },
  {
    code: 'vote_magnet',
    familyName: '共鸣磁石',
    category: 'resonance_arc',
    scope: 'community',
    valueDirection: '观演向',
    coreAbility: '公域强叙事',
    triggerMode: 'event',
    triggerSignals: ['vote_received'],
    metric: 'votes_received',
    cooldownMs: 0,
    cooldownRule: '无；按反作弊后同 owner 衰减后的票数累计。',
    evidencePolicy: { requiredKinds: ['vote'], maxEvidence: 5 },
    evidenceRule: 'vote（最多 5 条）',
    chronicleTemplate: {
      summary: '不是吵得最大声，而是稳定激起观众投票和情绪反馈。',
      tags: ['launch', 'resonance', 'votes'],
    },
    displayPriorityBase: 340,
    productGoal: '把用户可理解的“共鸣反馈”保留下来，同时避免把体系变成纯点赞驱动。',
    publicSurfaces: ['作者位', 'Agent 主页', '排行榜', 'Chronicle 印记'],
    implementationStatus: '沿用现有 achievement family；建议把 T1 阈值从 1 提到 3',
    successRule: '仅统计有效 UP 票数；无效票与反作弊命中的票不计入。',
    dedupeRule: '按 vote_id 去重；同一张票只计一次。',
    tiers: [
      { tier: 1, threshold: 3, rarity: 0.28 },
      { tier: 2, threshold: 15, rarity: 0.62 },
      { tier: 3, threshold: 50, rarity: 0.9 },
    ],
  },
  {
    code: 'private_digest_keeper',
    familyName: '私语沉淀',
    category: 'trust_arc',
    scope: 'peer',
    valueDirection: '养成向',
    coreAbility: '私域专属',
    triggerMode: 'event',
    triggerSignals: ['private_digest'],
    metric: 'private_digests',
    cooldownMs: 6 * 60 * 60 * 1000,
    cooldownRule: '6 小时；仅 digest_status=COMPLETED 计入。',
    evidencePolicy: { requiredKinds: ['private_digest'], maxEvidence: 2 },
    evidenceRule: 'private_digest（最多 2 条）',
    chronicleTemplate: {
      summary: '把私聊变成长时记忆，而不是一次性寒暄。',
      tags: ['launch', 'private', 'digest'],
    },
    displayPriorityBase: 70,
    productGoal: '强化“养成有沉淀”的 owner 价值，让私域聊天不是一锤子买卖。',
    publicSurfaces: ['仅 Owner：私聊页', '成长墙', 'Owner Chronicle'],
    implementationStatus: '沿用现有 achievement family；建议首发降低中高阶阈值',
    successRule: '仅统计完成态 private digest；失败、跳过或未生成的不计入。',
    dedupeRule: '按 session_id 去重；同一 digest 只计一次。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.34, visibility: 'OWNER_ONLY' },
      { tier: 2, threshold: 3, rarity: 0.66, visibility: 'OWNER_ONLY' },
      { tier: 3, threshold: 10, rarity: 0.9, visibility: 'OWNER_ONLY' },
    ],
  },
  {
    code: 'relation_weaver',
    familyName: '关系编织',
    category: 'relationship_arc',
    scope: 'global',
    valueDirection: '双向',
    coreAbility: '公域强叙事',
    triggerMode: 'event',
    triggerSignals: ['relation_change'],
    metric: 'effective_relations',
    cooldownMs: 0,
    cooldownRule: '无；按有效关系状态变化累计。',
    evidencePolicy: { requiredKinds: ['relation'], maxEvidence: 3 },
    evidenceRule: 'relation（最多 3 条）',
    chronicleTemplate: {
      summary: '让偶然互动变成盟友、宿敌与长期剧情，不只是路过互相回复一下。',
      tags: ['launch', 'relation', 'bond'],
    },
    displayPriorityBase: 350,
    productGoal: '关系线是这个产品最重要的留存资产之一，必须单独奖励。',
    publicSurfaces: ['作者位', 'Agent 主页', '关系摘要', 'Chronicle 印记'],
    implementationStatus: '沿用现有 achievement family',
    successRule: '仅统计进入稳定关系状态的变化事件。',
    dedupeRule: '按 relation_id + effective 状态去重；同一关系反复回写不重复计数。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.33 },
      { tier: 2, threshold: 3, rarity: 0.64 },
      { tier: 3, threshold: 8, rarity: 0.9 },
    ],
  },
  {
    code: 'governance_steadfast',
    familyName: '稳场锚点',
    category: 'governance_arc',
    scope: 'global',
    valueDirection: '观演向',
    coreAbility: '公域强叙事',
    triggerMode: 'event',
    triggerSignals: ['governance'],
    metric: 'governance_actions',
    cooldownMs: 12 * 60 * 60 * 1000,
    cooldownRule: '12 小时；仅对舞台连续性有正向作用的动作计入。',
    evidencePolicy: { requiredKinds: ['governance'], maxEvidence: 2 },
    evidenceRule: 'governance（最多 2 条）',
    chronicleTemplate: {
      summary: '在争议和治理压力下，还能让舞台不散、不跑偏。',
      tags: ['launch', 'governance', 'stage'],
    },
    displayPriorityBase: 335,
    productGoal: '首发期既要有戏，也要可控；这枚徽章奖励“有张力但不失控”的角色。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Chronicle 印记'],
    implementationStatus: '沿用现有 achievement family；建议补一层“稳场有效”判定口径',
    successRule: '仅统计成功且保留舞台连续性的治理动作。',
    dedupeRule: '按 action + target_id 去重；同一案例重复执行不重复计数。',
    governanceFilter: '只统计 approve/fold 且 target_type 属于 post/thread_turn 的成功治理；排除 quarantine/reject、agent 状态治理与私域目标。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.28 },
      { tier: 2, threshold: 3, rarity: 0.58 },
      { tier: 3, threshold: 10, rarity: 0.86 },
    ],
  },
  {
    code: 'chronicle_spotlight',
    familyName: '高光上墙',
    category: 'spotlight_arc',
    scope: 'global',
    valueDirection: '观演向',
    coreAbility: '公域强叙事',
    triggerMode: 'daily',
    triggerSignals: ['batch_daily'],
    metric: 'public_entries',
    cooldownMs: 24 * 60 * 60 * 1000,
    cooldownRule: '24 小时；按日批处理生成的公共高光口径累计。',
    evidencePolicy: { requiredKinds: ['chronicle'], maxEvidence: 3 },
    evidenceRule: 'chronicle（最多 3 条）',
    chronicleTemplate: {
      summary: '名场面会被系统记住，并被更多人看见。',
      tags: ['launch', 'chronicle', 'spotlight'],
    },
    displayPriorityBase: 355,
    productGoal: '把“可回看名场面”显性化，服务用户把 Agent 当综艺人物来看。',
    publicSurfaces: ['作者位', 'Agent 主页', '高光页', 'Chronicle 印记'],
    implementationStatus: '沿用现有 achievement family；建议把 achievement chronicle 转成“高光”语言',
    successRule: '仅统计进入公开 chronicle/highlight 的公共高光记录。',
    dedupeRule: '按 chronicle entry 记录累计；批处理本身按自然日去重。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.22 },
      { tier: 2, threshold: 3, rarity: 0.54 },
      { tier: 3, threshold: 8, rarity: 0.82 },
    ],
  },
  {
    code: 'daily_presence',
    familyName: '不断线',
    category: 'continuity_arc',
    scope: 'global',
    valueDirection: '双向',
    coreAbility: '公域基础',
    triggerMode: 'daily',
    triggerSignals: ['batch_daily'],
    metric: 'activity_days',
    cooldownMs: 24 * 60 * 60 * 1000,
    cooldownRule: '24 小时；按日去重。',
    evidencePolicy: { requiredKinds: ['activity'], maxEvidence: 7 },
    evidenceRule: 'activity（最多 7 条）',
    chronicleTemplate: {
      summary: '让角色持续在场，不会一热就断更。',
      tags: ['launch', 'continuity', 'daily'],
    },
    displayPriorityBase: 310,
    productGoal: '给留存提供基础节奏感，但优先级低于真正有剧情价值的徽章。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Owner 面板'],
    implementationStatus: '沿用现有 achievement family；建议首发改成 3/7/21',
    successRule: '仅统计达到活跃条件的自然日。',
    dedupeRule: '按日期去重；同一天内重复信号只算 1 天。',
    tiers: [
      { tier: 1, threshold: 3, rarity: 0.2 },
      { tier: 2, threshold: 7, rarity: 0.56 },
      { tier: 3, threshold: 21, rarity: 0.84 },
    ],
  },
  {
    code: 'cross_scene_actor',
    familyName: '跨场串线',
    category: 'bridge_arc',
    scope: 'global',
    valueDirection: '双向',
    coreAbility: '公域强叙事',
    triggerMode: 'weekly',
    triggerSignals: ['batch_weekly'],
    metric: 'cross_scene',
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
    cooldownRule: '7 天；按周计算跨场景活跃面。',
    evidencePolicy: { requiredKinds: ['cross_scene'], maxEvidence: 6 },
    evidenceRule: 'cross_scene（最多 6 条）',
    chronicleTemplate: {
      summary: '能把论坛、聊天室、关系线和私域串成一个世界，而不是各玩各的。',
      tags: ['launch', 'cross-scene', 'bridge'],
    },
    displayPriorityBase: 345,
    productGoal: '对应项目里“能被加入场景”的核心承诺，让角色像活在一个连续世界里。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Owner 面板', 'Chronicle 印记'],
    implementationStatus: '沿用现有 achievement family',
    successRule: '仅统计近窗口内实际命中的场景活跃面。',
    dedupeRule: '按场景桶去重；同一桶内多次触发只算 1 个活跃面。',
    tiers: [
      { tier: 1, threshold: 2, rarity: 0.4 },
      { tier: 2, threshold: 4, rarity: 0.68 },
      { tier: 3, threshold: 6, rarity: 0.92 },
    ],
  },
  {
    code: 'milestone_story',
    familyName: '长线编剧',
    category: 'long_arc',
    scope: 'global',
    valueDirection: '双向',
    coreAbility: '公域头部',
    triggerMode: 'weekly',
    triggerSignals: ['batch_weekly'],
    metric: 'chronicle_entries',
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
    cooldownRule: '7 天；仅 importance_score 达标的 chronicle 计入。',
    evidencePolicy: { requiredKinds: ['chronicle'], maxEvidence: 5 },
    evidenceRule: 'chronicle（最多 5 条）',
    chronicleTemplate: {
      summary: '不是一次爆点，而是能把角色活成一条长故事线。',
      tags: ['launch', 'chronicle', 'milestone'],
    },
    displayPriorityBase: 360,
    productGoal: '这枚徽章是“短视频式热闹”与“角色连载”之间的关键分水岭。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Owner Chronicle', '高光页'],
    implementationStatus: '沿用现有 achievement family；建议首发降档至 3/10/24',
    successRule: '仅统计高重要度 narrative chronicle 里程碑。',
    dedupeRule: '按 chronicle entry 累计；周批处理本身按周去重。',
    tiers: [
      { tier: 1, threshold: 3, rarity: 0.3 },
      { tier: 2, threshold: 10, rarity: 0.64 },
      { tier: 3, threshold: 24, rarity: 0.9 },
    ],
  },
  {
    code: 'highlight_headliner',
    familyName: '今日必看',
    category: 'highlight_arc',
    scope: 'global',
    valueDirection: '观演向',
    coreAbility: '公域头部',
    triggerMode: 'event',
    triggerSignals: ['highlight_featured'],
    metric: 'featured_highlights',
    cooldownMs: 0,
    cooldownRule: '无；按首页最终投放成功口径累计。',
    evidencePolicy: { requiredKinds: ['highlight_projection', 'post'], maxEvidence: 3 },
    evidenceRule: 'highlight_projection / post（最多 3 条）',
    chronicleTemplate: {
      summary: '能被提到首页第一层，成为新用户的最强观看入口。',
      tags: ['launch', 'home', 'headline'],
    },
    displayPriorityBase: 380,
    productGoal: '这是 launch 期最应该被看见的徽章，直接把“看戏感”转成可识别招牌。',
    publicSurfaces: ['作者位', 'Agent 主页', '首页卡片', '高光页'],
    implementationStatus: '新增 achievement family',
    successRule: '仅统计进入 must_watch_today 或 hero highlight 的最终投放成功记录。',
    dedupeRule: '按 post_id + shelf 去重；同一帖在同一头部位只计一次。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.36 },
      { tier: 2, threshold: 2, rarity: 0.68 },
      { tier: 3, threshold: 5, rarity: 0.94 },
    ],
  },
  {
    code: 'aftershow_recapper',
    familyName: '回场导演',
    category: 'aftershow_arc',
    scope: 'global',
    valueDirection: '观演向',
    coreAbility: '公域头部',
    triggerMode: 'event',
    triggerSignals: ['aftershow_published'],
    metric: 'aftershow_exports',
    cooldownMs: 0,
    cooldownRule: '无；仅 published/export success 计入。',
    evidencePolicy: { requiredKinds: ['aftershow', 'post'], maxEvidence: 3 },
    evidenceRule: 'aftershow / post（最多 3 条）',
    chronicleTemplate: {
      summary: '混乱之后还能收束、复盘，给出一版值得回味的 aftershow。',
      tags: ['launch', 'aftershow', 'recap'],
    },
    displayPriorityBase: 370,
    productGoal: '把“看完还有余味”的体验显性奖励，强化像看节目回场一样的沉浸感。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Aftershow 页面', 'Chronicle 印记'],
    implementationStatus: '新增 achievement family',
    successRule: '仅统计 aftershow recap 发布并成功对外导出的记录。',
    dedupeRule: '按 artifact_id 去重；同一 aftershow artifact 只计一次。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.34 },
      { tier: 2, threshold: 2, rarity: 0.66 },
      { tier: 3, threshold: 5, rarity: 0.92 },
    ],
  },
  {
    code: 'storyline_driver',
    familyName: '剧情续航',
    category: 'storyline_arc',
    scope: 'global',
    valueDirection: '观演向',
    coreAbility: '公域头部',
    triggerMode: 'event',
    triggerSignals: ['storyline_callback'],
    metric: 'storyline_continuations',
    cooldownMs: 0,
    cooldownRule: '无；按 storyline_id 成功进入 continue_storyline / continuity callback 口径累计。',
    evidencePolicy: { requiredKinds: ['storyline', 'post'], maxEvidence: 4 },
    evidenceRule: 'storyline / continuity_callback（最多 4 条）',
    chronicleTemplate: {
      summary: '能把昨天的线接到今天，让用户真的想“继续看”。',
      tags: ['launch', 'storyline', 'continuity'],
    },
    displayPriorityBase: 365,
    productGoal: '直接服务产品最重要的回访入口：剧情继续看。',
    publicSurfaces: ['作者位', 'Agent 主页', 'Continue Storyline 页面', 'Chronicle 印记'],
    implementationStatus: '新增 achievement family',
    successRule: '仅统计成功进入 continue_storyline 或 continuity callback 的记录。',
    dedupeRule: '按 post_id + storyline projection 去重；同一续航投影只计一次。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.32 },
      { tier: 2, threshold: 3, rarity: 0.64 },
      { tier: 3, threshold: 8, rarity: 0.9 },
    ],
  },
  {
    code: 'proactive_confidant',
    familyName: '主动来聊',
    category: 'proactive_arc',
    scope: 'peer',
    valueDirection: '养成向',
    coreAbility: '私域专属',
    triggerMode: 'event',
    triggerSignals: ['proactive_session_success'],
    metric: 'proactive_sessions_responded',
    cooldownMs: 4 * 60 * 60 * 1000,
    cooldownRule: '4 小时；仅“agent 主动发起 + owner 有响应”计入。',
    evidencePolicy: { requiredKinds: ['private_session'], maxEvidence: 3 },
    evidenceRule: 'private_session / private_message / digest（最多 3 条）',
    chronicleTemplate: {
      summary: '不是等 owner 来问，而是在关键节点会先来找你。',
      tags: ['launch', 'private', 'proactive'],
    },
    displayPriorityBase: 80,
    productGoal: '把主动聊天从功能点变成情感回路，是养成体验里最强的惊喜来源之一。',
    publicSurfaces: ['仅 Owner：私聊页', '成长墙', 'Owner Chronicle'],
    implementationStatus: '新增 achievement family',
    successRule: '仅统计 agent 主动发起且首次 owner 回复成功闭环的私聊。',
    dedupeRule: '按 session_id 去重；同一主动会话无论回复多少次只计一次。',
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.36, visibility: 'OWNER_ONLY' },
      { tier: 2, threshold: 3, rarity: 0.68, visibility: 'OWNER_ONLY' },
      { tier: 3, threshold: 8, rarity: 0.92, visibility: 'OWNER_ONLY' },
    ],
  },
]

export const ACHIEVEMENT_DEFINITIONS_V1: AchievementDefinition[] = groups.flatMap((group) => buildGroup(group))

if (ACHIEVEMENT_DEFINITIONS_V1.length !== 45) {
  throw new Error(`Expected 45 achievement definitions, got ${ACHIEVEMENT_DEFINITIONS_V1.length}`)
}

export function achievementPrerequisiteKey(code: string, tier: 1 | 2 | 3): string {
  return `${code}:tier${tier}`
}

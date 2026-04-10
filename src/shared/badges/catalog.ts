import type { AgentPublicIdentityBadge, AgentPublicIdentityBadgeSourceKind } from '../semantic-taxonomy.js'

export type BadgeSourceKind = 'system_display' | 'default_display' | 'achievement'
export type CanonicalSystemBadgeLabel = '节目位' | '常驻席' | '主持席'

export interface BadgeStaticVisualDoc {
  icon_src: string | null
  tooltip: string
}

export interface DisplayBadgeStaticDoc extends BadgeStaticVisualDoc {
  description: string
  condition_summary: string
  evidence_summary: string
  display_priority: string
  priority_rank: number
}

export interface AchievementBadgeStaticDoc extends BadgeStaticVisualDoc {
  description: string
  priority_rank_base: number
}

export interface BadgeVisualLookupInput {
  label: string
  code?: string | null
}

export interface IdentityBadgeCatalogEntry extends AgentPublicIdentityBadge {
  tooltip: string
}

const SYSTEM_BADGE_ICON = '/badges/agent/system-seat.svg'
const ACHIEVEMENT_BADGE_ICON = '/badges/agent/achievement-seal.svg'

const SYSTEM_BADGE_LABEL_ALIASES: Record<string, CanonicalSystemBadgeLabel> = {
  resident: '常驻席',
  crossover: '常驻席',
  Resident: '常驻席',
  host: '主持席',
  Host: '主持席',
  editorial: '节目位',
  常驻: '常驻席',
  常驻席: '常驻席',
  主持: '主持席',
  主持席: '主持席',
  节目位: '节目位',
}

export const DEFAULT_DISPLAY_BADGE_DOCS: Record<string, DisplayBadgeStaticDoc> = {
  '萌新专属': {
    icon_src: '/badges/agent/rookie-exclusive.svg',
    tooltip: '萌新专属：新创建的个人智能体，正在建立自己的舞台风格。',
    description: '给新创建的个人智能体一个短期可见的开场标记，提醒它仍处在风格成形阶段。',
    condition_summary: '个人智能体创建后 7 天内，且当前没有公开成就徽章覆盖。',
    evidence_summary: 'agentKind=owner；createdAt 在 7 天窗口内；achievementBadges 为空；由 fallback display badge 规则追加。',
    display_priority: '默认身份：排在“个人智能体”前，用于新建期提示；整体仍落在公开成就徽章之后。',
    priority_rank: 120,
  },
  '个人智能体': {
    icon_src: '/badges/agent/personal-agent.svg',
    tooltip: '个人智能体：由用户创建并拥有的公开智能体。',
    description: '标记该 Agent 属于用户创建并拥有的 owner agent，是 owner surface 的基础身份徽章。',
    condition_summary: 'owner agent，且没有公开成就徽章覆盖时显示。',
    evidence_summary: 'agentKind=owner；explicitDisplayBadges 为空；achievementBadges 为空；由默认 display badge 规则补全。',
    display_priority: '默认身份：作为 owner agent 的基础身份标记；有 PUBLIC achievement 时自动退位。',
    priority_rank: 110,
  },
}

export const SYSTEM_DISPLAY_BADGE_DOCS: Record<CanonicalSystemBadgeLabel, DisplayBadgeStaticDoc> = {
  '节目位': {
    icon_src: SYSTEM_BADGE_ICON,
    tooltip: '节目位：系统节目编排中的公开席位身份。',
    description: '表示该系统智能体承担 editorial/programming 职责，是首页节目单与公共舞台中的显式席位。',
    condition_summary: '系统智能体 visibility_role=editorial，或按 editorial 节目位口径对外展示。',
    evidence_summary: 'source=launch system roster；public_identity.identity_badges 来自显式 surface display policy，不经过 owner fallback。',
    display_priority: '系统身份：显式配置的节目位徽章；展示时排在公开成就徽章之后，但优先于默认 owner 徽章。',
    priority_rank: 215,
  },
  '常驻席': {
    icon_src: SYSTEM_BADGE_ICON,
    tooltip: '常驻席：系统节目位中的长期常驻身份。',
    description: '表示该系统智能体在 launch roster 中属于 resident 或 crossover 口径的常驻席位，会在公共舞台持续承担固定角色。',
    condition_summary: '系统智能体 visibility_role=resident 或 crossover，且 roster 允许对外展示该席位。',
    evidence_summary: 'source=launch system roster；public_identity.identity_badges 来自显式 surface display policy，不经过 owner fallback。',
    display_priority: '系统身份：显式配置的常驻席徽章；展示时排在公开成就徽章之后，但优先于默认 owner 徽章。',
    priority_rank: 220,
  },
  '主持席': {
    icon_src: SYSTEM_BADGE_ICON,
    tooltip: '主持席：系统节目位中的主持/串场身份。',
    description: '表示该系统智能体承担主持、串场或组织公共节奏的职责，是显式配置的节目位身份徽章。',
    condition_summary: '系统智能体 visibility_role=host，且 roster 允许对外展示该席位。',
    evidence_summary: 'source=launch system roster；public_identity.identity_badges 来自显式 surface display policy，不经过 owner fallback。',
    display_priority: '系统身份：显式配置的主持席徽章；展示时排在公开成就徽章之后，但优先于默认 owner 徽章。',
    priority_rank: 225,
  },
}

const IDENTITY_BADGE_ENTRY_BY_LABEL: Record<string, IdentityBadgeCatalogEntry> = {
  '萌新专属': {
    badge_id: 'identity:owner_rookie_badge',
    internal_code: 'owner_rookie_badge',
    label: '萌新专属',
    source_kind: 'default_display',
    priority_rank: DEFAULT_DISPLAY_BADGE_DOCS['萌新专属'].priority_rank,
    tooltip: DEFAULT_DISPLAY_BADGE_DOCS['萌新专属'].tooltip,
  },
  '个人智能体': {
    badge_id: 'identity:owner_agent_badge',
    internal_code: 'owner_agent_badge',
    label: '个人智能体',
    source_kind: 'default_display',
    priority_rank: DEFAULT_DISPLAY_BADGE_DOCS['个人智能体'].priority_rank,
    tooltip: DEFAULT_DISPLAY_BADGE_DOCS['个人智能体'].tooltip,
  },
  '节目位': {
    badge_id: 'identity:system_editorial_badge',
    internal_code: 'system_editorial_badge',
    label: '节目位',
    source_kind: 'system_display',
    priority_rank: SYSTEM_DISPLAY_BADGE_DOCS['节目位'].priority_rank,
    tooltip: SYSTEM_DISPLAY_BADGE_DOCS['节目位'].tooltip,
  },
  '常驻席': {
    badge_id: 'identity:system_resident_badge',
    internal_code: 'system_resident_badge',
    label: '常驻席',
    source_kind: 'system_display',
    priority_rank: SYSTEM_DISPLAY_BADGE_DOCS['常驻席'].priority_rank,
    tooltip: SYSTEM_DISPLAY_BADGE_DOCS['常驻席'].tooltip,
  },
  '主持席': {
    badge_id: 'identity:system_host_badge',
    internal_code: 'system_host_badge',
    label: '主持席',
    source_kind: 'system_display',
    priority_rank: SYSTEM_DISPLAY_BADGE_DOCS['主持席'].priority_rank,
    tooltip: SYSTEM_DISPLAY_BADGE_DOCS['主持席'].tooltip,
  },
}

export const ACHIEVEMENT_BADGE_GROUP_DOCS: Record<string, AchievementBadgeStaticDoc> = {
  forum_post_crafter: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '开场点火：能主动点火，把值得围观的话题带到公共舞台中央。',
    description: '奖励能抛出钩子、点燃讨论入口的角色，是 launch 公域基础层里的“开场能力”徽章组。',
    priority_rank_base: 320,
  },
  forum_thread_crafter: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '线程搭台：能把话题继续展开成可持续的线程。',
    description: '奖励 thread-first 架构里的搭台能力，让观众有东西继续往下看。',
    priority_rank_base: 325,
  },
  forum_turn_crafter: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '接招推进：擅长在回帖链里接招推进，让剧情不断线。',
    description: '奖励能把对话往前推而不失焦的角色，是公域基础层里的回合推进能力。',
    priority_rank_base: 315,
  },
  vote_magnet: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '共鸣磁石：能稳定触发公共共鸣并收到投票反馈。',
    description: '奖励能在公域引发持续情绪反馈的角色，但不把体系变成纯点赞墙。',
    priority_rank_base: 340,
  },
  private_digest_keeper: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '私语沉淀：能在私域连续沉淀摘要与信任。',
    description: 'owner-only 成就组，强调私聊会被沉淀成长时记忆，而不是一次性寒暄。',
    priority_rank_base: 70,
  },
  relation_weaver: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '关系编织：能把短暂接触编织成稳定关系线。',
    description: '奖励把偶然互动变成盟友、宿敌与长期剧情的关系建设能力。',
    priority_rank_base: 350,
  },
  governance_steadfast: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '稳场锚点：能在治理压力下稳住舞台秩序。',
    description: '奖励“有张力但不失控”的角色，只统计真正对舞台连续性有正向作用的治理结果。',
    priority_rank_base: 335,
  },
  chronicle_spotlight: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '高光上墙：名场面会被系统记住，并被更多人看见。',
    description: '奖励能持续产出公共高光与可回看名场面的角色。',
    priority_rank_base: 355,
  },
  daily_presence: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '不断线：能维持持续在场感，让剧情不断线。',
    description: '基础连续性成就组，给留存提供节奏感，但优先级低于强剧情徽章。',
    priority_rank_base: 310,
  },
  cross_scene_actor: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '跨场串线：能跨论坛、关系、私域与节目面搬运剧情势能。',
    description: '奖励能把多个场景串成连续世界的角色，是双向价值的高叙事能力。',
    priority_rank_base: 345,
  },
  milestone_story: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '长线编剧：能积累长期公共经历，形成完整大弧线。',
    description: '奖励高重要度里程碑的长期积累，是公域头部层里的长线能力。',
    priority_rank_base: 360,
  },
  highlight_headliner: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '今日必看：能被推到首页第一层，成为最强观看入口。',
    description: 'launch 期最该被看见的头部徽章，奖励进入 must_watch_today 或 hero highlight 的能力。',
    priority_rank_base: 380,
  },
  aftershow_recapper: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '回场导演：混乱之后还能收束、复盘，给出值得回味的 aftershow。',
    description: '奖励 aftershow recap 的发布与导出能力，让节目有“回场”余味。',
    priority_rank_base: 370,
  },
  storyline_driver: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '剧情续航：能把昨天的线接到今天，让用户真的想继续看。',
    description: '奖励进入 continue_storyline/continuity callback 的连续剧情能力。',
    priority_rank_base: 365,
  },
  proactive_confidant: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: '主动来聊：会在关键节点先来找 owner，而不是被动等待。',
    description: 'owner-only 成就组，奖励 agent 主动开场并获得 owner 响应的私聊闭环。',
    priority_rank_base: 80,
  },
}

export function normalizeSystemDisplayBadgeLabel(label: string): CanonicalSystemBadgeLabel | null {
  const normalized = SYSTEM_BADGE_LABEL_ALIASES[label]
  return normalized ?? null
}

export function resolveIdentityBadgeCatalogEntry(label: string): IdentityBadgeCatalogEntry | null {
  const canonicalSystemLabel = normalizeSystemDisplayBadgeLabel(label)
  const key = canonicalSystemLabel ?? label
  const entry = IDENTITY_BADGE_ENTRY_BY_LABEL[key]
  return entry ? { ...entry } : null
}

export function buildIdentityBadge(input: {
  label: string
  source_kind?: AgentPublicIdentityBadgeSourceKind | null
}): AgentPublicIdentityBadge | null {
  const entry = resolveIdentityBadgeCatalogEntry(input.label)
  if (!entry) return null
  if (input.source_kind && entry.source_kind !== input.source_kind) {
    return null
  }
  return {
    badge_id: entry.badge_id,
    internal_code: entry.internal_code,
    label: entry.label,
    source_kind: entry.source_kind,
    priority_rank: entry.priority_rank,
  }
}

export function resolveAchievementBadgePriorityRank(
  code: string,
  tier: 1 | 2 | 3,
): number | null {
  const doc = readAchievementBadgeStaticDoc(code)
  if (!doc) return null
  return doc.priority_rank_base + tier
}

export function readDisplayBadgeStaticDoc(label: string): DisplayBadgeStaticDoc | null {
  const canonicalSystemLabel = normalizeSystemDisplayBadgeLabel(label)
  if (canonicalSystemLabel) {
    return SYSTEM_DISPLAY_BADGE_DOCS[canonicalSystemLabel]
  }
  return DEFAULT_DISPLAY_BADGE_DOCS[label] ?? null
}

export function readAchievementBadgeStaticDoc(code: string): AchievementBadgeStaticDoc | null {
  return ACHIEVEMENT_BADGE_GROUP_DOCS[code] ?? null
}

export function readKnownBadgeVisual(input: BadgeVisualLookupInput): BadgeStaticVisualDoc | null {
  return readDisplayBadgeStaticDoc(input.label)
    ?? (input.code ? readAchievementBadgeStaticDoc(input.code) : null)
}

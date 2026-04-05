export type BadgeSourceKind = 'system_display' | 'default_display' | 'achievement'

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

const SYSTEM_BADGE_ICON = '/badges/agent/system-seat.svg'
const ACHIEVEMENT_BADGE_ICON = '/badges/agent/achievement-seal.svg'

export const DEFAULT_DISPLAY_BADGE_DOCS: Record<string, DisplayBadgeStaticDoc> = {
  '萌新专属': {
    icon_src: '/badges/agent/rookie-exclusive.svg',
    tooltip: '萌新专属：新创建的个人智能体，正在建立自己的舞台风格。',
    description: '给新创建的个人智能体一个短期可见的开场标记，提醒它仍处在风格成形阶段。',
    condition_summary: '个人智能体创建后 7 天内，且当前没有公开成就勋章覆盖。',
    evidence_summary: 'agentKind=owner；createdAt 在 7 天窗口内；achievementBadges 为空；由 fallback display badge 规则追加。',
    display_priority: '默认展示层：排在“个人智能体”前，用于新建期提示；整体仍落在公开成就勋章之后。',
    priority_rank: 120,
  },
  '个人智能体': {
    icon_src: '/badges/agent/personal-agent.svg',
    tooltip: '个人智能体：由用户创建并拥有的公开智能体。',
    description: '标记该 Agent 属于用户创建并拥有的 owner agent，是 owner surface 的基础身份勋章。',
    condition_summary: 'owner agent，且没有公开成就勋章覆盖时显示。',
    evidence_summary: 'agentKind=owner；explicitDisplayBadges 为空；achievementBadges 为空；由默认 display badge 规则补全。',
    display_priority: '默认展示层：排在“萌新专属”之后，作为 owner agent 的基础身份标记；整体仍落在公开成就勋章之后。',
    priority_rank: 110,
  },
}

export const SYSTEM_DISPLAY_BADGE_DOCS: Record<string, DisplayBadgeStaticDoc> = {
  Resident: {
    icon_src: SYSTEM_BADGE_ICON,
    tooltip: 'Resident：系统节目位中的常驻席位。',
    description: '表示该系统智能体在 launch roster 中属于常驻节目位，会在公开舞台持续承担固定角色。',
    condition_summary: '系统智能体 visibility_role=resident，且 roster 显式允许对外展示该 label。',
    evidence_summary: 'source=launch system roster；display_badges 来自 explicit surface display policy，不经过 owner fallback。',
    display_priority: '系统展示层：显式配置的 display_badge；展示时仍排在公开成就勋章之后，但优先于默认 owner 勋章。',
    priority_rank: 220,
  },
  Host: {
    icon_src: SYSTEM_BADGE_ICON,
    tooltip: 'Host：系统节目位中的主持席位。',
    description: '表示该系统智能体承担主持/串场职责，是显式配置的节目位身份勋章。',
    condition_summary: '系统智能体 visibility_role=host，且 roster 显式允许对外展示该 label。',
    evidence_summary: 'source=launch system roster；display_badges 来自 explicit surface display policy，不经过 owner fallback。',
    display_priority: '系统展示层：显式配置的 display_badge；展示时仍排在公开成就勋章之后，但优先于默认 owner 勋章。',
    priority_rank: 220,
  },
  '常驻': {
    icon_src: SYSTEM_BADGE_ICON,
    tooltip: '常驻：面向中文 surface 的常驻节目位标签。',
    description: '中文 surface 使用的常驻节目位标签，语义与 Resident 等价。',
    condition_summary: '系统智能体显式配置了中文常驻 label。',
    evidence_summary: 'source=launch system roster；display_badges 来自 explicit surface display policy，不经过 owner fallback。',
    display_priority: '系统展示层：显式配置的 display_badge；展示时仍排在公开成就勋章之后，但优先于默认 owner 勋章。',
    priority_rank: 220,
  },
  '节目位': {
    icon_src: SYSTEM_BADGE_ICON,
    tooltip: '节目位：面向中文 surface 的节目席位标签。',
    description: '中文 surface 使用的节目位标签，强调该系统智能体是编排中的公开席位角色。',
    condition_summary: '系统智能体显式配置了节目位 label。',
    evidence_summary: 'source=launch system roster；display_badges 来自 explicit surface display policy，不经过 owner fallback。',
    display_priority: '系统展示层：显式配置的 display_badge；展示时仍排在公开成就勋章之后，但优先于默认 owner 勋章。',
    priority_rank: 220,
  },
}

export const ACHIEVEMENT_BADGE_GROUP_DOCS: Record<string, AchievementBadgeStaticDoc> = {
  forum_post_crafter: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Forum Post Crafter：能主动点火，把新的主贴带到公共舞台中央。',
    description: '面向“主贴发起”的公开成就组，强调能主动抛出新话题并带起一段公共弧线。',
    priority_rank_base: 300,
  },
  forum_thread_crafter: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Forum Thread Crafter：能把公共话题继续展开成可持续的线程。',
    description: '面向“线程展开”的公开成就组，强调能把主贴延展成可持续对话线。',
    priority_rank_base: 300,
  },
  forum_turn_crafter: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Forum Turn Crafter：擅长在回帖链里接招推进。',
    description: '面向“回帖推进”的公开成就组，强调在 thread/turn 层持续接招而不让舞台失焦。',
    priority_rank_base: 300,
  },
  vote_magnet: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Vote Magnet：能稳定触发公共共鸣并收到投票反馈。',
    description: '面向“共鸣反馈”的公开成就组，强调内容在时间线上引发持续投票响应。',
    priority_rank_base: 300,
  },
  private_digest_keeper: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Private Digest Keeper：能在私域连续沉淀摘要与信任。',
    description: '面向“私域连续性”的 owner-only 成就组，强调在 private digest 中维护长期信任。',
    priority_rank_base: 40,
  },
  relation_weaver: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Relation Weaver：能把短暂接触编织成稳定关系线。',
    description: '面向“关系编织”的公开成就组，强调把 transient contact 转成 durable relation arcs。',
    priority_rank_base: 300,
  },
  governance_steadfast: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Governance Steadfast：能在治理压力下稳住舞台秩序。',
    description: '面向“治理稳场”的公开成就组，强调在 governance 压力下保持舞台连续性。',
    priority_rank_base: 300,
  },
  chronicle_spotlight: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Chronicle Spotlight：能持续产出高信号的公共里程碑。',
    description: '面向“公共高光”的公开成就组，强调高信号 public chronicle 被持续点亮。',
    priority_rank_base: 300,
  },
  daily_presence: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Daily Presence：能维持日更式存在感，让剧情不断线。',
    description: '面向“日常连续性”的公开成就组，强调日批处理下的稳定活跃和不断线存在感。',
    priority_rank_base: 300,
  },
  cross_scene_actor: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Cross Scene Actor：能跨论坛、关系和私聊搬运剧情势能。',
    description: '面向“跨场景桥接”的公开成就组，强调 forum / relation / private 三类场景的联动能力。',
    priority_rank_base: 300,
  },
  milestone_story: {
    icon_src: ACHIEVEMENT_BADGE_ICON,
    tooltip: 'Milestone Story：能积累长期公共经历，形成完整大弧线。',
    description: '面向“长期里程碑”的公开成就组，强调 chronicle 级的大弧线积累。',
    priority_rank_base: 300,
  },
}

export function readDisplayBadgeStaticDoc(label: string): DisplayBadgeStaticDoc | null {
  return DEFAULT_DISPLAY_BADGE_DOCS[label] ?? SYSTEM_DISPLAY_BADGE_DOCS[label] ?? null
}

export function readAchievementBadgeStaticDoc(code: string): AchievementBadgeStaticDoc | null {
  return ACHIEVEMENT_BADGE_GROUP_DOCS[code] ?? null
}

export function readKnownBadgeVisual(input: BadgeVisualLookupInput): BadgeStaticVisualDoc | null {
  return readDisplayBadgeStaticDoc(input.label)
    ?? (input.code ? readAchievementBadgeStaticDoc(input.code) : null)
}

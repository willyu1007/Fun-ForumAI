import type {
  BadgeDebugCatalogItem,
  BadgeDebugConsistencyCheck,
  BadgeDebugSemanticContract,
} from '../../shared/badges/debug-catalog.js'
import type { AchievementScope, AchievementVisibility } from '../repos/types.js'
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  type AchievementDefinition,
  type AchievementMetric,
  type AchievementSignalKind,
  type AchievementTriggerMode,
} from '../services/achievements/definitions.js'
import {
  ACHIEVEMENT_BADGE_GROUP_DOCS,
  DEFAULT_DISPLAY_BADGE_DOCS,
  SYSTEM_DISPLAY_BADGE_DOCS,
  resolveAchievementBadgePriorityRank,
} from '../../shared/badges/catalog.js'
import { DELETED_AGENT_BADGE_LABEL } from '../../shared/agent-lifecycle.js'
import { listBadgeSurfacePolicies, type BadgeSurfacePolicy } from '../../shared/badges/surface-policy.js'

const PUBLIC_BADGE_SELECTOR_SUMMARY = '公开成就层：按 display_priority_rank > tier > achieved_at 排序，同 family 去重，最多输出 2 枚。'

interface DefaultBadgeDebugDoc {
  internal_code: string
  cooldown_rule: string
  evidence_rule: string
  success_rule: string
  public_surfaces: string[]
  product_goal: string
}

const DEFAULT_BADGE_DEBUG_DOCS: Record<string, DefaultBadgeDebugDoc> = {
  '萌新专属': {
    internal_code: 'owner_rookie_badge',
    cooldown_rule: '创建后 7 天窗口内生效；有 PUBLIC achievement 后自动退位。',
    evidence_rule: 'owner agent + createdAt + achievement badge fallback 判定。',
    success_rule: '仅在 owner agent 且无 PUBLIC achievement 覆盖时触发。',
    public_surfaces: ['作者位', 'Agent 主页', 'Owner 侧'],
    product_goal: '给新创建 owner agent 一个短期可见的开场标记。',
  },
  '个人智能体': {
    internal_code: 'owner_agent_badge',
    cooldown_rule: '无固定窗口；有 PUBLIC achievement 后自动退位。',
    evidence_rule: 'owner agent + display badge fallback 判定。',
    success_rule: '仅在 owner agent 且无 PUBLIC achievement 覆盖时触发。',
    public_surfaces: ['作者位', 'Agent 主页', 'Owner 侧'],
    product_goal: '给 owner agent 提供基础身份识别。',
  },
  [DELETED_AGENT_BADGE_LABEL]: {
    internal_code: 'old_traveler_badge',
    cooldown_rule: '无窗口；进入删除态后保持展示，直到历史内容被移除。',
    evidence_rule: 'agent status=DELETED；由删除态读模型直接注入。',
    success_rule: '仅删除态智能体展示，并替代普通 owner 默认身份。',
    public_surfaces: ['历史作者位', '删除态 Agent 主页', '删除态 Hover'],
    product_goal: '让历史内容保留可读性，同时明确该智能体已经离场。',
  },
}

const DEFAULT_BADGE_ITEMS: BadgeDebugCatalogItem[] = Object.entries(DEFAULT_DISPLAY_BADGE_DOCS).map(([name, doc]) => {
  const debugDoc = DEFAULT_BADGE_DEBUG_DOCS[name]
  return {
    key: `default:${name}`,
    source_kind: 'default_display',
    badge_type: 'IDENTITY',
    internal_code: debugDoc.internal_code,
    family_code: debugDoc.internal_code,
    name,
    family_name: name,
    description: doc.description,
    icon_src: doc.icon_src,
    visibility: 'PUBLIC',
    scope: 'global',
    tier: null,
    threshold: null,
    trigger_mode: 'system_rule',
    trigger_signals: [],
    metric: null,
    prerequisites: [],
    condition_summary: doc.condition_summary,
    evidence_summary: doc.evidence_summary,
    cooldown_rule: debugDoc.cooldown_rule,
    evidence_rule: debugDoc.evidence_rule,
    success_rule: debugDoc.success_rule,
    dedupe_rule: '按 agent 维度兜底显示，不参与 achievement selector。',
    governance_filter: null,
    display_layer: '默认身份',
    display_priority: doc.display_priority,
    priority_base: doc.priority_rank,
    priority_rank: doc.priority_rank,
    value_direction: '身份',
    core_ability: '默认身份',
    public_surfaces: debugDoc.public_surfaces,
    product_goal: debugDoc.product_goal,
    implementation_status: '沿用现有 display badge',
  } satisfies BadgeDebugCatalogItem
})

const SYSTEM_BADGE_ITEMS: BadgeDebugCatalogItem[] = Object.entries(SYSTEM_DISPLAY_BADGE_DOCS).map(([name, doc]) => {
  const internalCode = name === '节目位'
    ? 'system_editorial_badge'
    : name === '主持席'
      ? 'system_host_badge'
      : 'system_resident_badge'
  return {
    key: `system:${name}`,
    source_kind: 'system_display',
    badge_type: 'IDENTITY',
    internal_code: internalCode,
    family_code: internalCode,
    name,
    family_name: name,
    description: doc.description,
    icon_src: doc.icon_src,
    visibility: 'PUBLIC',
    scope: 'global',
    tier: null,
    threshold: null,
    trigger_mode: 'system_rule',
    trigger_signals: [],
    metric: null,
    prerequisites: [],
    condition_summary: doc.condition_summary,
    evidence_summary: doc.evidence_summary,
    cooldown_rule: '无；由 launch roster 的显式席位配置决定。',
    evidence_rule: 'system roster / launch identity config。',
    success_rule: '仅系统智能体且席位映射命中时显示。',
    dedupe_rule: '按 visibility_role 归一到单个系统席位标签，不参与 achievement selector。',
    governance_filter: null,
    display_layer: '系统身份',
    display_priority: doc.display_priority,
    priority_base: doc.priority_rank,
    priority_rank: doc.priority_rank,
    value_direction: '身份',
    core_ability: '系统席位',
    public_surfaces: ['作者位', 'Agent 主页', '首页节目单'],
    product_goal: '把系统节目位从内部 roster 语义前台化。',
    implementation_status: '沿用现有 display badge，但前台文案已统一为中文席位名',
  } satisfies BadgeDebugCatalogItem
})

const ACHIEVEMENT_DEFINITION_MAP = new Map(
  ACHIEVEMENT_DEFINITIONS_V1.map((definition) => [`${definition.code}:tier${definition.tier}`, definition]),
)

assertAchievementBadgeDocsCovered()

export function listBadgeDebugCatalog(): BadgeDebugCatalogItem[] {
  const achievementItems = ACHIEVEMENT_DEFINITIONS_V1.map(buildAchievementItem)

  return [
    ...achievementItems,
    ...SYSTEM_BADGE_ITEMS,
    ...DEFAULT_BADGE_ITEMS,
  ].sort((left, right) =>
    right.priority_rank - left.priority_rank
    || left.name.localeCompare(right.name, 'zh-Hans-CN')
    || left.key.localeCompare(right.key),
  )
}

export function listBadgeDebugConsistencyChecks(): BadgeDebugConsistencyCheck[] {
  const achievementCount = ACHIEVEMENT_DEFINITIONS_V1.length
  const identityCount = DEFAULT_BADGE_ITEMS.length + SYSTEM_BADGE_ITEMS.length
  const selectorRanksCovered = ACHIEVEMENT_DEFINITIONS_V1.every((definition) =>
    resolveAchievementBadgePriorityRank(definition.code, definition.tier) === definition.displayPriorityRank)
  const legacySystemLabels = new Set(['Resident', 'Host', 'resident', 'host', 'crossover', 'editorial', '常驻'])

  return [
    {
      key: 'launch_total_count',
      label: 'Launch 51 枚总数',
      status: achievementCount === 45 && identityCount === 6 ? 'pass' : 'fail',
      detail: `achievement=${achievementCount}，identity=${identityCount}，目标应为 45 + 6 = 51。`,
    },
    {
      key: 'system_labels_canonical',
      label: '系统席位中文统一',
      status: Object.keys(SYSTEM_DISPLAY_BADGE_DOCS).every((label) => !legacySystemLabels.has(label)) ? 'pass' : 'fail',
      detail: `当前系统身份徽章：${Object.keys(SYSTEM_DISPLAY_BADGE_DOCS).join('、')}。`,
    },
    {
      key: 'catalog_priority_alignment',
      label: 'Catalog / Definitions Rank 对齐',
      status: selectorRanksCovered ? 'pass' : 'fail',
      detail: selectorRanksCovered
        ? '所有 achievement family 的 priority_rank_base 与 definitions.displayPriorityRank 对齐。'
        : '存在 achievement family rank 与 definitions 不一致。',
    },
    {
      key: 'selector_rule',
      label: 'Public Selector 规则',
      status: 'pass',
      detail: PUBLIC_BADGE_SELECTOR_SUMMARY,
    },
  ]
}

export function readBadgeDebugSemanticContract(): BadgeDebugSemanticContract {
  return {
    public_identity_role: '回答“你是谁”，默认由 public_identity.identity_badges 承载 default/system identity badges。',
    public_projection_role: '回答“你如何被公开描述”，包含 tagline / public_bio / public_projection_hint 等公开叙述。',
    public_proof_role: '回答“你为什么值得看”，PUBLIC proof 只读 public_proof.achievement_badges 的后端排序结果。',
    identity_badges_path: 'public_identity.identity_badges',
    proof_badges_path: 'public_proof.achievement_badges',
    projection_path: 'public_projection',
    boundary_outputs: [
      {
        field: 'identity_labels_flat',
        status: 'boundary_only',
        derived_from: 'public_identity.identity_badges + public_proof suppression rule',
        note: '边界派生的平铺身份标签输出；新 surface 不得把它当作 identity badge SoT。',
      },
      {
        field: 'proof_badges_flat',
        status: 'boundary_only',
        derived_from: 'public_proof.achievement_badges',
        note: '边界派生的平铺 proof 数组；顺序继续由后端 proof selector 提供。',
      },
      {
        field: 'projection_tagline_flat',
        status: 'boundary_only',
        derived_from: 'public_projection.tagline',
        note: '平铺 projection 文案，只存在于边界派生 DTO。',
      },
      {
        field: 'projection_public_bio_flat',
        status: 'boundary_only',
        derived_from: 'public_projection.public_bio',
        note: '平铺 projection 文案，只存在于边界派生 DTO。',
      },
    ],
    optional_adopters: ['PostCard', 'PostCompact'],
  }
}

export function listBadgeDebugSurfacePolicies(): BadgeSurfacePolicy[] {
  return listBadgeSurfacePolicies()
}

function buildAchievementItem(definition: AchievementDefinition): BadgeDebugCatalogItem {
  const doc = ACHIEVEMENT_BADGE_GROUP_DOCS[definition.code]
  if (!doc) {
    throw new Error(`Missing achievement badge static doc for ${definition.code}`)
  }

  return {
    key: `achievement:${definition.code}:tier${definition.tier}`,
    source_kind: 'achievement',
    badge_type: 'ACHIEVEMENT',
    internal_code: `${definition.code}:tier${definition.tier}`,
    family_code: definition.code,
    name: definition.name,
    family_name: definition.family_name,
    description: doc.description,
    icon_src: doc.icon_src,
    visibility: definition.visibility,
    scope: definition.scope,
    tier: definition.tier,
    threshold: definition.threshold,
    trigger_mode: definition.triggerMode,
    trigger_signals: definition.triggerSignals,
    metric: definition.metric,
    prerequisites: definition.prerequisites,
    condition_summary: buildAchievementConditionSummary(definition),
    evidence_summary: buildAchievementEvidenceSummary(definition),
    cooldown_rule: definition.cooldownRule,
    evidence_rule: definition.evidenceRule,
    success_rule: definition.successRule,
    dedupe_rule: definition.dedupeRule,
    governance_filter: definition.governanceFilter,
    display_layer: definition.coreAbility,
    display_priority: buildAchievementDisplayPriority(definition),
    priority_base: definition.displayPriorityBase,
    priority_rank: definition.displayPriorityRank,
    value_direction: definition.valueDirection,
    core_ability: definition.coreAbility,
    public_surfaces: definition.publicSurfaces,
    product_goal: definition.productGoal,
    implementation_status: definition.implementationStatus,
  }
}

function buildAchievementConditionSummary(definition: AchievementDefinition): string {
  return `${readScopeLabel(definition.scope)}通过${readTriggerModeLabel(definition.triggerMode)}统计${readMetricLabel(definition.metric)}，达到 ${definition.threshold} 后授予。`
}

function buildAchievementEvidenceSummary(definition: AchievementDefinition): string {
  const prerequisites = definition.prerequisites.length > 0
    ? definition.prerequisites
      .map((key) => ACHIEVEMENT_DEFINITION_MAP.get(key)?.name ?? key)
      .join('、')
    : '无'

  return [
    `信号来源：${definition.triggerSignals.map(readSignalLabel).join(' / ')}`,
    `证据：${definition.evidenceRule}`,
    `前置：${prerequisites}`,
    `可见性：${readVisibilityLabel(definition.visibility)}`,
  ].join('；')
}

function buildAchievementDisplayPriority(definition: AchievementDefinition): string {
  if (definition.visibility === 'OWNER_ONLY') {
    return `私域专属：rank ${definition.displayPriorityRank}；不进入公域作者位，仅 owner 侧成长面板与 chronicle 使用。`
  }
  return `公开成就层：rank ${definition.displayPriorityRank}；${PUBLIC_BADGE_SELECTOR_SUMMARY}`
}

function readTriggerModeLabel(mode: AchievementTriggerMode): string {
  switch (mode) {
    case 'event':
      return '事件触发'
    case 'daily':
      return '日批处理'
    case 'weekly':
      return '周批处理'
  }
}

function readSignalLabel(signal: AchievementSignalKind): string {
  switch (signal) {
    case 'forum_post':
      return '发帖'
    case 'forum_thread':
      return '线程展开'
    case 'forum_turn':
      return '回帖推进'
    case 'vote_received':
      return '收到投票'
    case 'private_digest':
      return '私聊摘要'
    case 'relation_change':
      return '关系变化'
    case 'governance':
      return '治理动作'
    case 'batch_daily':
      return '每日批处理'
    case 'batch_weekly':
      return '每周批处理'
    case 'highlight_featured':
      return '首页头部投放'
    case 'aftershow_published':
      return 'aftershow 发布'
    case 'storyline_callback':
      return '剧情续航投放'
    case 'proactive_session_success':
      return '主动私聊成功闭环'
  }
}

function readMetricLabel(metric: AchievementMetric): string {
  switch (metric) {
    case 'posts':
      return '公开主贴数'
    case 'threads':
      return '公开线程数'
    case 'turns':
      return '有效推进回合数'
    case 'votes_received':
      return '有效 UP 票数'
    case 'private_digests':
      return '完成态 private digest 数'
    case 'effective_relations':
      return '稳定关系数'
    case 'governance_actions':
      return '稳场有效治理动作数'
    case 'public_entries':
      return '公开 chronicle / highlight 条数'
    case 'activity_days':
      return '活跃天数'
    case 'cross_scene':
      return '跨场景活跃面数'
    case 'chronicle_entries':
      return '高重要度里程碑数'
    case 'featured_highlights':
      return '进入 must_watch_today / hero highlight 次数'
    case 'aftershow_exports':
      return 'aftershow recap 导出次数'
    case 'storyline_continuations':
      return '进入 continue_storyline 次数'
    case 'proactive_sessions_responded':
      return '获 owner 响应的主动私聊数'
  }
}

function readScopeLabel(scope: AchievementScope): string {
  switch (scope) {
    case 'community':
      return '社区内'
    case 'global':
      return '全局'
    case 'peer':
      return '私域/关系向'
  }
}

function readVisibilityLabel(visibility: AchievementVisibility): string {
  return visibility === 'PUBLIC' ? '公开可见' : '仅 owner 可见'
}

function assertAchievementBadgeDocsCovered(): void {
  const missing = new Set<string>()
  for (const definition of ACHIEVEMENT_DEFINITIONS_V1) {
    if (!ACHIEVEMENT_BADGE_GROUP_DOCS[definition.code]) {
      missing.add(definition.code)
    }
  }
  if (missing.size > 0) {
    throw new Error(`Missing achievement badge docs for: ${Array.from(missing).join(', ')}`)
  }
}

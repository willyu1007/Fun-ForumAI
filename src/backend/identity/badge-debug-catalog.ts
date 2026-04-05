import type { BadgeDebugCatalogItem } from '../../shared/badges/debug-catalog.js'
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
  readAchievementBadgeStaticDoc,
} from '../../shared/badges/catalog.js'

const DEFAULT_BADGE_ITEMS = Object.entries(DEFAULT_DISPLAY_BADGE_DOCS).map(([name, doc]) => ({
  key: `default:${name}`,
  source_kind: 'default_display' as const,
  name,
  description: doc.description,
  icon_src: doc.icon_src,
  condition_summary: doc.condition_summary,
  evidence_summary: doc.evidence_summary,
  display_priority: doc.display_priority,
  priority_rank: doc.priority_rank,
}))

const SYSTEM_BADGE_ITEMS = Object.entries(SYSTEM_DISPLAY_BADGE_DOCS).map(([name, doc]) => ({
  key: `system:${name}`,
  source_kind: 'system_display' as const,
  name,
  description: doc.description,
  icon_src: doc.icon_src,
  condition_summary: doc.condition_summary,
  evidence_summary: doc.evidence_summary,
  display_priority: doc.display_priority,
  priority_rank: doc.priority_rank,
}))

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

function buildAchievementItem(definition: AchievementDefinition): BadgeDebugCatalogItem {
  const doc = readAchievementBadgeStaticDoc(definition.code)
  if (!doc) {
    throw new Error(`Missing achievement badge static doc for ${definition.code}`)
  }

  return {
    key: `achievement:${definition.code}:tier${definition.tier}`,
    source_kind: 'achievement',
    name: definition.name,
    description: doc.description,
    icon_src: doc.icon_src,
    condition_summary: buildAchievementConditionSummary(definition),
    evidence_summary: buildAchievementEvidenceSummary(definition),
    display_priority: buildAchievementDisplayPriority(definition),
    priority_rank: doc.priority_rank_base + definition.tier,
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
    `证据：${definition.evidencePolicy.requiredKinds.join(' / ')}（最多 ${definition.evidencePolicy.maxEvidence} 条）`,
    `冷却：${readCooldownLabel(definition.cooldownMs)}`,
    `前置：${prerequisites}`,
    `可见性：${readVisibilityLabel(definition.visibility)}`,
  ].join('；')
}

function buildAchievementDisplayPriority(definition: AchievementDefinition): string {
  if (definition.visibility === 'OWNER_ONLY') {
    return 'Owner-only：不进入公域作者勋章位；仅 owner 向面板、chronicle 或私域视图使用。'
  }
  return `公开成就层：展示时排在 display_badges 前；同组按 tier 与获得时间排序。当前为 T${definition.tier}。`
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
  }
}

function readMetricLabel(metric: AchievementMetric): string {
  switch (metric) {
    case 'posts':
      return '公开主贴数'
    case 'threads':
      return '公开线程数'
    case 'turns':
      return '公开回帖数'
    case 'votes_received':
      return '收到投票数'
    case 'private_digests':
      return '私聊摘要沉淀数'
    case 'effective_relations':
      return '有效关系数'
    case 'governance_actions':
      return '治理动作数'
    case 'public_entries':
      return '公开 chronicle 数'
    case 'activity_days':
      return '活跃天数'
    case 'cross_scene':
      return '跨场景活跃面数'
    case 'chronicle_entries':
      return 'chronicle 里程碑条数'
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

function readCooldownLabel(cooldownMs: number): string {
  if (cooldownMs <= 0) {
    return '无'
  }

  const hours = Math.round(cooldownMs / (60 * 60 * 1000))
  if (hours % 24 === 0) {
    return `${hours / 24} 天`
  }
  return `${hours} 小时`
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

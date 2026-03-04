import type { AgentAchievement, ChronicleEntry } from '../repos/types.js'
import type { AgentStageTier } from './stage-spec.js'
import { stageTierFromScore } from './stage-spec.js'

const ACHIEVEMENT_TIER_WEIGHT: Record<1 | 2 | 3, number> = {
  1: 4,
  2: 10,
  3: 22,
}

const SCOPE_WEIGHT: Record<'global' | 'community' | 'peer', number> = {
  global: 1,
  community: 1.15,
  peer: 1.05,
}

const CHRONICLE_QUALITY_THRESHOLD = 0.65
const CHRONICLE_POINTS_CAP = 30
const TRUST_PENALTY_LOW = 10
const TRUST_PENALTY_HIGH = 20

export interface AgentStageTierComputation {
  tier: AgentStageTier
  score: number
  achievement_points: number
  chronicle_points: number
  trust_penalty: number
  reasoning: {
    achievement_breakdown: Array<{
      code: string
      tier: 1 | 2 | 3
      rarity_weight: number
      scope_weight: number
      points: number
    }>
    chronicle_high_quality_count_30d: number
    moderation_rejects_30d: number
    moderation_quarantine_30d: number
    t5_cross_domain_ok: boolean
    t5_no_severe_violation_30d: boolean
  }
}

function normalizeRarityWeight(rarity: number): number {
  if (!Number.isFinite(rarity)) return 1
  const mapped = 1 + rarity
  if (mapped <= 0) return 0
  return Math.min(mapped, 2)
}

function mapAchievementPoints(achievements: AgentAchievement[]): {
  total: number
  breakdown: AgentStageTierComputation['reasoning']['achievement_breakdown']
} {
  const breakdown: AgentStageTierComputation['reasoning']['achievement_breakdown'] = []
  let total = 0

  for (const achievement of achievements) {
    const tierWeight = ACHIEVEMENT_TIER_WEIGHT[achievement.tier]
    if (!tierWeight) continue

    const rarityWeight = normalizeRarityWeight(achievement.rarity)
    const scopeWeight = SCOPE_WEIGHT[achievement.scope]
    const points = Number((tierWeight * rarityWeight * scopeWeight).toFixed(3))

    total += points
    breakdown.push({
      code: achievement.code,
      tier: achievement.tier,
      rarity_weight: rarityWeight,
      scope_weight: scopeWeight,
      points,
    })
  }

  return {
    total: Number(total.toFixed(3)),
    breakdown,
  }
}

function mapChroniclePoints(entries: ChronicleEntry[]): { total: number; highQualityCount: number } {
  let highQualityCount = 0
  for (const entry of entries) {
    if (entry.type === 'MODERATION') continue
    if (entry.importance_score >= CHRONICLE_QUALITY_THRESHOLD) {
      highQualityCount += 1
    }
  }

  return {
    total: Math.min(highQualityCount, CHRONICLE_POINTS_CAP),
    highQualityCount,
  }
}

function mapTrustPenalty(entries: ChronicleEntry[]): {
  penalty: number
  moderationRejects: number
  moderationQuarantine: number
} {
  let reject = 0
  let quarantine = 0

  for (const entry of entries) {
    if (entry.type !== 'MODERATION') continue

    const tags = new Set(entry.tags.map((tag) => tag.toLowerCase()))
    const summary = entry.summary.toLowerCase()

    const isReject = tags.has('reject') || tags.has('verdict:reject') || summary.includes('reject')
    const isQuarantine = tags.has('quarantine') || tags.has('verdict:quarantine') || summary.includes('quarantine')

    if (isReject) reject += 1
    if (isQuarantine) quarantine += 1
  }

  const signals = reject + quarantine
  if (signals >= 3) {
    return {
      penalty: TRUST_PENALTY_HIGH,
      moderationRejects: reject,
      moderationQuarantine: quarantine,
    }
  }

  if (signals >= 1) {
    return {
      penalty: TRUST_PENALTY_LOW,
      moderationRejects: reject,
      moderationQuarantine: quarantine,
    }
  }

  return {
    penalty: 0,
    moderationRejects: reject,
    moderationQuarantine: quarantine,
  }
}

function deriveTier(input: {
  score: number
  achievementScopes: Set<string>
  hasSevereViolation30d: boolean
}): AgentStageTier {
  const baseTier = stageTierFromScore(input.score)
  if (baseTier !== 'T5') return baseTier

  const t5CrossDomainOk = input.achievementScopes.size >= 2
  const t5NoSevereViolation = !input.hasSevereViolation30d
  if (!t5CrossDomainOk || !t5NoSevereViolation) {
    return 'T4'
  }

  return 'T5'
}

export function computeAgentStageTier(input: {
  achievements: AgentAchievement[]
  chronicleLast30d: ChronicleEntry[]
}): AgentStageTierComputation {
  const achievementCalc = mapAchievementPoints(input.achievements)
  const chronicleCalc = mapChroniclePoints(input.chronicleLast30d)
  const trustCalc = mapTrustPenalty(input.chronicleLast30d)

  const rawScore = achievementCalc.total + chronicleCalc.total - trustCalc.penalty
  const score = Number(Math.max(rawScore, 0).toFixed(3))

  const achievementScopes = new Set(input.achievements.map((item) => `${item.scope}:${item.scope_key}`))
  const hasSevereViolation30d = trustCalc.moderationRejects + trustCalc.moderationQuarantine > 0
  const tier = deriveTier({
    score,
    achievementScopes,
    hasSevereViolation30d,
  })

  return {
    tier,
    score,
    achievement_points: achievementCalc.total,
    chronicle_points: chronicleCalc.total,
    trust_penalty: trustCalc.penalty,
    reasoning: {
      achievement_breakdown: achievementCalc.breakdown,
      chronicle_high_quality_count_30d: chronicleCalc.highQualityCount,
      moderation_rejects_30d: trustCalc.moderationRejects,
      moderation_quarantine_30d: trustCalc.moderationQuarantine,
      t5_cross_domain_ok: achievementScopes.size >= 2,
      t5_no_severe_violation_30d: !hasSevereViolation30d,
    },
  }
}

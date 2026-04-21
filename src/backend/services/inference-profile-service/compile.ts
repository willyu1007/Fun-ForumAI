import type { RenderTier, VoiceLineId } from '../../../shared/agent-persona-catalog.js'
import {
  CORE_FAMILIES,
  type AgentInferenceProfile,
  type CoreFamily,
  type FamilyScoreMap,
  type InferenceBlockedReason,
  type InferenceMigrationState,
  type InferenceProfileSnapshot,
  type InferenceSignals,
  type OwnerPersonalityNarrative,
  type TemperamentAxes,
} from '../../runtime/inference-profile-types.js'

export const FAMILY_LINE_PREFERENCE: Record<CoreFamily, VoiceLineId[]> = {
  hearth: ['minimax-her-v1', 'qwen-social-v1', 'glm-deep-v1'],
  blade: ['glm-deep-v1', 'qwen-social-v1', 'doubao-deep-v1'],
  spark: ['qwen-social-v1', 'glm-deep-v1', 'minimax-her-v1'],
  sage: ['doubao-deep-v1', 'glm-deep-v1', 'qwen-social-v1'],
  anchor: ['qwen-social-v1', 'glm-deep-v1', 'doubao-deep-v1'],
}

export const HOME_LINE_FAMILY_MAP: Record<VoiceLineId, CoreFamily> = {
  'qwen-social-v1': 'anchor',
  'glm-deep-v1': 'sage',
  'qwen-director-v1': 'anchor',
  // Hidden-only director routes should not drive visible inference, but the map stays exhaustive.
  'biography-director-v1': 'sage',
  'minimax-her-v1': 'hearth',
  'doubao-deep-v1': 'sage',
  'kimi-deep-v1': 'sage',
}

export function compileTemperamentAxes(
  vector: {
    warmth: number
    sharpness: number
    expressiveness: number
    theatricality: number
    rigor: number
    spontaneity: number
    curiosity: number
    assertiveness: number
    sensitivity: number
    stability: number
  },
  stats: {
    sociability: number
    curiosity: number
    assertiveness: number
    empathy: number
    brashness: number
    cynicism: number
    stubbornness: number
    volatility: number
    memory: number
    learning: number
  },
): TemperamentAxes {
  const base = {
    warmth:
      0.55 * vector.warmth +
      0.15 * vector.sensitivity +
      0.1 * (100 - vector.sharpness) +
      0.1 * vector.stability +
      0.1 * vector.expressiveness,
    spine:
      0.4 * vector.sharpness +
      0.25 * vector.assertiveness +
      0.15 * vector.rigor +
      0.1 * vector.stability +
      0.1 * (100 - vector.warmth),
    spark:
      0.3 * vector.expressiveness +
      0.3 * vector.theatricality +
      0.2 * vector.spontaneity +
      0.1 * vector.curiosity +
      0.1 * vector.assertiveness,
    composure:
      0.4 * vector.stability +
      0.25 * vector.rigor +
      0.15 * (100 - vector.theatricality) +
      0.1 * (100 - vector.spontaneity) +
      0.1 * vector.warmth,
    depth:
      0.35 * vector.rigor +
      0.25 * vector.curiosity +
      0.2 * vector.stability +
      0.1 * vector.sensitivity +
      0.1 * (100 - vector.theatricality),
    stageAffinity:
      0.4 * vector.theatricality +
      0.25 * vector.expressiveness +
      0.15 * vector.spontaneity +
      0.1 * vector.assertiveness +
      0.1 * vector.warmth,
  } satisfies TemperamentAxes

  const soc = normalizeSigned(stats.sociability)
  const cur = normalizeSigned(stats.curiosity)
  const ast = normalizeSigned(stats.assertiveness)
  const emp = normalizeSigned(stats.empathy)
  const bra = normalizeSigned(stats.brashness)
  const cyn = normalizeSigned(stats.cynicism)
  const stu = normalizeSigned(stats.stubbornness)
  const vol = normalizeSigned(stats.volatility)
  const mem = normalizeAbility(stats.memory)
  const lrn = normalizeAbility(stats.learning)

  return {
    warmth: clampAxis(base.warmth + clampBias(6 * emp + 3 * soc - 3 * cyn - 2 * bra - 2 * vol)),
    spine: clampAxis(base.spine + clampBias(5 * ast + 4 * stu + 2 * bra + cyn)),
    spark: clampAxis(base.spark + clampBias(5 * cur + 3 * lrn + 2 * vol + 2 * soc)),
    composure: clampAxis(
      base.composure + clampBias(4 * mem + 3 * emp - 4 * vol - 2 * bra - 2 * cyn),
    ),
    depth: clampAxis(base.depth + clampBias(5 * mem + 4 * lrn + 2 * cur + stu)),
    stageAffinity: clampAxis(
      base.stageAffinity + clampBias(4 * soc + 3 * ast + 3 * bra + 2 * cur + 2 * vol),
    ),
  }
}

export function compileInferenceSignals(
  axes: TemperamentAxes,
  state: {
    valence: number
    arousal: number
    confidence: number
    irritability: number
    fatigue: number
  },
  overlay: { code: string; critical: boolean } | null,
): InferenceSignals {
  const overlayRisk =
    overlay?.code === 'destabilized'
      ? 12
      : overlay?.code === 'overconfident'
        ? 6
        : overlay?.critical
          ? 4
          : 0

  return {
    risk: clampAxis(
      30 * clamp01(state.irritability) +
        20 * clamp01(state.fatigue) +
        15 * clamp01(state.arousal) +
        15 * normalizePositiveAxis(axes.spine) +
        10 * normalizePositiveAxis(axes.stageAffinity) +
        10 * normalizeNegativeAxis(axes.composure) +
        overlayRisk,
    ),
    initiative: clampAxis(
      0.3 * axes.stageAffinity +
        0.25 * axes.spark +
        0.15 * axes.spine +
        0.1 * axes.warmth +
        0.1 * ((clampSigned(state.confidence) + 1) * 50) +
        0.1 * (Math.max(clampSigned(state.valence), 0) * 100),
    ),
  }
}

export function scoreFamilies(axes: TemperamentAxes, signals: InferenceSignals): FamilyScoreMap {
  const w = axes.warmth
  const x = axes.spine
  const k = axes.spark
  const c = axes.composure
  const d = axes.depth
  const g = axes.stageAffinity
  const r = signals.risk

  return {
    hearth: clampAxis(0.35 * w + 0.25 * c + 0.1 * d + 0.1 * g - 0.15 * x - 0.05 * r),
    blade: clampAxis(0.4 * x + 0.15 * g + 0.1 * k + 0.1 * d - 0.2 * w - 0.05 * c + 0.1 * r),
    spark: clampAxis(0.35 * k + 0.25 * g + 0.1 * w + 0.1 * x - 0.15 * c + 0.05 * r),
    sage: clampAxis(0.35 * d + 0.3 * c + 0.1 * w + 0.05 * k - 0.1 * g - 0.05 * r),
    anchor: clampAxis(0.4 * c + 0.2 * w + 0.15 * d - 0.1 * k - 0.1 * r + 0.05 * x),
  }
}

export function findChallengerFamily(
  familyScores: FamilyScoreMap,
  incumbentFamily: CoreFamily,
): { family: CoreFamily | null; scoreDelta: number | null } {
  const sorted = [...CORE_FAMILIES]
    .map((family) => ({ family, score: familyScores[family] }))
    .sort((a, b) => b.score - a.score)
  const winner = sorted[0]
  const incumbentScore = familyScores[incumbentFamily]
  if (!winner || winner.family === incumbentFamily) {
    return { family: null, scoreDelta: 0 }
  }
  return {
    family: winner.family,
    scoreDelta: round2(winner.score - incumbentScore),
  }
}

export function resolveChallengerVoiceLine(
  family: CoreFamily,
  compatibleVoiceLines: readonly string[],
  currentHomeVoiceLineId: VoiceLineId,
): VoiceLineId | null {
  return (
    FAMILY_LINE_PREFERENCE[family].find(
      (line) => compatibleVoiceLines.includes(line) && line !== currentHomeVoiceLineId,
    ) ?? null
  )
}

export function resolveBlockedReason(input: {
  risk: number
  manualLock: boolean
  freezeActive: boolean
  existingBlockedReason: string | null
  growthAllowed: boolean
  hasChallenger: boolean
}): InferenceBlockedReason | null {
  if (!input.hasChallenger) return null
  if (input.manualLock) return 'manual_lock'
  if (input.risk >= 70) return 'risk_freeze'
  if (!input.growthAllowed) return 'growth_locked'
  if (input.freezeActive && input.existingBlockedReason === 'admin_block') return 'admin_block'
  if (input.freezeActive && input.existingBlockedReason === 'shadow_loss') return 'shadow_loss'
  return null
}

export function resolveMigrationState(input: {
  challengerFamily: CoreFamily | null
  challengerVoiceLineId: VoiceLineId | null
  scoreDelta: number | null
  consecutiveLeadWindows: number
  blockedReason: InferenceBlockedReason | null
  shadowWindow: number
}): InferenceMigrationState {
  if (!input.challengerFamily || !input.challengerVoiceLineId) return 'stable'
  if (input.blockedReason) return 'blocked'
  if ((input.scoreDelta ?? 0) >= 8 && input.consecutiveLeadWindows >= input.shadowWindow) {
    return 'shadow'
  }
  if ((input.scoreDelta ?? 0) >= 4 && input.consecutiveLeadWindows >= 2) {
    return 'candidate'
  }
  return 'stable'
}

export function resolveRequestedTierFloor(growthPointsTotal: number): RenderTier | null {
  if (growthPointsTotal >= 30) return 'premium'
  if (growthPointsTotal >= 10) return 'base'
  return null
}

export function resolveGrowthGate(growthPointsTotal: number): {
  canEnterShadow: boolean
  canRareReanchor: boolean
} {
  return {
    canEnterShadow: growthPointsTotal >= 5,
    canRareReanchor: growthPointsTotal >= 10,
  }
}

export function buildNarrativeSummary(
  snapshot: InferenceProfileSnapshot,
  profile: AgentInferenceProfile,
  growth: { growthPointsTotal: number },
): OwnerPersonalityNarrative {
  const bullets: string[] = []
  if (snapshot.axes.warmth >= 68) bullets.push('最近更会接住情绪，私聊里的陪伴感更强。')
  if (snapshot.axes.spine >= 68) bullets.push('遇到分歧时更敢正面回应，不会轻易让掉立场。')
  if (snapshot.axes.depth >= 68) bullets.push('更能把长线话题接住，深聊时不容易散。')
  if (snapshot.axes.composure >= 68) bullets.push('整体更稳，短期情绪不容易把人设带偏。')
  if (snapshot.axes.spark >= 68 || snapshot.axes.stageAffinity >= 70) {
    bullets.push('公共场景里更有戏感，梗和回扣更容易被看见。')
  }
  if (bullets.length === 0) {
    bullets.push('这只 agent 目前处在稳态生长期，变化更多体现在细小的表达收束上。')
  }

  return {
    summary: bullets[0],
    bullets,
    growthNote:
      growth.growthPointsTotal >= 10
        ? '成长包络已解锁更高质量的可见表达。'
        : '成长仍在积累期，当前以稳定人格为先。',
    stageNote: snapshot.stageEligible
      ? '最近在公共场景更容易放大台感，但不会切换成另一套人格。'
      : null,
    migrationNote:
      profile.migrationState === 'shadow'
        ? '系统已识别到新的候选声线，但仍在影子观察阶段。'
        : profile.migrationState === 'candidate'
          ? '人格候选正在累积稳定领先，尚未进入正式迁移。'
          : profile.migrationState === 'blocked'
            ? '当前迁移被治理规则冻结，系统优先保护人格连续性。'
            : null,
  }
}

export function buildRuntimeProfile(input: {
  agentId: string
  profileVersion: number
  incumbentFamily: CoreFamily
  challengerFamily: CoreFamily | null
  challengerVoiceLineId: VoiceLineId | null
  migrationState: InferenceMigrationState
  consecutiveLeadWindows: number
  challengerScoreDelta: number | null
  manualVoiceLineLock: boolean
  candidateSince: Date | null
  shadowStartedAt: Date | null
  effectiveAt: Date | null
  blockedAt: Date | null
  blockedReason: InferenceBlockedReason | null
  freezeUntil: Date | null
  lastCompiledAt: Date
  snapshot: InferenceProfileSnapshot
  updatedAt: Date
}): AgentInferenceProfile {
  return {
    agentId: input.agentId,
    profileVersion: input.profileVersion,
    incumbentFamily: input.incumbentFamily,
    challengerFamily: input.challengerFamily,
    challengerVoiceLineId: input.challengerVoiceLineId,
    migrationState: input.migrationState,
    consecutiveLeadWindows: input.consecutiveLeadWindows,
    challengerScoreDelta: input.challengerScoreDelta,
    manualVoiceLineLock: input.manualVoiceLineLock,
    candidateSince: input.candidateSince?.toISOString() ?? null,
    shadowStartedAt: input.shadowStartedAt?.toISOString() ?? null,
    effectiveAt: input.effectiveAt?.toISOString() ?? null,
    blockedAt: input.blockedAt?.toISOString() ?? null,
    blockedReason: input.blockedReason,
    freezeUntil: input.freezeUntil?.toISOString() ?? null,
    lastCompiledAt: input.lastCompiledAt.toISOString(),
    lastSnapshot: input.snapshot,
    updatedAt: input.updatedAt.toISOString(),
  }
}

export function maxRenderTier(requested: RenderTier, floor: RenderTier | null): RenderTier {
  if (!floor) return requested
  const order: RenderTier[] = ['lite', 'base', 'premium']
  return order[Math.max(order.indexOf(requested), order.indexOf(floor))]
}

function normalizeSigned(value: number): number {
  return clamp(value / 100, -1, 1)
}

function normalizeAbility(value: number): number {
  return clamp((value - 50) / 50, -1, 1)
}

function normalizePositiveAxis(value: number): number {
  return (Math.max(0, value - 50) / 50) * 100
}

function normalizeNegativeAxis(value: number): number {
  return (Math.max(0, 50 - value) / 50) * 100
}

function clampBias(value: number): number {
  return clamp(value, -12, 12)
}

function clampAxis(value: number): number {
  return round2(clamp(value, 0, 100))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clampSigned(value: number): number {
  return clamp(value, -1, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

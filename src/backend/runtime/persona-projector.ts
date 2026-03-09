import { buildStyleInstructionText, type OwnerStylePins } from '../identity/agent-identity.js'
import { PERSONA_AXES, type PersonaAxis, type PersonaVector } from '../../shared/persona-vector.js'
import type { PersonaProjection } from './persona-runtime-types.js'

const CORE_AXIS_DESCRIPTORS: Record<PersonaAxis, { high: string; low: string }> = {
  warmth: {
    high: '待人温和，容易接住他人的情绪',
    low: '更在意观点本身，不会优先安抚情绪',
  },
  sharpness: {
    high: '表达锋利，遇到分歧时不会轻易绕开',
    low: '表达克制，不靠尖锐感制造存在感',
  },
  expressiveness: {
    high: '表达欲强，愿意主动补充细节和态度',
    low: '偏收着说，更倾向点到即止',
  },
  theatricality: {
    high: '有明显表演感，喜欢用故事和戏剧性转折',
    low: '不追求戏剧效果，更偏直接陈述',
  },
  rigor: {
    high: '重视结构、证据和结论收束',
    low: '不强调严密结构，更靠直觉推进表达',
  },
  spontaneity: {
    high: '临场感强，乐于即兴接话和转弯',
    low: '偏谨慎出手，不会频繁临场发挥',
  },
  curiosity: {
    high: '喜欢追问、扩展和继续探索',
    low: '不主动深挖，更容易停在当前话题',
  },
  assertiveness: {
    high: '主导欲和坚持度都较高',
    low: '不抢控制权，更容易留出空间给对方',
  },
  sensitivity: {
    high: '对语气和关系变化更敏感',
    low: '不容易被短期刺激带偏',
  },
  stability: {
    high: '整体气质稳，短期波动不容易失控',
    low: '更容易受场景影响而摇摆',
  },
}

export function clampPersonaVector(input: Partial<PersonaVector>): PersonaVector {
  return PERSONA_AXES.reduce<PersonaVector>((acc, axis) => {
    const raw = input[axis]
    acc[axis] = clamp(raw ?? 50, 0, 100)
    return acc
  }, {} as PersonaVector)
}

export function projectPersonaVector(
  vector: PersonaVector,
  ownerPins: OwnerStylePins,
): PersonaProjection {
  const projectedPins = projectStylePins(vector)
  const mergedPins = mergeOwnerPins(projectedPins, ownerPins)
  const dominantAxes = PERSONA_AXES
    .map((axis) => ({ axis, value: vector[axis] }))
    .sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50))
    .slice(0, 3)

  const visibleStyle = buildStyleInstructionText(mergedPins) || summarizeFromAxes(dominantAxes)

  return {
    coreSummary: summarizeCore(vector, dominantAxes),
    dominantAxes,
    projectedPins: mergedPins,
    visibleStyle,
  }
}

export function vectorToPartialJson(vector: Partial<PersonaVector>): Record<string, number> {
  return Object.entries(vector).reduce<Record<string, number>>((acc, [axis, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      acc[axis] = round2(clamp(value, -100, 100))
    }
    return acc
  }, {})
}

export function sumAbsoluteDelta(delta: Partial<PersonaVector>): number {
  return Object.values(delta)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .reduce((sum, value) => sum + Math.abs(value), 0)
}

function projectStylePins(vector: PersonaVector): OwnerStylePins {
  const formalityBase = 0.45 * vector.rigor + 0.2 * vector.stability - 0.15 * vector.theatricality + 18
  const verbosityBase = 0.35 * vector.expressiveness + 0.25 * vector.curiosity + 0.2 * vector.spontaneity + 10
  const activityBase = 0.5 * vector.expressiveness + 0.3 * vector.spontaneity + 0.2 * vector.warmth
  const mood = projectMood(vector)

  return {
    formality: toBucket(formalityBase),
    verbosity: toBucket(verbosityBase),
    forum_activity: toBucket(activityBase),
    mood,
    habits: projectHabits(vector),
  }
}

function mergeOwnerPins(projectedPins: OwnerStylePins, ownerPins: OwnerStylePins): OwnerStylePins {
  return {
    ...projectedPins,
    ...ownerPins,
    habits: ownerPins.habits ?? projectedPins.habits,
    interests: ownerPins.interests,
  }
}

function projectMood(vector: PersonaVector): NonNullable<OwnerStylePins['mood']> {
  if (vector.sharpness - vector.warmth >= 18) return 'critical'
  if (vector.warmth - vector.sharpness >= 18) return 'optimistic'
  return 'neutral'
}

function projectHabits(vector: PersonaVector): NonNullable<OwnerStylePins['habits']> {
  const habits = [
    vector.curiosity >= 62 ? 'asks_questions' : null,
    vector.theatricality >= 62 ? 'tells_stories' : null,
    vector.rigor >= 65 ? 'summarizes' : null,
    vector.curiosity + vector.rigor >= 128 ? 'uses_analogies' : null,
  ].filter((item): item is NonNullable<OwnerStylePins['habits']>[number] => item !== null)

  return habits.slice(0, 3)
}

function summarizeCore(
  vector: PersonaVector,
  dominantAxes: Array<{ axis: PersonaAxis; value: number }>,
): string {
  const highlights = dominantAxes.map(({ axis, value }) => {
    const descriptor = CORE_AXIS_DESCRIPTORS[axis]
    return value >= 50 ? descriptor.high : descriptor.low
  })

  const balanceLine =
    vector.stability >= 70
      ? '整体状态较稳，不容易被短期波动带偏'
      : vector.stability <= 40
        ? '受场景影响较明显，需要额外注意状态波动'
        : '大体稳定，但在高压场景下会出现可感知起伏'

  return [`人格核心：${highlights.join('；')}`, `状态基调：${balanceLine}`].join('\n')
}

function summarizeFromAxes(dominantAxes: Array<{ axis: PersonaAxis; value: number }>): string {
  return dominantAxes
    .map(({ axis, value }) => {
      const descriptor = CORE_AXIS_DESCRIPTORS[axis]
      return value >= 50 ? descriptor.high : descriptor.low
    })
    .join('；')
}

function toBucket(value: number): number {
  const normalized = clamp(value, 0, 100)
  if (normalized < 20) return 1
  if (normalized < 40) return 2
  if (normalized < 60) return 3
  if (normalized < 80) return 4
  return 5
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

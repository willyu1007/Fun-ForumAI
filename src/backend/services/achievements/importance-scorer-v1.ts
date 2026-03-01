export interface ImportanceSignalsV1 {
  // Formula signals, normalized into [0, 1] before scoring.
  F: number
  S: number
  R: number
  D: number
  O: number
  N: number
  C: number
  // Time decay factor.
  T: number
  spamPenalty?: number
}

export const IMPORTANCE_R_MAP_V1: Record<1 | 2 | 3, number> = {
  1: 0.45,
  2: 0.72,
  3: 0.9,
}

export const IMPORTANCE_D_MAP_V1: Record<'PUBLIC' | 'OWNER_ONLY', number> = {
  PUBLIC: 0.82,
  OWNER_ONLY: 0.56,
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

export class ImportanceScorerV1 {
  score(signals: ImportanceSignalsV1): number {
    const F = clamp01(signals.F)
    const S = clamp01(signals.S)
    const R = clamp01(signals.R)
    const D = clamp01(signals.D)
    const O = clamp01(signals.O)
    const N = clamp01(signals.N)
    const C = clamp01(signals.C)
    const T = clamp01(signals.T)
    const spamPenalty = clamp01(signals.spamPenalty ?? 0)

    const raw = T * (0.18 * F + 0.26 * S + 0.16 * R + 0.16 * D + 0.08 * O + 0.10 * N + 0.06 * C) - 0.10 * spamPenalty
    return clamp01(Number(raw.toFixed(4)))
  }

  // Piecewise daily decay for timeline entries.
  timeDecay(occurredAt: Date, now = new Date()): number {
    const ageMs = Math.max(0, now.getTime() - occurredAt.getTime())
    const ageDays = ageMs / (24 * 60 * 60 * 1000)
    if (ageDays <= 1) return 1
    if (ageDays <= 7) return 0.9
    if (ageDays <= 30) return 0.75
    if (ageDays <= 90) return 0.6
    return 0.45
  }
}

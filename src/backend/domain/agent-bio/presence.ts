import type { AgentBioPresenceState } from './types.js'

function hoursSince(input: Date | null, now: Date): number | null {
  if (!input) return null
  return Math.max(0, (now.getTime() - input.getTime()) / 3_600_000)
}

export function bucketizeAgentPresence(input: {
  now: Date
  lastPublicAt: Date | null
  lastPrivateAt: Date | null
  lastRelationAt: Date | null
  confidence?: number | null
  driftScore?: number | null
}): AgentBioPresenceState {
  const publicHours = hoursSince(input.lastPublicAt, input.now)
  const privateHours = hoursSince(input.lastPrivateAt, input.now)
  const relationHours = hoursSince(input.lastRelationAt, input.now)

  const recencyBoost =
    (publicHours !== null ? Math.max(0, 1 - publicHours / 96) * 0.5 : 0)
    + (privateHours !== null ? Math.max(0, 1 - privateHours / 72) * 0.3 : 0)
    + (relationHours !== null ? Math.max(0, 1 - relationHours / 120) * 0.2 : 0)
  const confidenceBoost = Math.max(0, Math.min(1, input.confidence ?? 0.5)) * 0.15
  const driftPenalty = Math.max(0, Math.min(1, (input.driftScore ?? 0) / 40)) * 0.18
  const score = Number(Math.max(0, Math.min(1, recencyBoost + confidenceBoost - driftPenalty)).toFixed(3))

  const lastTouch = [input.lastPublicAt, input.lastPrivateAt, input.lastRelationAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null

  if (score >= 0.7) {
    return {
      bucket: 'emerging',
      score,
      note_seed: '心里像新添了一点东西。',
      last_touch_at: lastTouch?.toISOString() ?? null,
    }
  }
  if (score >= 0.52) {
    return {
      bucket: 'warming',
      score,
      note_seed: '有些话，好像更容易说出口了。',
      last_touch_at: lastTouch?.toISOString() ?? null,
    }
  }
  if (score >= 0.34) {
    return {
      bucket: 'steady',
      score,
      note_seed: '整个人慢慢稳下来了。',
      last_touch_at: lastTouch?.toISOString() ?? null,
    }
  }
  if (score >= 0.18) {
    return {
      bucket: 'reflective',
      score,
      note_seed: '很多话会先留在心里。',
      last_touch_at: lastTouch?.toISOString() ?? null,
    }
  }
  return {
    bucket: 'quiet',
    score,
    note_seed: '安静些，像在等一件真正想记住的事。',
    last_touch_at: lastTouch?.toISOString() ?? null,
  }
}

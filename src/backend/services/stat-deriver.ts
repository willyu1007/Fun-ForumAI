import type { AgentState, AgentStats } from '../repos/types.js'

export interface StatsHardControls {
  agent_status?: 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED' | 'DELETED'
  talkativeness?: number
  allow_wandering?: boolean
  forum_activity?: number
}

export interface StatsDeriveContext {
  hard?: StatsHardControls
  privacy?: {
    top_k: number
    budget: number
  }
}

export interface DerivedKnobs {
  participation: {
    participation_bias: number
    participation_multiplier: number
    exploration_noise_scale: number
    p_wander: number
    controversy_appetite: number
  }
  chat: {
    talkativeness_1_5: number
    chat_tick_multiplier: number
  }
  vote: {
    p_vote: number
    p_down_given_vote: number
  }
  relation_policy: {
    pos_multiplier: number
    neg_multiplier: number
    challenge_valence: number
    friend_on: number
    friend_off: number
    block_soft_on: number
    block_hard_on: number
    trust_on: number
    trust_off: number
  }
  memory: {
    top_k_ability: number
    budget_ability: number
    effective_top_k: number
    effective_budget: number
    decay_per_day: number
    forget_threshold: number
    callback_drive: number
  }
  learning: {
    digest_level: number
    importance_alpha: number
    min_tags: number
    max_tags: number
  }
  expression: {
    sarcasm_allowed: boolean
    concession_rate: number
    caution_rate: number
    temperature: number
  }
  stats_hint: {
    participation_multiplier: number
    exploration_noise_scale: number
    controversy_appetite: number
    p_wander: number
  }
}

export function deriveKnobs(
  stats: AgentStats,
  state: AgentState,
  context: StatsDeriveContext = {},
): DerivedKnobs {
  const soc = clamp(stats.sociability / 100, -1, 1)
  const cur = clamp(stats.curiosity / 100, -1, 1)
  const ass = clamp(stats.assertiveness / 100, -1, 1)
  const emp = clamp(stats.empathy / 100, -1, 1)
  const bra = clamp(stats.brashness / 100, -1, 1)
  const cyn = clamp(stats.cynicism / 100, -1, 1)
  const stu = clamp(stats.stubbornness / 100, -1, 1)
  const vol = clamp(stats.volatility / 100, -1, 1)

  const fatigue = clamp(state.fatigue, 0, 1)
  const arousal = clamp(state.arousal, 0, 1)
  const irritability = clamp(state.irritability, 0, 1)

  const participationBias = clamp(
    0.55 * soc + 0.35 * cur + 0.2 * ass - 0.9 * fatigue + 0.25 * arousal,
    -1,
    1,
  )

  let participationMultiplier = clamp(1 + 0.6 * participationBias, 0.4, 1.8)

  const explore = clamp(
    0.6 * Math.max(cur, 0) + 0.2 * Math.max(soc, 0) + 0.2 * (1 - fatigue),
    0,
    1,
  )

  const explorationNoise = clamp(0.25 + 0.55 * explore, 0.2, 0.9)
  let pWander = clamp(0.05 + 0.45 * explore - 0.25 * fatigue, 0, 0.6)

  const controversyAppetite = clamp(
    0.6 * Math.max(ass, 0) + 0.4 * Math.max(bra, 0) + 0.2 * arousal - 0.3 * Math.max(emp, 0),
    0,
    1,
  )

  const rawTalk = 3 + 1.6 * Math.max(soc, 0) + 0.8 * arousal - 2.2 * fatigue
  let talkativeness = clamp(Math.round(rawTalk), 1, 5)

  const hard = context.hard
  if (hard?.talkativeness !== undefined) {
    const manualTalk = clamp(Math.round(hard.talkativeness), 1, 5)
    talkativeness = Math.min(talkativeness, manualTalk)
  }

  if (hard?.allow_wandering === false) {
    pWander = 0
  }

  if (hard?.forum_activity !== undefined) {
    const forumActivity = clamp(hard.forum_activity, 1, 5)
    const activityMultiplier = clamp(0.5 + (forumActivity - 1) * 0.25, 0.5, 1.5)
    participationMultiplier = clamp(participationMultiplier * activityMultiplier, 0, 1.8)
  }

  if (hard?.agent_status && hard.agent_status !== 'ACTIVE') {
    participationMultiplier = 0
    pWander = 0
  }

  const pVote = sigmoid(
    -1.2 + 1.0 * Math.abs(ass) + 0.8 * Math.max(soc, 0) + 0.6 * arousal - 1.4 * fatigue,
  )

  const downBias =
    0.2 +
    1.1 * Math.max(cyn, 0) +
    0.8 * Math.max(ass, 0) +
    0.9 * irritability -
    1.1 * Math.max(emp, 0) -
    0.3 * (1 - Math.abs(vol))

  const pDownGivenVote = sigmoid(downBias)

  const posMultiplier = clamp(
    1 + 0.55 * Math.max(soc, 0) + 0.55 * Math.max(emp, 0) + 0.2 * (1 - fatigue),
    0.8,
    2.2,
  )

  const negMultiplier = clamp(
    1 +
      0.7 * Math.max(cyn, 0) +
      0.55 * Math.max(bra, 0) +
      0.45 * Math.max(stu, 0) +
      0.8 * irritability,
    0.8,
    3,
  )

  const challengeValence = lerp(
    -1,
    1,
    clamp(0.5 + 0.5 * Math.max(ass, 0) - 0.4 * Math.max(cyn, 0) - 0.3 * Math.max(stu, 0), 0, 1),
  )

  const friendOn = clamp(70 - 18 * Math.max(soc, 0) + 10 * Math.max(stu, 0) + 6 * Math.max(cyn, 0), 40, 90)
  const friendOff = clamp(50 - 10 * Math.max(soc, 0) + 6 * Math.max(stu, 0), 25, 80)
  const blockSoftOn = clamp(-40 + 18 * Math.max(cyn, 0) + 20 * Math.max(bra, 0) + 25 * irritability, -80, -10)
  const blockHardOn = clamp(-70 + 25 * Math.max(bra, 0) + 30 * irritability + 10 * Math.max(cyn, 0), -90, -25)
  const trustOn = clamp(70 - 15 * Math.max(emp, 0) + 10 * Math.max(cyn, 0) + 8 * Math.max(vol, 0), 40, 90)
  const trustOff = clamp(50 - 10 * Math.max(emp, 0) + 6 * Math.max(cyn, 0), 25, 80)

  const m = clamp(stats.memory / 100, 0, 1)
  const mEff = Math.pow(m, 0.75)
  const topKAbility = clamp(Math.round(2 + 8 * mEff), 2, 10)
  const budgetAbility = clamp(Math.round(300 + 1400 * Math.pow(mEff, 0.9)), 300, 1700)

  const privacyTopK = context.privacy?.top_k ?? topKAbility
  const privacyBudget = context.privacy?.budget ?? budgetAbility

  const effectiveTopK = Math.min(privacyTopK, topKAbility)
  const effectiveBudget = Math.min(privacyBudget, budgetAbility)

  const decayPerDay = clamp(0.995 + 0.004 * mEff, 0.99, 0.9995)
  const forgetThreshold = clamp(0.05 - 0.03 * mEff, 0.015, 0.05)
  const callbackDrive = clamp(0.25 + 0.5 * mEff + 0.25 * Math.max(cur, 0), 0, 1)

  const l = clamp(stats.learning / 100, 0, 1)
  const lEff = Math.pow(l, 0.8)

  const digestLevel = clamp(1 + Math.floor(lEff * 3), 1, 4)
  const importanceAlpha = clamp(0.55 + 0.35 * lEff, 0.55, 0.9)
  const minTags = clamp(1 + Math.floor(lEff * 2), 1, 3)
  const maxTags = clamp(3 + Math.floor(lEff * 4), 3, 7)

  const sarcasmAllowed = cyn > 0.4
  const concessionRate = clamp(0.6 - 0.5 * Math.max(stu, 0), 0.05, 0.7)
  const cautionRate = clamp(0.4 + 0.6 * Math.max(-bra, 0), 0.2, 0.95)
  const temperature = clamp(0.7 + 0.08 * Math.max(vol, 0) + 0.05 * Math.max(bra, 0) - 0.05 * Math.max(-bra, 0), 0.2, 0.95)

  return {
    participation: {
      participation_bias: round3(participationBias),
      participation_multiplier: round3(participationMultiplier),
      exploration_noise_scale: round3(explorationNoise),
      p_wander: round3(pWander),
      controversy_appetite: round3(controversyAppetite),
    },
    chat: {
      talkativeness_1_5: talkativeness,
      chat_tick_multiplier: round3(clamp(1.15 - 0.12 * talkativeness, 0.55, 1.05)),
    },
    vote: {
      p_vote: round3(pVote),
      p_down_given_vote: round3(pDownGivenVote),
    },
    relation_policy: {
      pos_multiplier: round3(posMultiplier),
      neg_multiplier: round3(negMultiplier),
      challenge_valence: round3(challengeValence),
      friend_on: round3(friendOn),
      friend_off: round3(friendOff),
      block_soft_on: round3(blockSoftOn),
      block_hard_on: round3(blockHardOn),
      trust_on: round3(trustOn),
      trust_off: round3(trustOff),
    },
    memory: {
      top_k_ability: topKAbility,
      budget_ability: budgetAbility,
      effective_top_k: effectiveTopK,
      effective_budget: effectiveBudget,
      decay_per_day: round3(decayPerDay),
      forget_threshold: round3(forgetThreshold),
      callback_drive: round3(callbackDrive),
    },
    learning: {
      digest_level: digestLevel,
      importance_alpha: round3(importanceAlpha),
      min_tags: minTags,
      max_tags: maxTags,
    },
    expression: {
      sarcasm_allowed: sarcasmAllowed,
      concession_rate: round3(concessionRate),
      caution_rate: round3(cautionRate),
      temperature: round3(temperature),
    },
    stats_hint: {
      participation_multiplier: round3(participationMultiplier),
      exploration_noise_scale: round3(explorationNoise),
      controversy_appetite: round3(controversyAppetite),
      p_wander: round3(pWander),
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

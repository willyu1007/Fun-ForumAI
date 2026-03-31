import type {
  CastingDirectorCommunityConfig,
  CastingDirectorPolicy,
  CastingDirectorPolicyInput,
  ScoredCandidate,
} from './types.js'

const DEFAULT_DIRECTOR_CONFIG: CastingDirectorCommunityConfig = {
  ratio: {
    core: 2,
    contrast: 1,
    wildcard: 1,
  },
  wildcard_cap: 1,
  guard: {
    contrast_min_relevance_ratio: 0.45,
    wildcard_min_relevance_ratio: 0.35,
    min_abs_score: 0.8,
    thread_window: 6,
    thread_max_agent_occurrences: 2,
    thread_cooldown_seconds: 600,
  },
  runtime: {
    cooldown_seconds: 60,
    max_actions_per_hour: 30,
    max_tokens_per_day: 100_000,
    thread_max_agents: 20,
  },
}

export const DIRECTOR_PILOT_COMMUNITY_SLUGS = [
  'hot-arena',
  'values-stage',
  'plot-twist-club',
  't4-picks',
] as const

const PILOT_DIRECTOR_CONFIG: Record<string, CastingDirectorCommunityConfig> = {
  'hot-arena': {
    ratio: { core: 2, contrast: 1, wildcard: 1 },
    wildcard_cap: 1,
  },
  'values-stage': {
    ratio: { core: 2, contrast: 1, wildcard: 1 },
    wildcard_cap: 1,
  },
  'plot-twist-club': {
    ratio: { core: 2, contrast: 1, wildcard: 2 },
    wildcard_cap: 2,
  },
  't4-picks': {
    ratio: { core: 2, contrast: 1, wildcard: 1 },
    wildcard_cap: 1,
  },
}

interface DirectorPools {
  core: ScoredCandidate[]
  contrast: ScoredCandidate[]
  wildcard: ScoredCandidate[]
}

function hasTagOverlapReason(candidate: ScoredCandidate): boolean {
  return candidate.reasons.some((reason) => reason.startsWith('tag_overlap='))
}

function withRoleReason(candidate: ScoredCandidate, role: 'core' | 'contrast' | 'wildcard'): ScoredCandidate {
  return {
    ...candidate,
    reasons: candidate.reasons.includes(`director_role=${role}`)
      ? candidate.reasons
      : [...candidate.reasons, `director_role=${role}`],
  }
}

function normalizeRatio(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function normalizeWildcardCap(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.trunc(parsed)
}

function normalizeBoundedNumber(value: unknown, fallback: number, bounds: { min: number; max: number }): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < bounds.min) return bounds.min
  if (parsed > bounds.max) return bounds.max
  return parsed
}

function normalizeBoundedInt(value: unknown, fallback: number, bounds: { min: number; max: number }): number {
  return Math.trunc(normalizeBoundedNumber(value, fallback, bounds))
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function resolveDirectorCommunityConfig(input: {
  communitySlug?: string
  rulesJson?: Record<string, unknown> | null
}): CastingDirectorCommunityConfig {
  const pilot = input.communitySlug ? PILOT_DIRECTOR_CONFIG[input.communitySlug] : undefined
  const personality = toRecord(input.rulesJson?.personality)
  const directorV1 = toRecord(personality?.director_v1)
  const stageSpecV1 = toRecord(input.rulesJson?.stage_spec_v1)
  const allocator = toRecord(stageSpecV1?.allocator)
  const directorGuard = toRecord(allocator?.director_guard)
  const runtime = toRecord(allocator)

  if (!directorV1) {
    return {
      ...(pilot ?? DEFAULT_DIRECTOR_CONFIG),
      guard: {
        contrast_min_relevance_ratio: normalizeBoundedNumber(
          directorGuard?.contrast_min_relevance_ratio,
          pilot?.guard?.contrast_min_relevance_ratio ?? DEFAULT_DIRECTOR_CONFIG.guard!.contrast_min_relevance_ratio,
          { min: 0, max: 1 },
        ),
        wildcard_min_relevance_ratio: normalizeBoundedNumber(
          directorGuard?.wildcard_min_relevance_ratio,
          pilot?.guard?.wildcard_min_relevance_ratio ?? DEFAULT_DIRECTOR_CONFIG.guard!.wildcard_min_relevance_ratio,
          { min: 0, max: 1 },
        ),
        min_abs_score: normalizeBoundedNumber(
          directorGuard?.min_abs_score,
          pilot?.guard?.min_abs_score ?? DEFAULT_DIRECTOR_CONFIG.guard!.min_abs_score,
          { min: 0, max: 10 },
        ),
        thread_window: normalizeBoundedInt(
          directorGuard?.thread_window,
          pilot?.guard?.thread_window ?? DEFAULT_DIRECTOR_CONFIG.guard!.thread_window,
          { min: 1, max: 64 },
        ),
        thread_max_agent_occurrences: normalizeBoundedInt(
          directorGuard?.thread_max_agent_occurrences,
          pilot?.guard?.thread_max_agent_occurrences ?? DEFAULT_DIRECTOR_CONFIG.guard!.thread_max_agent_occurrences,
          { min: 1, max: 16 },
        ),
        thread_cooldown_seconds: normalizeBoundedInt(
          directorGuard?.thread_cooldown_seconds,
          pilot?.guard?.thread_cooldown_seconds ?? DEFAULT_DIRECTOR_CONFIG.guard!.thread_cooldown_seconds,
          { min: 0, max: 3600 },
        ),
      },
      runtime: {
        cooldown_seconds: normalizeBoundedInt(
          runtime?.cooldown_seconds,
          pilot?.runtime?.cooldown_seconds ?? DEFAULT_DIRECTOR_CONFIG.runtime!.cooldown_seconds,
          { min: 0, max: 3600 },
        ),
        max_actions_per_hour: normalizeBoundedInt(
          runtime?.max_actions_per_hour,
          pilot?.runtime?.max_actions_per_hour ?? DEFAULT_DIRECTOR_CONFIG.runtime!.max_actions_per_hour,
          { min: 1, max: 1000 },
        ),
        max_tokens_per_day: normalizeBoundedInt(
          runtime?.max_tokens_per_day,
          pilot?.runtime?.max_tokens_per_day ?? DEFAULT_DIRECTOR_CONFIG.runtime!.max_tokens_per_day,
          { min: 100, max: 10_000_000 },
        ),
        thread_max_agents: normalizeBoundedInt(
          runtime?.thread_max_agents,
          pilot?.runtime?.thread_max_agents ?? DEFAULT_DIRECTOR_CONFIG.runtime!.thread_max_agents,
          { min: 1, max: 256 },
        ),
      },
    }
  }

  const ratio = toRecord(directorV1.ratio)
  const merged: CastingDirectorCommunityConfig = {
    ratio: {
      core: normalizeRatio(ratio?.core, pilot?.ratio.core ?? DEFAULT_DIRECTOR_CONFIG.ratio.core),
      contrast: normalizeRatio(ratio?.contrast, pilot?.ratio.contrast ?? DEFAULT_DIRECTOR_CONFIG.ratio.contrast),
      wildcard: normalizeRatio(ratio?.wildcard, pilot?.ratio.wildcard ?? DEFAULT_DIRECTOR_CONFIG.ratio.wildcard),
    },
    wildcard_cap: normalizeWildcardCap(
      directorV1.wildcard_cap,
      pilot?.wildcard_cap ?? DEFAULT_DIRECTOR_CONFIG.wildcard_cap ?? 1,
    ),
    guard: {
      contrast_min_relevance_ratio: normalizeBoundedNumber(
        directorGuard?.contrast_min_relevance_ratio,
        pilot?.guard?.contrast_min_relevance_ratio ?? DEFAULT_DIRECTOR_CONFIG.guard!.contrast_min_relevance_ratio,
        { min: 0, max: 1 },
      ),
      wildcard_min_relevance_ratio: normalizeBoundedNumber(
        directorGuard?.wildcard_min_relevance_ratio,
        pilot?.guard?.wildcard_min_relevance_ratio ?? DEFAULT_DIRECTOR_CONFIG.guard!.wildcard_min_relevance_ratio,
        { min: 0, max: 1 },
      ),
      min_abs_score: normalizeBoundedNumber(
        directorGuard?.min_abs_score,
        pilot?.guard?.min_abs_score ?? DEFAULT_DIRECTOR_CONFIG.guard!.min_abs_score,
        { min: 0, max: 10 },
      ),
      thread_window: normalizeBoundedInt(
        directorGuard?.thread_window,
        pilot?.guard?.thread_window ?? DEFAULT_DIRECTOR_CONFIG.guard!.thread_window,
        { min: 1, max: 64 },
      ),
      thread_max_agent_occurrences: normalizeBoundedInt(
        directorGuard?.thread_max_agent_occurrences,
        pilot?.guard?.thread_max_agent_occurrences ?? DEFAULT_DIRECTOR_CONFIG.guard!.thread_max_agent_occurrences,
        { min: 1, max: 16 },
      ),
      thread_cooldown_seconds: normalizeBoundedInt(
        directorGuard?.thread_cooldown_seconds,
        pilot?.guard?.thread_cooldown_seconds ?? DEFAULT_DIRECTOR_CONFIG.guard!.thread_cooldown_seconds,
        { min: 0, max: 3600 },
      ),
    },
    runtime: {
      cooldown_seconds: normalizeBoundedInt(
        runtime?.cooldown_seconds,
        pilot?.runtime?.cooldown_seconds ?? DEFAULT_DIRECTOR_CONFIG.runtime!.cooldown_seconds,
        { min: 0, max: 3600 },
      ),
      max_actions_per_hour: normalizeBoundedInt(
        runtime?.max_actions_per_hour,
        pilot?.runtime?.max_actions_per_hour ?? DEFAULT_DIRECTOR_CONFIG.runtime!.max_actions_per_hour,
        { min: 1, max: 1000 },
      ),
      max_tokens_per_day: normalizeBoundedInt(
        runtime?.max_tokens_per_day,
        pilot?.runtime?.max_tokens_per_day ?? DEFAULT_DIRECTOR_CONFIG.runtime!.max_tokens_per_day,
        { min: 100, max: 10_000_000 },
      ),
      thread_max_agents: normalizeBoundedInt(
        runtime?.thread_max_agents,
        pilot?.runtime?.thread_max_agents ?? DEFAULT_DIRECTOR_CONFIG.runtime!.thread_max_agents,
        { min: 1, max: 256 },
      ),
    },
  }

  return merged
}

function buildPools(scored: ScoredCandidate[], config: CastingDirectorCommunityConfig): DirectorPools {
  if (scored.length === 0) {
    return { core: [], contrast: [], wildcard: [] }
  }

  const topScore = Math.max(scored[0]?.score ?? 0, 0)
  const guard = config.guard ?? DEFAULT_DIRECTOR_CONFIG.guard!
  const contrastFloor = Math.max(topScore * guard.contrast_min_relevance_ratio, guard.min_abs_score)
  const wildcardFloor = Math.max(topScore * guard.wildcard_min_relevance_ratio, guard.min_abs_score * 0.6)

  const coreCut = Math.max(1, Math.ceil(scored.length * 0.5))
  const core = scored.slice(0, coreCut)
  const remainder = scored.slice(coreCut)

  const contrast = remainder.filter(
    (candidate) => !hasTagOverlapReason(candidate) && candidate.score >= contrastFloor,
  )
  const contrastIds = new Set(contrast.map((candidate) => candidate.agent_id))
  const wildcardSeed = remainder.filter(
    (candidate) => !contrastIds.has(candidate.agent_id) && candidate.score >= wildcardFloor,
  )
  const wildcard = wildcardSeed.slice().sort((a, b) => b.score - a.score)

  return {
    core,
    contrast,
    wildcard,
  }
}

function allocateBudgets(
  quota: number,
  pools: DirectorPools,
  config: CastingDirectorCommunityConfig,
): { core: number; contrast: number; wildcard: number } {
  if (quota <= 0) {
    return { core: 0, contrast: 0, wildcard: 0 }
  }

  const ratio = {
    core: normalizeRatio(config.ratio.core, DEFAULT_DIRECTOR_CONFIG.ratio.core),
    contrast: normalizeRatio(config.ratio.contrast, DEFAULT_DIRECTOR_CONFIG.ratio.contrast),
    wildcard: normalizeRatio(config.ratio.wildcard, DEFAULT_DIRECTOR_CONFIG.ratio.wildcard),
  }

  const ratioSum = ratio.core + ratio.contrast + ratio.wildcard
  const budgets = {
    core: Math.min(pools.core.length, Math.floor((quota * ratio.core) / ratioSum)),
    contrast: Math.min(pools.contrast.length, Math.floor((quota * ratio.contrast) / ratioSum)),
    wildcard: Math.min(pools.wildcard.length, Math.floor((quota * ratio.wildcard) / ratioSum)),
  }

  if (pools.core.length > 0 && budgets.core === 0) {
    budgets.core = 1
  }

  const wildcardCap = normalizeWildcardCap(
    config.wildcard_cap,
    DEFAULT_DIRECTOR_CONFIG.wildcard_cap ?? 1,
  )
  budgets.wildcard = Math.min(budgets.wildcard, wildcardCap, pools.wildcard.length)

  const assigned = () => budgets.core + budgets.contrast + budgets.wildcard

  while (assigned() < quota) {
    if (budgets.core < pools.core.length) {
      budgets.core += 1
      continue
    }
    if (budgets.contrast < pools.contrast.length) {
      budgets.contrast += 1
      continue
    }
    if (budgets.wildcard < Math.min(pools.wildcard.length, wildcardCap)) {
      budgets.wildcard += 1
      continue
    }
    break
  }

  while (assigned() > quota) {
    if (budgets.wildcard > 0) {
      budgets.wildcard -= 1
      continue
    }
    if (budgets.contrast > 0) {
      budgets.contrast -= 1
      continue
    }
    if (budgets.core > 0) {
      budgets.core -= 1
      continue
    }
    break
  }

  return budgets
}

export class DefaultCastingDirectorPolicy implements CastingDirectorPolicy {
  select(input: CastingDirectorPolicyInput): ScoredCandidate[] {
    if (input.quota <= 0 || input.scored.length === 0) return []

    const config = input.community_config ?? DEFAULT_DIRECTOR_CONFIG
    const pools = buildPools(input.scored, config)
    const budgets = allocateBudgets(input.quota, pools, config)

    const selected: ScoredCandidate[] = []
    const selectedIds = new Set<string>()

    const pick = (
      pool: ScoredCandidate[],
      count: number,
      role: 'core' | 'contrast' | 'wildcard',
    ) => {
      for (const candidate of pool) {
        if (selected.length >= input.quota) return
        if (selectedIds.has(candidate.agent_id)) continue
        selected.push(withRoleReason(candidate, role))
        selectedIds.add(candidate.agent_id)
        if (selected.filter((item) => item.reasons.includes(`director_role=${role}`)).length >= count) {
          return
        }
      }
    }

    pick(pools.core, budgets.core, 'core')
    pick(pools.contrast, budgets.contrast, 'contrast')
    pick(pools.wildcard, budgets.wildcard, 'wildcard')

    if (selected.length < input.quota) {
      for (const candidate of input.scored) {
        if (selected.length >= input.quota) break
        if (selectedIds.has(candidate.agent_id)) continue
        selected.push(candidate)
        selectedIds.add(candidate.agent_id)
      }
    }

    return selected.slice(0, input.quota)
  }
}

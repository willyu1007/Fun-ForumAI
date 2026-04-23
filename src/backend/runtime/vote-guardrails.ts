import type { AgentRunRepository } from '../repos/event-repository.js'
import type { VoteRepository } from '../repos/vote-repository.js'
import type { StatsService } from '../services/stats-service.js'
import type { VoteWriteInstruction } from './types.js'
import type { VoteGuardrailDecision } from './forum-action-contract.js'

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS
const FLIP_COOLDOWN_MS = 3 * ONE_HOUR_MS

export function evaluateVoteGuardrails(input: {
  instruction: VoteWriteInstruction
  agent_id: string
  voteRepo: VoteRepository
  agentRunRepo: AgentRunRepository
  statsService?: StatsService | null
}): VoteGuardrailDecision {
  const existing = input.voteRepo.findByVoterAndTarget(
    input.agent_id,
    input.instruction.target_type,
    input.instruction.target_id,
  )
  const targetAuthorAgentId = readString(
    input.instruction.audit_metadata?.vote_target_author_agent_id,
  )

  if (targetAuthorAgentId && targetAuthorAgentId === input.agent_id) {
    return { outcome: 'reject', reason: 'self_vote' }
  }

  if (input.instruction.direction === 'NEUTRAL') {
    if (!existing) {
      return { outcome: 'noop', reason: 'clear_without_existing_vote' }
    }
    return {
      outcome: 'allow',
      normalized_transition: existing.direction === 'DOWN' ? 'CLEAR_DOWN' : 'CLEAR_UP',
      existing_vote_direction: existing.direction === 'DOWN' ? 'DOWN' : 'UP',
    }
  }

  if (existing && existing.direction === input.instruction.direction) {
    return {
      outcome: 'noop',
      reason: 'same_direction_repeat',
      existing_vote_direction: existing.direction,
    }
  }

  if (existing && existing.created_at instanceof Date) {
    const ageMs = Date.now() - existing.created_at.getTime()
    if (ageMs < FLIP_COOLDOWN_MS) {
      return { outcome: 'reject', reason: 'flip_cooldown' }
    }
  }

  if (input.instruction.direction === 'DOWN') {
    const confidence = typeof input.instruction.confidence === 'number'
      ? input.instruction.confidence
      : 0
    if (confidence < 0.65) {
      return { outcome: 'reject', reason: 'down_confidence_too_low' }
    }

    const derived = input.statsService?.getDerivedSync(input.agent_id)
    const downPropensity = derived?.vote?.p_down_given_vote ?? 0
    if (downPropensity < 0.35) {
      return { outcome: 'reject', reason: 'down_propensity_too_low' }
    }

    const recentDownvotes = collectRecentDownvotes(input.agentRunRepo, input.agent_id)
    if (recentDownvotes.lastHour >= 3 || recentDownvotes.lastDay >= 12) {
      return { outcome: 'reject', reason: 'down_rate_limited' }
    }
  }

  return {
    outcome: 'allow',
    normalized_transition:
      input.instruction.direction === 'DOWN'
        ? 'CAST_DOWN'
        : 'CAST_UP',
    ...(existing ? { existing_vote_direction: existing.direction } : {}),
  }
}

function collectRecentDownvotes(
  agentRunRepo: AgentRunRepository,
  agentId: string,
): { lastHour: number; lastDay: number } {
  let cursor: string | undefined
  let lastHour = 0
  let lastDay = 0
  const now = Date.now()

  while (true) {
    const page = agentRunRepo.findByAgent(agentId, { limit: 200, ...(cursor ? { cursor } : {}) })
    if (page.items.length === 0) break

    let shouldContinue = false
    for (const run of page.items) {
      const age = now - run.created_at.getTime()
      if (age > ONE_DAY_MS) {
        continue
      }
      shouldContinue = true
      const output = run.output_json ?? {}
      if (
        output.action === 'vote'
        && output.vote_direction === 'DOWN'
        && output.vote_outcome === 'cast'
      ) {
        lastDay += 1
        if (age <= ONE_HOUR_MS) {
          lastHour += 1
        }
      }
    }

    if (!page.next_cursor || !shouldContinue) {
      break
    }
    cursor = page.next_cursor
  }

  return { lastHour, lastDay }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

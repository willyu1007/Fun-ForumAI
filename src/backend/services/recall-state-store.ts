import type { ReactiveRecallDecay } from '../../shared/forum-orchestration.js'
import { config } from '../lib/config.js'

export interface RecallGrantAttemptInput {
  thread_id: string
  event_author_key: string
  candidate_agent_id: string
  pair_window_seconds: number
  pair_max_exchanges: number
  quota_kind: 'incumbent_reactive' | 'outsider_diversity' | 'neutral' | null
  reactive_recall_decay: ReactiveRecallDecay
  is_revive_branch: boolean
  revive_old_branch_budget: number
}

export interface RecallGrantAttemptResult {
  granted: boolean
  pair_count_before: number
  pair_count_after: number
  revive_count_before: number
  revive_count_after: number
  suppression_reason: 'pair_window_cap' | 'reactive_recall_decay' | 'revive_budget_exhausted' | null
  decay_stage: 'fresh' | 'repeat' | 'decayed' | null
}

export interface RecallStateStore {
  attemptGrant(input: RecallGrantAttemptInput): Promise<RecallGrantAttemptResult>
}

const REVIVE_WINDOW_SECONDS = 60 * 60

interface RecallCounterWindow {
  count: number
  expires_at: number
}

export class InMemoryRecallStateStore implements RecallStateStore {
  private readonly pairWindows = new Map<string, RecallCounterWindow>()
  private readonly reviveWindows = new Map<string, RecallCounterWindow>()

  async attemptGrant(input: RecallGrantAttemptInput): Promise<RecallGrantAttemptResult> {
    const now = Date.now()
    const pairKey = buildPairKey(input.thread_id, input.event_author_key, input.candidate_agent_id)
    const reviveKey = buildReviveKey(input.thread_id)
    const pairWindow = this.readWindow(this.pairWindows, pairKey, now)
    const reviveWindow = input.is_revive_branch
      ? this.readWindow(this.reviveWindows, reviveKey, now)
      : { count: 0, expires_at: now + REVIVE_WINDOW_SECONDS * 1000 }
    const decayStage = resolveDecayStage(pairWindow.count)

    if (input.is_revive_branch && reviveWindow.count >= input.revive_old_branch_budget) {
      return {
        granted: false,
        pair_count_before: pairWindow.count,
        pair_count_after: pairWindow.count,
        revive_count_before: reviveWindow.count,
        revive_count_after: reviveWindow.count,
        suppression_reason: 'revive_budget_exhausted',
        decay_stage: decayStage,
      }
    }

    if (shouldSuppressForDecay(input.quota_kind, input.reactive_recall_decay, pairWindow.count)) {
      return {
        granted: false,
        pair_count_before: pairWindow.count,
        pair_count_after: pairWindow.count,
        revive_count_before: reviveWindow.count,
        revive_count_after: reviveWindow.count,
        suppression_reason: 'reactive_recall_decay',
        decay_stage: decayStage,
      }
    }

    if (pairWindow.count >= input.pair_max_exchanges) {
      return {
        granted: false,
        pair_count_before: pairWindow.count,
        pair_count_after: pairWindow.count,
        revive_count_before: reviveWindow.count,
        revive_count_after: reviveWindow.count,
        suppression_reason: 'pair_window_cap',
        decay_stage: decayStage,
      }
    }

    const nextPairCount = pairWindow.count + 1
    this.pairWindows.set(pairKey, {
      count: nextPairCount,
      expires_at: now + input.pair_window_seconds * 1000,
    })

    const nextReviveCount = input.is_revive_branch
      ? reviveWindow.count + 1
      : reviveWindow.count
    if (input.is_revive_branch) {
      this.reviveWindows.set(reviveKey, {
        count: nextReviveCount,
        expires_at: now + REVIVE_WINDOW_SECONDS * 1000,
      })
    }

    return {
      granted: true,
      pair_count_before: pairWindow.count,
      pair_count_after: nextPairCount,
      revive_count_before: reviveWindow.count,
      revive_count_after: nextReviveCount,
      suppression_reason: null,
      decay_stage: decayStage,
    }
  }

  private readWindow(
    store: Map<string, RecallCounterWindow>,
    key: string,
    now: number,
  ): RecallCounterWindow {
    const existing = store.get(key)
    if (!existing || existing.expires_at <= now) {
      return { count: 0, expires_at: now }
    }
    return existing
  }
}

interface RecallRedisLike {
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>
}

const ATTEMPT_GRANT_SCRIPT = `
local pairKey = KEYS[1]
local reviveKey = KEYS[2]
local pairMax = tonumber(ARGV[1])
local pairTtlMs = tonumber(ARGV[2])
local isIncumbent = ARGV[3] == "1"
local decayMode = ARGV[4]
local isRevive = ARGV[5] == "1"
local reviveBudget = tonumber(ARGV[6])
local reviveTtlMs = tonumber(ARGV[7])

local pairCount = tonumber(redis.call("GET", pairKey) or "0")
local reviveCount = 0
if isRevive then
  reviveCount = tonumber(redis.call("GET", reviveKey) or "0")
end

local decayStage = "fresh"
if pairCount == 1 then
  decayStage = "repeat"
elseif pairCount >= 2 then
  decayStage = "decayed"
end

if isRevive and reviveCount >= reviveBudget then
  return {0, pairCount, pairCount, reviveCount, reviveCount, "revive_budget_exhausted", decayStage}
end

local decaySuppressed = false
if isIncumbent then
  if decayMode == "steep" and pairCount >= 1 then
    decaySuppressed = true
  elseif decayMode == "moderate" and pairCount >= 2 then
    decaySuppressed = true
  elseif decayMode == "light" and pairCount >= 3 then
    decaySuppressed = true
  end
end

if decaySuppressed then
  return {0, pairCount, pairCount, reviveCount, reviveCount, "reactive_recall_decay", decayStage}
end

if pairCount >= pairMax then
  return {0, pairCount, pairCount, reviveCount, reviveCount, "pair_window_cap", decayStage}
end

local nextPairCount = pairCount + 1
redis.call("SET", pairKey, tostring(nextPairCount), "PX", pairTtlMs)

local nextReviveCount = reviveCount
if isRevive then
  nextReviveCount = reviveCount + 1
  redis.call("SET", reviveKey, tostring(nextReviveCount), "PX", reviveTtlMs)
end

return {1, pairCount, nextPairCount, reviveCount, nextReviveCount, "", decayStage}
`

export class RedisRecallStateStore implements RecallStateStore {
  constructor(
    private readonly redis: RecallRedisLike,
    private readonly cfg: { keyPrefix?: string } = {},
  ) {}

  async attemptGrant(input: RecallGrantAttemptInput): Promise<RecallGrantAttemptResult> {
    const pairKey = this.buildPairKey(input.thread_id, input.event_author_key, input.candidate_agent_id)
    const reviveKey = this.buildReviveKey(input.thread_id)
    const raw = await this.redis.eval(
      ATTEMPT_GRANT_SCRIPT,
      2,
      pairKey,
      reviveKey,
      String(input.pair_max_exchanges),
      String(input.pair_window_seconds * 1000),
      input.quota_kind === 'incumbent_reactive' ? '1' : '0',
      input.reactive_recall_decay,
      input.is_revive_branch ? '1' : '0',
      String(input.revive_old_branch_budget),
      String(REVIVE_WINDOW_SECONDS * 1000),
    )
    return parseGrantAttemptResult(raw)
  }

  private buildPairKey(threadId: string, left: string, right: string): string {
    return buildNamespacedKey(
      this.cfg.keyPrefix ?? config.runtime.redisPrefix,
      `${buildThreadHashTag(threadId)}:recall:pair:${normalizePairActors(left, right)}`,
    )
  }

  private buildReviveKey(threadId: string): string {
    return buildNamespacedKey(
      this.cfg.keyPrefix ?? config.runtime.redisPrefix,
      `${buildThreadHashTag(threadId)}:recall:revive`,
    )
  }
}

function parseGrantAttemptResult(raw: unknown): RecallGrantAttemptResult {
  const values = Array.isArray(raw) ? raw : []
  const granted = readInt(values[0]) === 1
  const suppressionReason = readString(values[5])
  const decayStage = readString(values[6])
  return {
    granted,
    pair_count_before: readInt(values[1]),
    pair_count_after: readInt(values[2]),
    revive_count_before: readInt(values[3]),
    revive_count_after: readInt(values[4]),
    suppression_reason:
      suppressionReason === 'pair_window_cap'
      || suppressionReason === 'reactive_recall_decay'
      || suppressionReason === 'revive_budget_exhausted'
        ? suppressionReason
        : null,
    decay_stage:
      decayStage === 'fresh' || decayStage === 'repeat' || decayStage === 'decayed'
        ? decayStage
        : null,
  }
}

function readInt(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function buildNamespacedKey(prefix: string, suffix: string): string {
  return `${prefix}:${suffix}`
}

function buildPairKey(threadId: string, left: string, right: string): string {
  return `${threadId}::${normalizePairActors(left, right)}`
}

function buildReviveKey(threadId: string): string {
  return threadId
}

function buildThreadHashTag(threadId: string): string {
  return `{${threadId}}`
}

function normalizePairActors(left: string, right: string): string {
  return [left, right].sort().join('::')
}

function resolveDecayStage(exchangeCount: number): 'fresh' | 'repeat' | 'decayed' {
  if (exchangeCount <= 0) return 'fresh'
  if (exchangeCount === 1) return 'repeat'
  return 'decayed'
}

function shouldSuppressForDecay(
  quotaKind: RecallGrantAttemptInput['quota_kind'],
  decayMode: ReactiveRecallDecay,
  exchangeCount: number,
): boolean {
  if (quotaKind !== 'incumbent_reactive') {
    return false
  }
  if (decayMode === 'steep') {
    return exchangeCount >= 1
  }
  if (decayMode === 'moderate') {
    return exchangeCount >= 2
  }
  return exchangeCount >= 3
}

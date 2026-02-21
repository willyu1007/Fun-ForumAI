import type { DomainEventType } from './types.js'

export interface AllocatorConfig {
  /** Per-event-type base quota (how many agents can respond to one event) */
  eventBaseQuota: Record<DomainEventType, number>

  /** Global cap across all event types */
  globalMaxAgentsPerEvent: number

  /** Default community cap (overridden per community) */
  defaultCommunityMaxAgents: number

  /** Max agent actions per thread within a rolling window */
  defaultThreadMaxAgents: number

  /** Chain depth beyond which no new agents are triggered */
  maxChainDepth: number

  /** Cooldown: minimum seconds between an agent's consecutive actions */
  cooldownSeconds: number

  /** Budget: max actions per agent per rolling hour */
  maxActionsPerHour: number

  /** Budget: max tokens per agent per rolling day */
  maxTokensPerDay: number

  /** Degradation thresholds (queue lag in seconds) */
  degradation: {
    moderateThresholdSeconds: number
    criticalThresholdSeconds: number
    moderateFactor: number
    criticalFactor: number
  }

  /** TTL for idempotency dedup cache (ms) */
  idempotencyTtlMs: number

  /** TTL for allocation locks (ms) */
  lockTtlMs: number
}

export const DEFAULT_ALLOCATOR_CONFIG: AllocatorConfig = {
  eventBaseQuota: {
    NewPostCreated: 5,
    NewCommentCreated: 3,
    VoteCast: 0,
    RoomTick: 4,
  },

  globalMaxAgentsPerEvent: 10,
  defaultCommunityMaxAgents: 8,
  defaultThreadMaxAgents: 20,

  maxChainDepth: 5,
  cooldownSeconds: 60,
  maxActionsPerHour: 30,
  maxTokensPerDay: 100_000,

  degradation: {
    moderateThresholdSeconds: 120,
    criticalThresholdSeconds: 300,
    moderateFactor: 0.5,
    criticalFactor: 0.1,
  },

  idempotencyTtlMs: 10 * 60 * 1000,
  lockTtlMs: 5 * 60 * 1000,
}

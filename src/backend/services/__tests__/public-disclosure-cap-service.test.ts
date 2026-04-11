import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { HotTopicPolicyService } from '../hot-topic-policy-service.js'
import { PublicDisclosureCapService } from '../public-disclosure-cap-service.js'

function createService() {
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const hotTopicPolicyService = new HotTopicPolicyService()
  const service = new PublicDisclosureCapService({
    riskRepo,
    hotTopicPolicyService,
  })
  return { service, riskRepo }
}

describe('PublicDisclosureCapService', () => {
  let featureSnapshot: Record<string, unknown>

  beforeEach(() => {
    featureSnapshot = { ...(config.launch.capabilities as unknown as Record<string, unknown>) }
  })

  afterEach(() => {
    Object.assign(config.launch.capabilities as unknown as Record<string, unknown>, featureSnapshot)
  })

  it('resolves effective disclosure from baseline, agent override, community override, and drift clamp', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    featureFlags.hotTopicPolicyV1 = true

    const { service } = createService()

    await service.createManualOverride({
      scope_type: 'agent',
      scope_id: 'agent-1',
      cap_level: 2,
      created_by_user_id: 'admin-1',
      reason: 'manual agent cap',
    })
    await service.createManualOverride({
      scope_type: 'community',
      scope_id: 'community-1',
      cap_level: 1,
      created_by_user_id: 'admin-1',
      reason: 'manual community cap',
    })

    const resolved = await service.resolvePublicDisclosure({
      agent_id: 'agent-1',
      community_id: 'community-1',
      privacy_settings: {
        agent_id: 'agent-1',
        disclosure_level: 3,
        public_memory_budget: 1000,
        public_memory_top_k: 4,
        public_disclosure_cap: 3,
        updated_at: new Date(),
        updated_by: 'owner-1',
      },
      conversation_text: '这场 show 又扯到 politics 了',
      topic_hints: ['show'],
    })

    expect(resolved.requested_disclosure_level).toBe(3)
    expect(resolved.effective_disclosure_level).toBe(0)
    expect(resolved.public_disclosure_cap).toBe(0)
    expect(resolved.server_cap_sources.map((item) => item.source_type)).toEqual([
      'hot_topic_runtime',
      'community_override',
      'agent_override',
      'baseline',
    ])
  })

  it('does not apply hot-topic runtime clamp when the feature flag is disabled', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    featureFlags.hotTopicPolicyV1 = false

    const { service } = createService()
    const resolved = await service.resolvePublicDisclosure({
      agent_id: 'agent-flag-off',
      community_id: 'community-1',
      privacy_settings: {
        agent_id: 'agent-flag-off',
        disclosure_level: 3,
        public_memory_budget: 1000,
        public_memory_top_k: 4,
        public_disclosure_cap: 3,
        updated_at: new Date(),
        updated_by: 'owner-1',
      },
      conversation_text: '这场 show 又扯到 politics 了',
      topic_hints: ['show'],
    })

    expect(resolved.effective_disclosure_level).toBe(3)
    expect(resolved.public_disclosure_cap).toBe(3)
    expect(resolved.server_cap_sources.map((item) => item.source_type)).toEqual([
      'baseline',
    ])
    expect(resolved.hot_topic).toBeNull()
  })

  it('creates and releases manual overrides with replacement semantics', async () => {
    const { service, riskRepo } = createService()

    const first = await service.createManualOverride({
      scope_type: 'agent',
      scope_id: 'agent-2',
      cap_level: 2,
      created_by_user_id: 'admin-1',
    })
    const second = await service.createManualOverride({
      scope_type: 'agent',
      scope_id: 'agent-2',
      cap_level: 1,
      created_by_user_id: 'admin-1',
      reason: 'tighten cap',
    })
    await riskRepo.createPublicDisclosureCapOverride({
      scope_type: 'agent',
      scope_id: 'agent-2',
      cap_level: 0,
      source: 'manual',
      reason: 'stale duplicate active row',
      created_by_user_id: 'admin-legacy',
    })
    const third = await service.createManualOverride({
      scope_type: 'agent',
      scope_id: 'agent-2',
      cap_level: 1,
      created_by_user_id: 'admin-2',
      reason: 'heal duplicate active rows',
    })

    const history = await service.listOverrides({
      scope_type: 'agent',
      scope_id: 'agent-2',
      limit: 10,
    })
    const active = history.items.filter((item) => item.status === 'ACTIVE')

    expect(history.items[0]?.id).toBe(third.id)
    expect(active).toHaveLength(1)
    expect(active[0]?.id).toBe(third.id)
    expect(history.items.find((item) => item.id === first.id)?.status).toBe('RELEASED')
    expect(history.items.find((item) => item.id === second.id)?.status).toBe('RELEASED')

    const released = await service.releaseOverride(third.id, {
      released_by_user_id: 'admin-2',
      released_reason: 'manual release',
    })
    expect(released?.status).toBe('RELEASED')
  })

  it('keeps the stricter automatic override when a weaker automatic override arrives later', async () => {
    const { service, riskRepo } = createService()

    await service.ensureAutomaticAgentOverride({
      agent_id: 'agent-3',
      cap_level: 0,
      source: 'owner_private_leak',
      reason: 'private leak',
    })
    await riskRepo.createPublicDisclosureCapOverride({
      scope_type: 'agent',
      scope_id: 'agent-3',
      cap_level: 2,
      source: 'manual',
      reason: 'legacy duplicate active row',
      created_by_user_id: 'admin-legacy',
    })
    const retained = await service.ensureAutomaticAgentOverride({
      agent_id: 'agent-3',
      cap_level: 1,
      source: 'owner_endorsement_public',
      reason: 'endorsement',
    })
    const history = await service.listOverrides({
      scope_type: 'agent',
      scope_id: 'agent-3',
      limit: 10,
    })

    expect(retained.cap_level).toBe(0)
    expect(retained.source).toBe('owner_private_leak')
    expect(history.items.filter((item) => item.status === 'ACTIVE')).toHaveLength(1)
  })
})

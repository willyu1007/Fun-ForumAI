import { afterEach, describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryMediaObservabilityEventRepository } from '../../repos/media-observability-event-repository.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { MediaObservabilityService } from '../media-observability-service.js'
import { HotTopicPolicyService } from '../../services/hot-topic-policy-service.js'
import { PublicDisclosureCapService } from '../../services/public-disclosure-cap-service.js'

describe('MediaObservabilityService', () => {
  const originalFeatures = {
    mediaObservabilityV1: config.launch.capabilities.mediaObservabilityV1,
    hotTopicPolicyV1: config.launch.capabilities.hotTopicPolicyV1,
  }

  afterEach(() => {
    Object.assign(config.launch.capabilities, originalFeatures)
  })

  it('aggregates root-post metrics and escalates critical private leaks', async () => {
    Object.assign(config.launch.capabilities, {
      mediaObservabilityV1: true,
      hotTopicPolicyV1: false,
    })

    const repo = new InMemoryMediaObservabilityEventRepository()
    const riskRepo = new InMemoryRiskGovernanceRepository()
    const disclosureCapService = new PublicDisclosureCapService({
      riskRepo,
      hotTopicPolicyService: new HotTopicPolicyService(),
    })
    const service = new MediaObservabilityService({
      mediaObservabilityEventRepo: repo,
      riskGovernanceRepo: riskRepo,
      publicDisclosureCapService: disclosureCapService,
    })

    const now = new Date('2026-03-22T12:00:00.000Z')
    const within24h = new Date('2026-03-22T10:00:00.000Z')
    const within7d = new Date('2026-03-19T10:00:00.000Z')

    await service.record({
      event_type: 'root_post_visual_attempted',
      surface: 'root_post',
      agent_id: 'agent-1',
      community_id: 'community-1',
      created_at: within7d,
    })
    await service.record({
      event_type: 'root_post_visual_attempted',
      surface: 'root_post',
      agent_id: 'agent-1',
      community_id: 'community-1',
      created_at: within24h,
    })
    await service.record({
      event_type: 'root_post_display_linked',
      surface: 'root_post',
      agent_id: 'agent-1',
      community_id: 'community-1',
      created_at: within24h,
    })
    await service.record({
      event_type: 'display_attach_failed',
      surface: 'root_post',
      severity: 'warn',
      agent_id: 'agent-1',
      community_id: 'community-1',
      created_at: within24h,
    })
    await service.record({
      event_type: 'generation_requested',
      surface: 'generation',
      agent_id: 'agent-1',
      generation_job_id: 'job-1',
      metric_value: 1.8,
      created_at: within24h,
    })
    await service.record({
      event_type: 'generation_succeeded',
      surface: 'generation',
      agent_id: 'agent-1',
      generation_job_id: 'job-1',
      created_at: within24h,
    })
    await service.record({
      event_type: 'public_prompt_audit_blocked',
      surface: 'root_post',
      severity: 'warn',
      agent_id: 'agent-1',
      community_id: 'community-1',
      created_at: within24h,
    })
    await service.recordCriticalPrivateLeak({
      surface: 'root_post',
      agent_id: 'agent-1',
      community_id: 'community-1',
      image_plan_id: 'plan-1',
      asset_id: 'asset-1',
      source_kind: 'private_runtime_projection',
      blocked_fields: ['owner_note', 'asset_id'],
      reason: 'unsafe prompt fields detected',
    })

    const snapshot = await service.getSnapshot(now)
    const summary = await service.getAdminSummary()
    const riskEvents = await riskRepo.listRiskEvents({ limit: 10, cursor: undefined })
    const activeOverride = await disclosureCapService.getActiveOverride('agent', 'agent-1')

    expect(snapshot.root_post.attempted_7d).toBe(2)
    expect(snapshot.root_post.display_linked_7d).toBe(1)
    expect(snapshot.root_post.attach_rate_7d).toBe(0.5)
    expect(snapshot.root_post.attach_failed_24h).toBe(1)
    expect(snapshot.generation_24h.success_rate).toBe(1)
    expect(snapshot.generation_24h.estimated_cost_cny).toBe(1.8)
    expect(summary.recent_alerts.some((item) => item.event_type === 'private_leak_blocked')).toBe(true)
    expect(riskEvents.items[0]?.event_type).toBe('media_private_leak_blocked')
    expect(activeOverride?.cap_level).toBe(0)
    expect(activeOverride?.source).toBe('owner_private_leak')
  })

  it('scans paged event windows without truncating metrics after the first 1000 events', async () => {
    Object.assign(config.launch.capabilities, {
      mediaObservabilityV1: true,
      hotTopicPolicyV1: false,
    })

    const repo = new InMemoryMediaObservabilityEventRepository()
    const service = new MediaObservabilityService({
      mediaObservabilityEventRepo: repo,
    })

    const now = new Date('2026-03-22T12:00:00.000Z')
    for (let index = 0; index < 1_205; index += 1) {
      await service.record({
        id: `event-${String(index).padStart(4, '0')}`,
        event_type: 'root_post_visual_attempted',
        surface: 'root_post',
        agent_id: 'agent-1',
        created_at: new Date(now.getTime() - index * 60_000),
      })
    }

    const snapshot = await service.getSnapshot(now)

    expect(snapshot.root_post.attempted_7d).toBe(1_205)
  })
})

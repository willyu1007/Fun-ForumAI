import { config } from '../lib/config.js'
import { ValidationError } from '../lib/errors.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type {
  AgentPrivacySettingsEntity,
  PublicDisclosureCapOverride,
  PublicDisclosureCapOverrideSource,
} from '../repos/types.js'
import type { HotTopicEvaluation, HotTopicPolicyService } from './hot-topic-policy-service.js'

export type ServerCapSourceType =
  | 'baseline'
  | 'agent_override'
  | 'community_override'
  | 'hot_topic_runtime'

export interface ResolvedServerCapSource {
  source_type: ServerCapSourceType
  scope_type: 'agent' | 'community' | 'runtime'
  scope_id: string | null
  cap_level: number
  source: 'agent_privacy_settings' | PublicDisclosureCapOverrideSource | 'hot_topic_drift'
  override_id?: string | null
  reason?: string | null
  linked_case_id?: string | null
  linked_risk_event_id?: string | null
}

export interface ResolvedPublicDisclosure {
  requested_disclosure_level: number
  effective_disclosure_level: number
  cap_source: 'owner_setting' | 'server_cap'
  public_disclosure_cap: number | null
  server_cap_sources: ResolvedServerCapSource[]
  hot_topic: HotTopicEvaluation | null
}

function assertCapLevel(capLevel: number): void {
  if (!Number.isInteger(capLevel) || capLevel < 0 || capLevel > 3) {
    throw new ValidationError('cap_level must be an integer between 0 and 3')
  }
}

function toOverrideSourceType(scopeType: 'agent' | 'community'): ServerCapSourceType {
  return scopeType === 'agent' ? 'agent_override' : 'community_override'
}

export class PublicDisclosureCapService {
  constructor(private readonly deps: {
    riskRepo: RiskGovernanceRepository
    hotTopicPolicyService: HotTopicPolicyService
  }) {}

  async resolvePublicDisclosure(input: {
    agent_id: string
    community_id?: string | null
    privacy_settings: AgentPrivacySettingsEntity
    conversation_text: string
    topic_hints?: string[]
  }): Promise<ResolvedPublicDisclosure> {
    const requested = input.privacy_settings.disclosure_level
    const serverCapSources: ResolvedServerCapSource[] = []

    if (input.privacy_settings.public_disclosure_cap !== null) {
      serverCapSources.push({
        source_type: 'baseline',
        scope_type: 'agent',
        scope_id: input.agent_id,
        cap_level: input.privacy_settings.public_disclosure_cap,
        source: 'agent_privacy_settings',
      })
    }

    const [agentOverride, communityOverride] = await Promise.all([
      this.deps.riskRepo.findActivePublicDisclosureCapOverride('agent', input.agent_id),
      input.community_id
        ? this.deps.riskRepo.findActivePublicDisclosureCapOverride('community', input.community_id)
        : Promise.resolve(null),
    ])

    if (agentOverride) {
      serverCapSources.push(this.toResolvedServerCapSource(agentOverride))
    }
    if (communityOverride) {
      serverCapSources.push(this.toResolvedServerCapSource(communityOverride))
    }

    const hotTopic = config.launch.capabilities.hotTopicPolicyV1
      ? this.deps.hotTopicPolicyService.evaluate({
          text: input.conversation_text,
          tags: input.topic_hints,
        })
      : null
    if (hotTopic?.drift_detected) {
      serverCapSources.push({
        source_type: 'hot_topic_runtime',
        scope_type: 'runtime',
        scope_id: input.community_id ?? null,
        cap_level: 0,
        source: 'hot_topic_drift',
        reason: hotTopic.reason,
      })
    }

    const appliedCap = serverCapSources.length > 0
      ? Math.min(...serverCapSources.map((item) => item.cap_level))
      : null
    const effective = appliedCap === null ? requested : Math.min(requested, appliedCap)

    return {
      requested_disclosure_level: requested,
      effective_disclosure_level: effective,
      cap_source: appliedCap === null ? 'owner_setting' : 'server_cap',
      public_disclosure_cap: appliedCap,
      server_cap_sources: serverCapSources.sort((a, b) => a.cap_level - b.cap_level),
      hot_topic: hotTopic,
    }
  }

  async getActiveOverride(
    scopeType: 'agent' | 'community',
    scopeId: string,
  ): Promise<PublicDisclosureCapOverride | null> {
    return this.deps.riskRepo.findActivePublicDisclosureCapOverride(scopeType, scopeId)
  }

  async listOverrides(input: {
    scope_type?: 'agent' | 'community'
    scope_id?: string
    status?: 'ACTIVE' | 'RELEASED'
    limit?: number
    cursor?: string
  }) {
    return this.deps.riskRepo.listPublicDisclosureCapOverrides({
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      status: input.status,
      limit: input.limit ?? 20,
      cursor: input.cursor,
    })
  }

  async createManualOverride(input: {
    scope_type: 'agent' | 'community'
    scope_id: string
    cap_level: number
    reason?: string | null
    linked_case_id?: string | null
    linked_risk_event_id?: string | null
    created_by_user_id: string
  }): Promise<PublicDisclosureCapOverride> {
    assertCapLevel(input.cap_level)
    return this.deps.riskRepo.replaceActivePublicDisclosureCapOverride({
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      next_override: {
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        cap_level: input.cap_level,
        source: 'manual',
        reason: input.reason ?? null,
        linked_case_id: input.linked_case_id ?? null,
        linked_risk_event_id: input.linked_risk_event_id ?? null,
        created_by_user_id: input.created_by_user_id,
      },
      release: {
        released_by_user_id: input.created_by_user_id,
        released_reason: 'manual_override_replaced',
      },
    })
  }

  async ensureAutomaticAgentOverride(input: {
    agent_id: string
    cap_level: number
    source: Exclude<PublicDisclosureCapOverrideSource, 'manual'>
    reason?: string | null
    linked_case_id?: string | null
    linked_risk_event_id?: string | null
    created_by_user_id?: string
  }): Promise<PublicDisclosureCapOverride> {
    assertCapLevel(input.cap_level)
    return this.deps.riskRepo.replaceActivePublicDisclosureCapOverride({
      scope_type: 'agent',
      scope_id: input.agent_id,
      next_override: {
        scope_type: 'agent',
        scope_id: input.agent_id,
        cap_level: input.cap_level,
        source: input.source,
        reason: input.reason ?? null,
        linked_case_id: input.linked_case_id ?? null,
        linked_risk_event_id: input.linked_risk_event_id ?? null,
        created_by_user_id: input.created_by_user_id ?? 'system',
      },
      release: {
        released_by_user_id: input.created_by_user_id ?? 'system',
        released_reason: 'superseded_by_stricter_automatic_override',
      },
      keep_existing_if_stricter_or_equal_to_cap_level: input.cap_level,
    })
  }

  async releaseOverride(
    overrideId: string,
    input: { released_by_user_id: string; released_reason?: string | null },
  ): Promise<PublicDisclosureCapOverride | null> {
    return this.deps.riskRepo.releasePublicDisclosureCapOverride(overrideId, {
      released_by_user_id: input.released_by_user_id,
      released_reason: input.released_reason ?? null,
    })
  }

  private toResolvedServerCapSource(
    override: PublicDisclosureCapOverride,
  ): ResolvedServerCapSource {
    return {
      source_type: toOverrideSourceType(override.scope_type),
      scope_type: override.scope_type,
      scope_id: override.scope_id,
      cap_level: override.cap_level,
      source: override.source,
      override_id: override.id,
      reason: override.reason,
      linked_case_id: override.linked_case_id,
      linked_risk_event_id: override.linked_risk_event_id,
    }
  }
}

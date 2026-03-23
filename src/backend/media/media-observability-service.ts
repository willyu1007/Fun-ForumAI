import { config } from '../lib/config.js'
import type { MediaObservabilityEventRepository } from '../repos/media-observability-event-repository.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type {
  CreateMediaObservabilityEventInput,
  MediaObservabilityEvent,
  MediaObservabilitySurface,
  MediaRolloutControllerOverride,
  VisualSourceKind,
} from '../repos/types.js'
import type { PublicDisclosureCapService } from '../services/public-disclosure-cap-service.js'

const DAY_MS = 24 * 60 * 60 * 1000
const EVENT_SCAN_PAGE_SIZE = 1_000

export interface MediaObservabilityGate {
  id: 'root_post_band' | 'attach_stability' | 'generation_health' | 'privacy_safety'
  status: 'pass' | 'warn' | 'block'
  value: number | null
  unit: 'ratio' | 'count'
  threshold: {
    pass: string
    warn?: string
    block: string
  }
}

export interface MediaObservabilitySnapshot {
  windows: {
    root_post_7d_start: string
    ops_24h_start: string
  }
  root_post: {
    attempted_7d: number
    display_linked_7d: number
    runtime_injected_7d: number
    text_only_7d: number
    runtime_only_7d: number
    attach_rate_7d: number | null
    runtime_injected_rate_7d: number | null
    source_mix_7d: Array<{
      source_kind: VisualSourceKind
      count: number
      share: number
    }>
    attach_success_24h: number
    attach_failed_24h: number
    attach_failure_rate_24h: number | null
    prompt_audit_blocked_24h: number
    prompt_audit_block_rate_24h: number | null
    critical_private_leaks_24h: number
  }
  generation_24h: {
    requested: number
    succeeded: number
    failed: number
    timed_out: number
    cancelled: number
    sync_degraded: number
    success_rate: number | null
    timeout_or_cancel_rate: number | null
    estimated_cost_cny: number | null
    cost_gate_active: boolean
  }
  governance_24h: {
    policy_candidate_blocked: number
    policy_revoked: number
    runtime_only_downgraded: number
  }
}

export interface MediaObservabilitySummary {
  metrics: MediaObservabilitySnapshot
  gates: MediaObservabilityGate[]
  recent_alerts: MediaObservabilityEvent[]
}

export function resolveMediaObservabilitySurface(input: {
  actor_surface?: string | null
  director_surface?: string | null
}): MediaObservabilitySurface {
  if (input.actor_surface === 'forum_post' && input.director_surface === 'scheduled_post') {
    return 'root_post'
  }
  if (input.actor_surface === 'forum_thread') return 'forum_thread'
  if (input.actor_surface === 'forum_turn') return 'forum_turn'
  if (input.actor_surface === 'chat_room_message') return 'chat_room_message'
  if (input.actor_surface === 'private_message') return 'private_message'
  return 'planner'
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return round2(numerator / denominator)
}

function formatBand(min: number, max: number): string {
  return `${Math.round(min * 100)}%-${Math.round(max * 100)}%`
}

function formatMaxRatio(value: number): string {
  return `<=${Math.round(value * 100)}%`
}

function formatMinRatio(value: number): string {
  return `>=${Math.round(value * 100)}%`
}

function pickSourceKind(
  event: MediaObservabilityEvent,
): VisualSourceKind | null {
  if (event.source_kind) return event.source_kind
  if (event.event_type.startsWith('source_selected:')) {
    return event.event_type.slice('source_selected:'.length) as VisualSourceKind
  }
  return null
}

export class MediaObservabilityService {
  constructor(private readonly deps: {
    mediaObservabilityEventRepo: MediaObservabilityEventRepository
    riskGovernanceRepo?: RiskGovernanceRepository | null
    publicDisclosureCapService?: PublicDisclosureCapService | null
  }) {}

  attachGovernanceDeps(input: {
    riskGovernanceRepo?: RiskGovernanceRepository | null
    publicDisclosureCapService?: PublicDisclosureCapService | null
  }): void {
    this.deps.riskGovernanceRepo = input.riskGovernanceRepo ?? this.deps.riskGovernanceRepo ?? null
    this.deps.publicDisclosureCapService =
      input.publicDisclosureCapService ?? this.deps.publicDisclosureCapService ?? null
  }

  async record(input: CreateMediaObservabilityEventInput): Promise<MediaObservabilityEvent> {
    if (!config.features.mediaObservabilityV1) {
      return {
        id: input.id ?? 'media_observability_disabled',
        event_type: input.event_type,
        surface: input.surface,
        severity: input.severity ?? 'info',
        agent_id: input.agent_id ?? null,
        community_id: input.community_id ?? null,
        image_plan_id: input.image_plan_id ?? null,
        generation_job_id: input.generation_job_id ?? null,
        asset_id: input.asset_id ?? null,
        source_kind: input.source_kind ?? null,
        metric_value: input.metric_value ?? null,
        payload_json: input.payload_json ?? null,
        created_at: input.created_at ?? new Date(),
      }
    }
    return this.deps.mediaObservabilityEventRepo.create(input)
  }

  async recordCriticalPrivateLeak(input: {
    surface: MediaObservabilitySurface
    agent_id: string
    community_id?: string | null
    image_plan_id?: string | null
    asset_id?: string | null
    source_kind?: VisualSourceKind | null
    blocked_fields: string[]
    reason: string
  }): Promise<MediaObservabilityEvent> {
    const event = await this.record({
      event_type: 'private_leak_blocked',
      surface: input.surface,
      severity: 'critical',
      agent_id: input.agent_id,
      community_id: input.community_id ?? null,
      image_plan_id: input.image_plan_id ?? null,
      asset_id: input.asset_id ?? null,
      source_kind: input.source_kind ?? null,
      payload_json: {
        blocked_fields: input.blocked_fields,
        reason: input.reason,
      },
    })

    if (this.deps.riskGovernanceRepo) {
      const riskEvent = await this.deps.riskGovernanceRepo.createRiskEvent({
        policy_snapshot_id: null,
        case_id: null,
        channel: input.surface,
        event_type: 'media_private_leak_blocked',
        action: 'block',
        risk_level: 'critical',
        risk_score: 1,
        risk_categories: ['owner_private_leak'],
        target_type: 'image_plan',
        target_id: input.image_plan_id ?? null,
        community_id: input.community_id ?? null,
        agent_id: input.agent_id,
        user_id: null,
        room_id: null,
        session_id: null,
        message_id: null,
        detail_text: input.reason,
        payload: {
          blocked_fields: input.blocked_fields,
          surface: input.surface,
          asset_id: input.asset_id ?? null,
          source_kind: input.source_kind ?? null,
        },
      })
      if (this.deps.publicDisclosureCapService) {
        await this.deps.publicDisclosureCapService.ensureAutomaticAgentOverride({
          agent_id: input.agent_id,
          cap_level: 0,
          source: 'owner_private_leak',
          reason: 'media_private_leak_blocked',
          linked_risk_event_id: riskEvent.id,
          created_by_user_id: 'system',
        })
      }
    }

    return event
  }

  getEstimatedGenerationCostCny(): number | null {
    const estimate = config.mediaController.estimatedGenerationCostCnyPerImage
    return estimate > 0 ? estimate : null
  }

  async getSnapshot(now = new Date()): Promise<MediaObservabilitySnapshot> {
    const since7d = new Date(now.getTime() - 7 * DAY_MS)
    const since24h = new Date(now.getTime() - DAY_MS)
    const events = await this.listEventsSince(since7d)
    const events24h = events.filter((item) => item.created_at.getTime() >= since24h.getTime())
    const rootPost7d = events.filter((item) => item.surface === 'root_post')
    const rootPost24h = events24h.filter((item) => item.surface === 'root_post')
    const generation24h = events24h.filter((item) =>
      item.surface === 'root_post' || item.surface === 'generation'
    )

    const attempted7d = rootPost7d.filter((item) => item.event_type === 'root_post_visual_attempted').length
    const displayLinked7d = rootPost7d.filter((item) => item.event_type === 'root_post_display_linked').length
    const runtimeInjected7d = rootPost7d.filter((item) => item.event_type === 'root_post_runtime_injected').length
    const textOnly7d = rootPost7d.filter((item) => item.event_type === 'root_post_text_only').length
    const runtimeOnly7d = rootPost7d.filter((item) => item.event_type === 'root_post_runtime_only').length
    const attachSuccess24h = rootPost24h.filter((item) => item.event_type === 'root_post_display_linked').length
    const attachFailed24h = rootPost24h.filter((item) => item.event_type === 'display_attach_failed').length
    const promptAuditBlocked24h = rootPost24h.filter((item) => item.event_type === 'public_prompt_audit_blocked').length
    const criticalPrivateLeaks24h = rootPost24h.filter((item) => item.event_type === 'private_leak_blocked').length

    const sourceCounts = new Map<VisualSourceKind, number>()
    for (const event of rootPost7d) {
      if (!event.event_type.startsWith('source_selected:')) continue
      const sourceKind = pickSourceKind(event)
      if (!sourceKind) continue
      sourceCounts.set(sourceKind, (sourceCounts.get(sourceKind) ?? 0) + 1)
    }
    const sourceMix7d = Array.from(sourceCounts.entries())
      .map(([source_kind, count]) => ({
        source_kind,
        count,
        share: attempted7d > 0 ? round2(count / attempted7d) : 0,
      }))
      .sort((left, right) => right.count - left.count)

    const generationRequested = generation24h.filter((item) => item.event_type === 'generation_requested')
    const generationSucceeded = generation24h.filter((item) => item.event_type === 'generation_succeeded').length
    const generationFailed = generation24h.filter((item) => item.event_type === 'generation_failed').length
    const generationTimedOut = generation24h.filter((item) => item.event_type === 'generation_timed_out').length
    const generationCancelled = generation24h.filter((item) => item.event_type === 'generation_cancelled').length
    const generationSyncDegraded = generation24h.filter((item) => item.event_type === 'generation_sync_degraded').length
    const estimatedCostCny = generationRequested.reduce((sum, item) => sum + (item.metric_value ?? 0), 0)
    const requestCount = generationRequested.length

    return {
      windows: {
        root_post_7d_start: since7d.toISOString(),
        ops_24h_start: since24h.toISOString(),
      },
      root_post: {
        attempted_7d: attempted7d,
        display_linked_7d: displayLinked7d,
        runtime_injected_7d: runtimeInjected7d,
        text_only_7d: textOnly7d,
        runtime_only_7d: runtimeOnly7d,
        attach_rate_7d: safeRate(displayLinked7d, attempted7d),
        runtime_injected_rate_7d: safeRate(runtimeInjected7d, attempted7d),
        source_mix_7d: sourceMix7d,
        attach_success_24h: attachSuccess24h,
        attach_failed_24h: attachFailed24h,
        attach_failure_rate_24h: safeRate(attachFailed24h, attachSuccess24h + attachFailed24h),
        prompt_audit_blocked_24h: promptAuditBlocked24h,
        prompt_audit_block_rate_24h: safeRate(promptAuditBlocked24h, Math.max(rootPost24h.filter((item) => item.event_type === 'root_post_visual_attempted').length, 1)),
        critical_private_leaks_24h: criticalPrivateLeaks24h,
      },
      generation_24h: {
        requested: requestCount,
        succeeded: generationSucceeded,
        failed: generationFailed,
        timed_out: generationTimedOut,
        cancelled: generationCancelled,
        sync_degraded: generationSyncDegraded,
        success_rate: safeRate(generationSucceeded, requestCount),
        timeout_or_cancel_rate: safeRate(generationTimedOut + generationCancelled, requestCount),
        estimated_cost_cny: estimatedCostCny > 0 ? round2(estimatedCostCny) : null,
        cost_gate_active: config.mediaController.estimatedGenerationDailyBudgetCny > 0,
      },
      governance_24h: {
        policy_candidate_blocked: events24h.filter((item) => item.event_type === 'policy_candidate_blocked').length,
        policy_revoked: events24h.filter((item) => item.event_type === 'policy_revoked').length,
        runtime_only_downgraded: events24h.filter((item) => item.event_type === 'runtime_only_downgraded').length,
      },
    }
  }

  buildGates(
    snapshot: MediaObservabilitySnapshot,
    input?: {
      target_min_rate?: number
      target_max_rate?: number
    },
  ): MediaObservabilityGate[] {
    const targetMinRate = input?.target_min_rate ?? config.mediaController.rootPostTargetMinRate
    const targetMaxRate = input?.target_max_rate ?? config.mediaController.rootPostTargetMaxRate
    const warnMinRate = Math.max(0, targetMinRate - 0.05)
    const warnMaxRate = targetMaxRate + 0.05
    const rootRate = snapshot.root_post.attach_rate_7d
    const attachFailureRate = snapshot.root_post.attach_failure_rate_24h
    const generationSuccessRate = snapshot.generation_24h.success_rate
    const generationTimeoutOrCancelRate = snapshot.generation_24h.timeout_or_cancel_rate

    const rootPostBand: MediaObservabilityGate = {
      id: 'root_post_band',
      status:
        rootRate === null
          ? 'warn'
          : rootRate < warnMinRate || rootRate > warnMaxRate
            ? 'block'
            : rootRate < targetMinRate || rootRate > targetMaxRate
              ? 'warn'
              : 'pass',
      value: rootRate,
      unit: 'ratio',
      threshold: {
        pass: formatBand(targetMinRate, targetMaxRate),
        warn: `${formatBand(warnMinRate, targetMinRate)} / ${formatBand(targetMaxRate, warnMaxRate)}`,
        block: `<${Math.round(warnMinRate * 100)}% or >${Math.round(warnMaxRate * 100)}%`,
      },
    }

    const attachStability: MediaObservabilityGate = {
      id: 'attach_stability',
      status:
        attachFailureRate === null
          ? 'pass'
          : attachFailureRate > 0.05
            ? 'block'
            : attachFailureRate > 0.02
              ? 'warn'
              : 'pass',
      value: attachFailureRate,
      unit: 'ratio',
      threshold: {
        pass: formatMaxRatio(0.02),
        warn: formatMaxRatio(0.05),
        block: '>5%',
      },
    }

    const generationHealth: MediaObservabilityGate = {
      id: 'generation_health',
      status:
        snapshot.generation_24h.requested === 0
          ? 'pass'
          : (generationSuccessRate ?? 0) >= 0.7 && (generationTimeoutOrCancelRate ?? 0) <= 0.2
            ? 'pass'
            : (generationSuccessRate ?? 0) >= 0.5
              ? 'warn'
              : 'block',
      value: generationSuccessRate,
      unit: 'ratio',
      threshold: {
        pass: `${formatMinRatio(0.7)} success and ${formatMaxRatio(0.2)} timeout/cancel`,
        warn: formatMinRatio(0.5),
        block: '<50% success',
      },
    }

    const privacySafety: MediaObservabilityGate = {
      id: 'privacy_safety',
      status: snapshot.root_post.critical_private_leaks_24h > 0 ? 'block' : 'pass',
      value: snapshot.root_post.critical_private_leaks_24h,
      unit: 'count',
      threshold: {
        pass: '0 critical leaks / 24h',
        block: '>=1 critical leaks / 24h',
      },
    }

    return [rootPostBand, attachStability, generationHealth, privacySafety]
  }

  async getAdminSummary(input?: {
    target_min_rate?: number
    target_max_rate?: number
  }): Promise<MediaObservabilitySummary> {
    const metrics = await this.getSnapshot()
    const recentAlerts = await this.deps.mediaObservabilityEventRepo.list({
      severity: 'warn',
      limit: 25,
    })
    const criticalAlerts = await this.deps.mediaObservabilityEventRepo.list({
      severity: 'critical',
      limit: 25,
    })
    const mergedAlerts = new Map<string, MediaObservabilityEvent>()
    for (const event of [...criticalAlerts, ...recentAlerts]) {
      mergedAlerts.set(event.id, event)
    }
    const alerts = Array.from(mergedAlerts.values())
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
      .slice(0, 25)

    return {
      metrics,
      gates: this.buildGates(metrics, input),
      recent_alerts: alerts,
    }
  }

  private async listEventsSince(since: Date): Promise<MediaObservabilityEvent[]> {
    const items: MediaObservabilityEvent[] = []
    let before: {
      created_at: Date
      id: string
    } | undefined

    while (true) {
      const page = await this.deps.mediaObservabilityEventRepo.list({
        since,
        limit: EVENT_SCAN_PAGE_SIZE,
        before,
      })
      if (page.length === 0) break
      items.push(...page)
      if (page.length < EVENT_SCAN_PAGE_SIZE) break
      const last = page[page.length - 1]
      before = {
        created_at: last.created_at,
        id: last.id,
      }
    }

    return items
  }
}

export function deriveTargetBandFromOverride(
  override: MediaRolloutControllerOverride | null,
): {
  target_min_rate: number
  target_max_rate: number
} {
  return {
    target_min_rate: override?.target_min_rate ?? config.mediaController.rootPostTargetMinRate,
    target_max_rate: override?.target_max_rate ?? config.mediaController.rootPostTargetMaxRate,
  }
}

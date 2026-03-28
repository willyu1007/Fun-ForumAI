import { createHash } from 'node:crypto'
import type { AgentBioRepository } from '../repos/agent-bio-repository.js'
import type {
  AgentBioProjection,
  AgentBioRefreshKind,
  AgentWorldviewState,
} from '../repos/types.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import {
  fingerprintBioLead,
  fingerprintBioText,
  fingerprintJson,
  type BioRhetoricFamily,
} from '../domain/agent-bio/index.js'
import type { AgentBioWorldviewService } from './agent-bio-worldview-service.js'
import type { AgentBioRenderService } from './agent-bio-render-service.js'

const MINOR_PRESENCE_COOLDOWN_MS = 6 * 3_600_000

function stableBucket(agentId: string): number {
  return createHash('sha1').update(agentId).digest()[0] ?? 0
}

export function resolveAgentBioMajorRefreshIntervalMs(agentId: string): number {
  const days = 10 + (stableBucket(agentId) % 6)
  return days * 24 * 3_600_000
}

function readRecentMajorFamilies(noteJson: Record<string, unknown> | null): BioRhetoricFamily[] {
  const families = (noteJson?.recent_major_families ?? noteJson?.selected_families) as unknown
  if (Array.isArray(families)) {
    return families
      .map((family) => (typeof family === 'string' ? family : null))
      .filter((family): family is BioRhetoricFamily => family !== null)
  }
  if (!families || typeof families !== 'object' || Array.isArray(families)) {
    return []
  }
  const publicFamily = (families as Record<string, unknown>).public
  return typeof publicFamily === 'string' ? [publicFamily as BioRhetoricFamily] : []
}

function extractSelectedBios(noteJson: Record<string, unknown> | null): string[] {
  const selected = noteJson?.selected_bios
  if (!selected || typeof selected !== 'object' || Array.isArray(selected)) {
    return []
  }
  return Object.values(selected)
    .map((value) => (typeof value === 'string' ? value : null))
    .filter((value): value is string => value !== null)
}

export interface AgentBioRefreshServiceDeps {
  repo: AgentBioRepository
  agentRepo: AgentRepository
  worldviewService: AgentBioWorldviewService
  renderService: AgentBioRenderService
}

export interface AgentBioRefreshResult {
  projection: AgentBioProjection
  worldview: AgentWorldviewState
  refresh_kind: AgentBioRefreshKind
  updated: boolean
  reason: string
}

export interface AgentBioRefreshObservabilitySnapshot {
  counts: {
    attempted: number
    committed: number
    deduped: number
    conflicts: number
    privacy_blocked: number
    errors: number
  }
  by_kind: Record<AgentBioRefreshKind, {
    attempted: number
    committed: number
    deduped: number
    conflicts: number
    privacy_blocked: number
  }>
  last_event_at: string | null
  last_refresh_kind: AgentBioRefreshKind | null
  last_reason: string | null
  last_error: string | null
}

function createKindCounters(): Record<AgentBioRefreshKind, {
  attempted: number
  committed: number
  deduped: number
  conflicts: number
  privacy_blocked: number
}> {
  return {
    bootstrap: {
      attempted: 0,
      committed: 0,
      deduped: 0,
      conflicts: 0,
      privacy_blocked: 0,
    },
    major: {
      attempted: 0,
      committed: 0,
      deduped: 0,
      conflicts: 0,
      privacy_blocked: 0,
    },
    minor_presence: {
      attempted: 0,
      committed: 0,
      deduped: 0,
      conflicts: 0,
      privacy_blocked: 0,
    },
  }
}

export class AgentBioRefreshService {
  private onUpdated:
    | ((input: {
        agent_id: string
        refresh_kind: AgentBioRefreshKind
        reason: string
      }) => Promise<void> | void)
    | null = null
  private readonly observability: AgentBioRefreshObservabilitySnapshot = {
    counts: {
      attempted: 0,
      committed: 0,
      deduped: 0,
      conflicts: 0,
      privacy_blocked: 0,
      errors: 0,
    },
    by_kind: createKindCounters(),
    last_event_at: null,
    last_refresh_kind: null,
    last_reason: null,
    last_error: null,
  }

  constructor(private readonly deps: AgentBioRefreshServiceDeps) {}

  setUpdatedHook(
    hook: (input: {
      agent_id: string
      refresh_kind: AgentBioRefreshKind
      reason: string
    }) => Promise<void> | void,
  ): void {
    this.onUpdated = hook
  }

  inspectObservability(): AgentBioRefreshObservabilitySnapshot {
    return {
      counts: { ...this.observability.counts },
      by_kind: {
        bootstrap: { ...this.observability.by_kind.bootstrap },
        major: { ...this.observability.by_kind.major },
        minor_presence: { ...this.observability.by_kind.minor_presence },
      },
      last_event_at: this.observability.last_event_at,
      last_refresh_kind: this.observability.last_refresh_kind,
      last_reason: this.observability.last_reason,
      last_error: this.observability.last_error,
    }
  }

  async getProjection(
    agentId: string,
    opts: {
      build_if_missing?: boolean
      allow_minor_refresh?: boolean
      now?: Date
    } = {},
  ): Promise<AgentBioProjection | null> {
    const now = opts.now ?? new Date()
    const [worldview, projection] = await Promise.all([
      this.deps.repo.getWorldview(agentId),
      this.deps.repo.getProjection(agentId),
    ])

    if (!projection || !worldview) {
      if (!opts.build_if_missing) return projection ?? null
      const created = await this.refresh(agentId, {
        refresh_kind: 'bootstrap',
        reason: 'bootstrap',
        now,
      })
      return created?.projection ?? null
    }

    if (opts.allow_minor_refresh && await this.shouldMinorRefresh(agentId, worldview, now)) {
      const refreshed = await this.refresh(agentId, {
        refresh_kind: 'minor_presence',
        reason: 'display_presence_refresh',
        now,
      })
      return refreshed?.projection ?? projection
    }

    return projection
  }

  async refresh(agentId: string, input: {
    refresh_kind?: AgentBioRefreshKind
    reason: string
    now?: Date
  }): Promise<AgentBioRefreshResult | null> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) return null

    const now = input.now ?? new Date()
    const existingWorldview = await this.deps.repo.getWorldview(agentId)
    const existingProjection = await this.deps.repo.getProjection(agentId)
    const recentLogs = await this.deps.repo.listRenderLogs(agentId, { limit: 4 })
    const compiled = await this.deps.worldviewService.compile(agentId, now)
    if (!compiled) return null

    const nextVersions = this.resolveNextVersions(existingWorldview, compiled.source_fingerprint, compiled.worldview.presence.bucket)
    const recentFingerprints = new Set<string>([
      existingProjection?.public_bio ? fingerprintBioText(existingProjection.public_bio) : '',
      existingProjection?.owner_bio ? fingerprintBioText(existingProjection.owner_bio) : '',
      existingProjection?.private_header_bio ? fingerprintBioText(existingProjection.private_header_bio) : '',
    ].filter(Boolean))
    const recentOpeningFingerprints = new Set<string>([
      existingProjection?.public_bio ? fingerprintBioLead(existingProjection.public_bio) : '',
      existingProjection?.owner_bio ? fingerprintBioLead(existingProjection.owner_bio) : '',
      existingProjection?.private_header_bio ? fingerprintBioLead(existingProjection.private_header_bio) : '',
      ...recentLogs.flatMap((log) => extractSelectedBios(log.note_json).map((text) => fingerprintBioLead(text))),
    ].filter(Boolean))
    const recentMajorFamilies = recentLogs
      .filter((log) => log.refresh_kind !== 'minor_presence')
      .flatMap((log) => readRecentMajorFamilies(log.note_json))
      .slice(0, 4)

    const refreshKind = input.refresh_kind ?? (existingWorldview ? 'major' : 'bootstrap')
    this.recordAttempt(refreshKind, input.reason, now)

    try {
      const render = refreshKind === 'minor_presence' && existingProjection
        ? this.buildMinorPresenceRender({
            existingProjection,
            presenceBucket: compiled.worldview.presence.bucket,
            presenceNote: compiled.worldview.presence.note_seed,
            recentMajorFamilies,
          })
        : await this.deps.renderService.render({
            agentId,
            refreshKind: refreshKind === 'minor_presence' ? 'major' : refreshKind,
            worldview: compiled.worldview,
            recentFingerprints,
            recentMajorFamilies,
            recentOpeningFingerprints,
          })
      const dedupKey = fingerprintJson({
        refresh_kind: refreshKind,
        source_fingerprint: compiled.source_fingerprint,
        presence_bucket: compiled.worldview.presence.bucket,
        render_fingerprint: render.render_fingerprint,
      })

      const result = await this.deps.repo.commitRefresh({
        worldview: {
          agent_id: agentId,
          worldview_version: nextVersions.worldview_version,
          phase_revision: nextVersions.phase_revision,
          source_fingerprint: compiled.source_fingerprint,
          refresh_reason: input.reason,
          presence_bucket: compiled.worldview.presence.bucket,
          worldview_json: compiled.worldview as unknown as Record<string, unknown>,
          last_major_refreshed_at:
            refreshKind === 'major' || refreshKind === 'bootstrap'
              ? now
              : existingWorldview?.last_major_refreshed_at ?? null,
          last_minor_refreshed_at:
            refreshKind === 'minor_presence'
              ? now
              : existingWorldview?.last_minor_refreshed_at ?? null,
          last_compiled_at: now,
          expected_worldview_version: existingWorldview?.worldview_version,
          expected_phase_revision: existingWorldview?.phase_revision,
        },
        projection: {
          agent_id: agentId,
          worldview_version: nextVersions.worldview_version,
          phase_revision: nextVersions.phase_revision,
          public_bio: render.public_bio,
          owner_bio: render.owner_bio,
          private_header_bio: render.private_header_bio,
          presence_note: render.presence_note,
          render_fingerprint: render.render_fingerprint,
          render_policy_json: render.render_policy_json,
          refreshed_at: now,
        },
        render_log: {
          agent_id: agentId,
          refresh_kind: refreshKind,
          refresh_reason: input.reason,
          dedup_key: dedupKey,
          worldview_version: nextVersions.worldview_version,
          phase_revision: nextVersions.phase_revision,
          source_fingerprint: compiled.source_fingerprint,
          render_fingerprint: render.render_fingerprint,
          status: render.privacy_blocked ? 'privacy_blocked' : 'rendered',
          public_persisted: Boolean(render.public_bio),
          note_json: {
            ...render.diagnostics,
            selected_bios: {
              public: render.public_bio,
              owner: render.owner_bio,
              private_header: render.private_header_bio,
            },
            selected_opening_fingerprints: {
              public: render.public_bio ? fingerprintBioLead(render.public_bio) : null,
              owner: render.owner_bio ? fingerprintBioLead(render.owner_bio) : null,
              private_header: render.private_header_bio ? fingerprintBioLead(render.private_header_bio) : null,
            },
            presence_bucket: compiled.worldview.presence.bucket,
            privacy_blocked: render.privacy_blocked,
          },
        },
      })

      this.recordResult(refreshKind, result.kind, {
        privacyBlocked: result.kind === 'committed' && render.privacy_blocked,
      })

      if (result.kind === 'conflict') {
        return null
      }

      const worldview = result.worldview
      const projection = result.projection
      if (!worldview || !projection) {
        return null
      }

      if (result.kind === 'committed') {
        this.onUpdated?.({
          agent_id: agentId,
          refresh_kind: refreshKind,
          reason: input.reason,
        })
      }

      return {
        projection,
        worldview,
        refresh_kind: refreshKind,
        updated: result.kind === 'committed',
        reason: input.reason,
      }
    } catch (error) {
      this.observability.counts.errors += 1
      this.observability.last_event_at = now.toISOString()
      this.observability.last_refresh_kind = refreshKind
      this.observability.last_reason = input.reason
      this.observability.last_error = error instanceof Error ? error.message : 'agent_bio_refresh_failed'
      throw error
    }
  }

  async processMajorRefreshSweep(input: {
    now?: Date
    limit?: number
    page_size?: number
    force?: boolean
  } = {}): Promise<{
    scanned: number
    refreshed: number
    skipped: number
  }> {
    const now = input.now ?? new Date()
    const limit = input.limit ?? 50
    const pageSize = input.page_size ?? 200
    const force = input.force === true
    let cursor: string | undefined
    let scanned = 0
    let refreshed = 0
    let skipped = 0

    while (refreshed < limit) {
      const page = this.deps.agentRepo.findActive({ cursor, limit: pageSize })
      if (page.items.length === 0) break

      for (const agent of page.items) {
        scanned += 1
        const worldview = await this.deps.repo.getWorldview(agent.id)
        const due = force
          || !worldview
          || !worldview.last_major_refreshed_at
          || now.getTime() - worldview.last_major_refreshed_at.getTime()
            >= resolveAgentBioMajorRefreshIntervalMs(agent.id)
        if (!due) {
          skipped += 1
          continue
        }

        const result = await this.refresh(agent.id, {
          refresh_kind: worldview ? 'major' : 'bootstrap',
          reason: worldview ? 'daily_major_refresh' : 'backfill_bootstrap',
          now,
        })
        if (result?.updated) {
          refreshed += 1
        } else {
          skipped += 1
        }
        if (refreshed >= limit) break
      }

      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return { scanned, refreshed, skipped }
  }

  private resolveNextVersions(
    existing: AgentWorldviewState | null,
    sourceFingerprint: string,
    presenceBucket: AgentWorldviewState['presence_bucket'],
  ): { worldview_version: number; phase_revision: number } {
    if (!existing) {
      return {
        worldview_version: 1,
        phase_revision: 1,
      }
    }

    if (existing.source_fingerprint !== sourceFingerprint) {
      return {
        worldview_version: existing.worldview_version + 1,
        phase_revision: existing.phase_revision + 1,
      }
    }

    if (existing.presence_bucket !== presenceBucket) {
      return {
        worldview_version: existing.worldview_version,
        phase_revision: existing.phase_revision + 1,
      }
    }

    return {
      worldview_version: existing.worldview_version,
      phase_revision: existing.phase_revision,
    }
  }

  private buildMinorPresenceRender(input: {
    existingProjection: AgentBioProjection
    presenceBucket: AgentWorldviewState['presence_bucket']
    presenceNote: string | null
    recentMajorFamilies: BioRhetoricFamily[]
  }) {
    const presenceNote = input.presenceNote?.trim() ?? null
    const diagnostics = {
      mode: 'carry_forward_minor',
      prompt_ref: null,
      llm_provider_id: null,
      llm_model_id: null,
      parse_success: null,
      error: null,
      recent_major_families: [...input.recentMajorFamilies],
      selected_families: (
        input.existingProjection.render_policy_json.selected_families
        && typeof input.existingProjection.render_policy_json.selected_families === 'object'
        && !Array.isArray(input.existingProjection.render_policy_json.selected_families)
      )
        ? input.existingProjection.render_policy_json.selected_families as Record<string, unknown>
        : {},
      candidate_rejections: [],
      privacy_violations: [],
    }

    return {
      public_bio: input.existingProjection.public_bio,
      owner_bio: input.existingProjection.owner_bio,
      private_header_bio: input.existingProjection.private_header_bio,
      presence_note: presenceNote,
      render_policy_json: {
        ...input.existingProjection.render_policy_json,
        presence_bucket: input.presenceBucket,
        render_mode: 'carry_forward_minor',
        recent_major_families: input.recentMajorFamilies,
      },
      render_fingerprint: fingerprintJson({
        public_bio: input.existingProjection.public_bio,
        owner_bio: input.existingProjection.owner_bio,
        private_header_bio: input.existingProjection.private_header_bio,
        presence_note: presenceNote,
      }),
      privacy_blocked: false,
      diagnostics,
    }
  }

  private async shouldMinorRefresh(
    agentId: string,
    worldview: AgentWorldviewState,
    now: Date,
  ): Promise<boolean> {
    if (
      worldview.last_minor_refreshed_at
      && now.getTime() - worldview.last_minor_refreshed_at.getTime() < MINOR_PRESENCE_COOLDOWN_MS
    ) {
      return false
    }
    const compiled = await this.deps.worldviewService.compile(agentId, now)
    if (!compiled) return false
    return compiled.worldview.presence.bucket !== worldview.presence_bucket
  }

  private recordAttempt(
    refreshKind: AgentBioRefreshKind,
    reason: string,
    now: Date,
  ): void {
    this.observability.counts.attempted += 1
    this.observability.by_kind[refreshKind].attempted += 1
    this.observability.last_event_at = now.toISOString()
    this.observability.last_refresh_kind = refreshKind
    this.observability.last_reason = reason
    this.observability.last_error = null
  }

  private recordResult(
    refreshKind: AgentBioRefreshKind,
    resultKind: 'committed' | 'deduped' | 'conflict',
    options: { privacyBlocked: boolean },
  ): void {
    if (resultKind === 'committed') {
      this.observability.counts.committed += 1
      this.observability.by_kind[refreshKind].committed += 1
      if (options.privacyBlocked) {
        this.observability.counts.privacy_blocked += 1
        this.observability.by_kind[refreshKind].privacy_blocked += 1
      }
      return
    }

    if (resultKind === 'deduped') {
      this.observability.counts.deduped += 1
      this.observability.by_kind[refreshKind].deduped += 1
      return
    }

    this.observability.counts.conflicts += 1
    this.observability.by_kind[refreshKind].conflicts += 1
  }
}

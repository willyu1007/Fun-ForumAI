import type {
  AgentBioProjection,
  AgentBioRenderLog,
  AgentWorldviewState,
  CommitAgentBioRefreshInput,
} from './types.js'

export type CommitAgentBioRefreshResult =
  | {
      kind: 'committed'
      worldview: AgentWorldviewState
      projection: AgentBioProjection
      render_log: AgentBioRenderLog
    }
  | {
      kind: 'deduped'
      worldview: AgentWorldviewState | null
      projection: AgentBioProjection | null
      render_log: AgentBioRenderLog
    }
  | {
      kind: 'conflict'
      worldview: AgentWorldviewState | null
      projection: AgentBioProjection | null
      render_log: AgentBioRenderLog | null
    }

export interface RecentPublicBioSnapshot {
  text: string
  refreshed_at: Date
}

export interface AgentBioRepository {
  hydrate?(): Promise<void>
  getWorldview(agentId: string): Promise<AgentWorldviewState | null>
  getProjection(agentId: string): Promise<AgentBioProjection | null>
  listRenderLogs(
    agentId: string,
    opts: { limit: number },
  ): Promise<AgentBioRenderLog[]>
  findRenderLogByDedupKey(agentId: string, dedupKey: string): Promise<AgentBioRenderLog | null>
  listRecentPublicBioSnapshots(
    agentId: string,
    opts: { limit: number },
  ): Promise<RecentPublicBioSnapshot[]>
  commitRefresh(input: CommitAgentBioRefreshInput): Promise<CommitAgentBioRefreshResult>
}

let counter = 0

function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryAgentBioRepository implements AgentBioRepository {
  private readonly worldviewStore = new Map<string, AgentWorldviewState>()
  private readonly projectionStore = new Map<string, AgentBioProjection>()
  private readonly renderLogStore = new Map<string, AgentBioRenderLog>()
  private readonly dedupIndex = new Map<string, string>()

  async getWorldview(agentId: string): Promise<AgentWorldviewState | null> {
    return this.worldviewStore.get(agentId) ?? null
  }

  async getProjection(agentId: string): Promise<AgentBioProjection | null> {
    return this.projectionStore.get(agentId) ?? null
  }

  async listRenderLogs(agentId: string, opts: { limit: number }): Promise<AgentBioRenderLog[]> {
    return Array.from(this.renderLogStore.values())
      .filter((row) => row.agent_id === agentId)
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
      .slice(0, opts.limit)
  }

  async findRenderLogByDedupKey(agentId: string, dedupKey: string): Promise<AgentBioRenderLog | null> {
    const existingId = this.dedupIndex.get(`${agentId}:${dedupKey}`)
    if (!existingId) return null
    return this.renderLogStore.get(existingId) ?? null
  }

  async listRecentPublicBioSnapshots(
    agentId: string,
    opts: { limit: number },
  ): Promise<RecentPublicBioSnapshot[]> {
    const limit = Math.max(0, Math.floor(opts.limit))
    if (limit === 0) return []
    const seenFingerprints = new Set<string>()
    const results: RecentPublicBioSnapshot[] = []
    const rows = Array.from(this.renderLogStore.values())
      .filter((row) =>
        row.agent_id === agentId
        && row.status === 'rendered'
        && row.public_persisted
        && typeof row.public_bio_snapshot === 'string'
        && row.public_bio_snapshot.length > 0,
      )
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
    for (const row of rows) {
      if (seenFingerprints.has(row.render_fingerprint)) continue
      seenFingerprints.add(row.render_fingerprint)
      results.push({
        text: row.public_bio_snapshot as string,
        refreshed_at: row.created_at,
      })
      if (results.length >= limit) break
    }
    return results
  }

  async commitRefresh(input: CommitAgentBioRefreshInput): Promise<CommitAgentBioRefreshResult> {
    const dedupKey = `${input.render_log.agent_id}:${input.render_log.dedup_key}`
    const existingLogId = this.dedupIndex.get(dedupKey)
    if (existingLogId) {
      return {
        kind: 'deduped',
        worldview: this.worldviewStore.get(input.worldview.agent_id) ?? null,
        projection: this.projectionStore.get(input.projection.agent_id) ?? null,
        render_log: this.renderLogStore.get(existingLogId)!,
      }
    }

    const existingWorldview = this.worldviewStore.get(input.worldview.agent_id) ?? null
    if (
      existingWorldview
      && input.worldview.expected_worldview_version !== undefined
      && input.worldview.expected_phase_revision !== undefined
      && (
        existingWorldview.worldview_version !== input.worldview.expected_worldview_version
        || existingWorldview.phase_revision !== input.worldview.expected_phase_revision
      )
    ) {
      return {
        kind: 'conflict',
        worldview: existingWorldview,
        projection: this.projectionStore.get(input.projection.agent_id) ?? null,
        render_log: null,
      }
    }

    const now = input.projection.refreshed_at
    const worldview: AgentWorldviewState = {
      agent_id: input.worldview.agent_id,
      worldview_version: input.worldview.worldview_version,
      phase_revision: input.worldview.phase_revision,
      source_fingerprint: input.worldview.source_fingerprint,
      refresh_reason: input.worldview.refresh_reason,
      presence_bucket: input.worldview.presence_bucket,
      worldview_json: input.worldview.worldview_json,
      last_major_refreshed_at:
        input.worldview.last_major_refreshed_at
        ?? existingWorldview?.last_major_refreshed_at
        ?? null,
      last_minor_refreshed_at:
        input.worldview.last_minor_refreshed_at
        ?? existingWorldview?.last_minor_refreshed_at
        ?? null,
      last_compiled_at: input.worldview.last_compiled_at,
      created_at: existingWorldview?.created_at ?? now,
      updated_at: now,
    }

    const existingProjection = this.projectionStore.get(input.projection.agent_id) ?? null
    const projection: AgentBioProjection = {
      agent_id: input.projection.agent_id,
      worldview_version: input.projection.worldview_version,
      phase_revision: input.projection.phase_revision,
      public_bio: input.projection.public_bio ?? null,
      owner_bio: input.projection.owner_bio ?? null,
      private_header_bio: input.projection.private_header_bio ?? null,
      presence_note: input.projection.presence_note ?? null,
      render_fingerprint: input.projection.render_fingerprint,
      render_policy_json: input.projection.render_policy_json,
      refreshed_at: input.projection.refreshed_at,
      created_at: existingProjection?.created_at ?? now,
      updated_at: now,
    }

    const renderLog: AgentBioRenderLog = {
      id: cuid('agent_bio_log'),
      agent_id: input.render_log.agent_id,
      refresh_kind: input.render_log.refresh_kind,
      refresh_reason: input.render_log.refresh_reason,
      dedup_key: input.render_log.dedup_key,
      worldview_version: input.render_log.worldview_version,
      phase_revision: input.render_log.phase_revision,
      source_fingerprint: input.render_log.source_fingerprint,
      render_fingerprint: input.render_log.render_fingerprint,
      status: input.render_log.status,
      public_persisted: input.render_log.public_persisted,
      public_bio_snapshot: input.render_log.public_bio_snapshot ?? null,
      note_json: input.render_log.note_json ?? null,
      created_at: now,
    }

    this.worldviewStore.set(worldview.agent_id, worldview)
    this.projectionStore.set(projection.agent_id, projection)
    this.renderLogStore.set(renderLog.id, renderLog)
    this.dedupIndex.set(dedupKey, renderLog.id)

    return {
      kind: 'committed',
      worldview,
      projection,
      render_log: renderLog,
    }
  }
}

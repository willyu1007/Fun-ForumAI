import { Prisma, type PrismaClient } from '@prisma/client'
import type { AgentBioProjection, AgentBioRenderLog, AgentWorldviewState } from '../types.js'
import type {
  AgentBioRepository,
  CommitAgentBioRefreshResult,
} from '../agent-bio-repository.js'
import type { CommitAgentBioRefreshInput } from '../types.js'

function toUnknownRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export class PgAgentBioRepository implements AgentBioRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async getWorldview(agentId: string): Promise<AgentWorldviewState | null> {
    const row = await this.prisma.agentWorldviewState.findUnique({
      where: { agentId },
    })
    return row ? this.toWorldview(row) : null
  }

  async getProjection(agentId: string): Promise<AgentBioProjection | null> {
    const row = await this.prisma.agentBioProjection.findUnique({
      where: { agentId },
    })
    return row ? this.toProjection(row) : null
  }

  async listRenderLogs(agentId: string, opts: { limit: number }): Promise<AgentBioRenderLog[]> {
    const rows = await this.prisma.agentBioRenderLog.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
    })
    return rows.map((row) => this.toRenderLog(row))
  }

  async findRenderLogByDedupKey(agentId: string, dedupKey: string): Promise<AgentBioRenderLog | null> {
    const row = await this.prisma.agentBioRenderLog.findUnique({
      where: {
        agentId_dedupKey: {
          agentId,
          dedupKey,
        },
      },
    })
    return row ? this.toRenderLog(row) : null
  }

  async commitRefresh(input: CommitAgentBioRefreshInput): Promise<CommitAgentBioRefreshResult> {
    const existingLog = await this.findRenderLogByDedupKey(
      input.render_log.agent_id,
      input.render_log.dedup_key,
    )
    if (existingLog) {
      const [worldview, projection] = await Promise.all([
        this.getWorldview(input.worldview.agent_id),
        this.getProjection(input.projection.agent_id),
      ])
      return {
        kind: 'deduped',
        worldview,
        projection,
        render_log: existingLog,
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingWorldview = await tx.agentWorldviewState.findUnique({
          where: { agentId: input.worldview.agent_id },
        })
        if (
          existingWorldview
          && input.worldview.expected_worldview_version !== undefined
          && input.worldview.expected_phase_revision !== undefined
          && (
            existingWorldview.worldviewVersion !== input.worldview.expected_worldview_version
            || existingWorldview.phaseRevision !== input.worldview.expected_phase_revision
          )
        ) {
          const [projectionRow, renderLogRow] = await Promise.all([
            tx.agentBioProjection.findUnique({ where: { agentId: input.projection.agent_id } }),
            tx.agentBioRenderLog.findUnique({
              where: {
                agentId_dedupKey: {
                  agentId: input.render_log.agent_id,
                  dedupKey: input.render_log.dedup_key,
                },
              },
            }),
          ])
          return {
            kind: 'conflict',
            worldview: this.toWorldview(existingWorldview),
            projection: projectionRow ? this.toProjection(projectionRow) : null,
            render_log: renderLogRow ? this.toRenderLog(renderLogRow) : null,
          } satisfies CommitAgentBioRefreshResult
        }

        const worldviewRow = await tx.agentWorldviewState.upsert({
          where: { agentId: input.worldview.agent_id },
          create: {
            agentId: input.worldview.agent_id,
            worldviewVersion: input.worldview.worldview_version,
            phaseRevision: input.worldview.phase_revision,
            sourceFingerprint: input.worldview.source_fingerprint,
            refreshReason: input.worldview.refresh_reason,
            presenceBucket: input.worldview.presence_bucket,
            worldviewJson: toInputJson(input.worldview.worldview_json),
            lastMajorRefreshedAt: input.worldview.last_major_refreshed_at ?? null,
            lastMinorRefreshedAt: input.worldview.last_minor_refreshed_at ?? null,
            lastCompiledAt: input.worldview.last_compiled_at,
          },
          update: {
            worldviewVersion: input.worldview.worldview_version,
            phaseRevision: input.worldview.phase_revision,
            sourceFingerprint: input.worldview.source_fingerprint,
            refreshReason: input.worldview.refresh_reason,
            presenceBucket: input.worldview.presence_bucket,
            worldviewJson: toInputJson(input.worldview.worldview_json),
            lastMajorRefreshedAt: input.worldview.last_major_refreshed_at ?? null,
            lastMinorRefreshedAt: input.worldview.last_minor_refreshed_at ?? null,
            lastCompiledAt: input.worldview.last_compiled_at,
          },
        })

        const projectionRow = await tx.agentBioProjection.upsert({
          where: { agentId: input.projection.agent_id },
          create: {
            agentId: input.projection.agent_id,
            worldviewVersion: input.projection.worldview_version,
            phaseRevision: input.projection.phase_revision,
            publicBio: input.projection.public_bio ?? null,
            ownerBio: input.projection.owner_bio ?? null,
            privateHeaderBio: input.projection.private_header_bio ?? null,
            presenceNote: input.projection.presence_note ?? null,
            renderFingerprint: input.projection.render_fingerprint,
            renderPolicyJson: toInputJson(input.projection.render_policy_json),
            refreshedAt: input.projection.refreshed_at,
          },
          update: {
            worldviewVersion: input.projection.worldview_version,
            phaseRevision: input.projection.phase_revision,
            publicBio: input.projection.public_bio ?? null,
            ownerBio: input.projection.owner_bio ?? null,
            privateHeaderBio: input.projection.private_header_bio ?? null,
            presenceNote: input.projection.presence_note ?? null,
            renderFingerprint: input.projection.render_fingerprint,
            renderPolicyJson: toInputJson(input.projection.render_policy_json),
            refreshedAt: input.projection.refreshed_at,
          },
        })

        const renderInsert = await tx.agentBioRenderLog.createMany({
          data: [{
            agentId: input.render_log.agent_id,
            refreshKind: input.render_log.refresh_kind,
            refreshReason: input.render_log.refresh_reason,
            dedupKey: input.render_log.dedup_key,
            worldviewVersion: input.render_log.worldview_version,
            phaseRevision: input.render_log.phase_revision,
            sourceFingerprint: input.render_log.source_fingerprint,
            renderFingerprint: input.render_log.render_fingerprint,
            status: input.render_log.status,
            publicPersisted: input.render_log.public_persisted,
            noteJson: input.render_log.note_json ? toInputJson(input.render_log.note_json) : Prisma.JsonNull,
          }],
          skipDuplicates: true,
        })
        const renderLogRow = await tx.agentBioRenderLog.findUnique({
          where: {
            agentId_dedupKey: {
              agentId: input.render_log.agent_id,
              dedupKey: input.render_log.dedup_key,
            },
          },
        })
        if (!renderLogRow) {
          throw new Error('Agent bio render log missing after commitRefresh')
        }

        return {
          kind: renderInsert.count > 0 ? 'committed' : 'deduped',
          worldview: this.toWorldview(worldviewRow),
          projection: this.toProjection(projectionRow),
          render_log: this.toRenderLog(renderLogRow),
        } satisfies CommitAgentBioRefreshResult
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        const log = await this.findRenderLogByDedupKey(
          input.render_log.agent_id,
          input.render_log.dedup_key,
        )
        const [worldview, projection] = await Promise.all([
          this.getWorldview(input.worldview.agent_id),
          this.getProjection(input.projection.agent_id),
        ])
        if (log) {
          return {
            kind: 'deduped',
            worldview,
            projection,
            render_log: log,
          }
        }
      }
      throw error
    }
  }

  private toWorldview(row: {
    agentId: string
    worldviewVersion: number
    phaseRevision: number
    sourceFingerprint: string
    refreshReason: string
    presenceBucket: string
    worldviewJson: unknown
    lastMajorRefreshedAt: Date | null
    lastMinorRefreshedAt: Date | null
    lastCompiledAt: Date
    createdAt: Date
    updatedAt: Date
  }): AgentWorldviewState {
    return {
      agent_id: row.agentId,
      worldview_version: row.worldviewVersion,
      phase_revision: row.phaseRevision,
      source_fingerprint: row.sourceFingerprint,
      refresh_reason: row.refreshReason,
      presence_bucket: row.presenceBucket as AgentWorldviewState['presence_bucket'],
      worldview_json: toUnknownRecord(row.worldviewJson),
      last_major_refreshed_at: row.lastMajorRefreshedAt,
      last_minor_refreshed_at: row.lastMinorRefreshedAt,
      last_compiled_at: row.lastCompiledAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toProjection(row: {
    agentId: string
    worldviewVersion: number
    phaseRevision: number
    publicBio: string | null
    ownerBio: string | null
    privateHeaderBio: string | null
    presenceNote: string | null
    renderFingerprint: string
    renderPolicyJson: unknown
    refreshedAt: Date
    createdAt: Date
    updatedAt: Date
  }): AgentBioProjection {
    return {
      agent_id: row.agentId,
      worldview_version: row.worldviewVersion,
      phase_revision: row.phaseRevision,
      public_bio: row.publicBio,
      owner_bio: row.ownerBio,
      private_header_bio: row.privateHeaderBio,
      presence_note: row.presenceNote,
      render_fingerprint: row.renderFingerprint,
      render_policy_json: toUnknownRecord(row.renderPolicyJson),
      refreshed_at: row.refreshedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toRenderLog(row: {
    id: string
    agentId: string
    refreshKind: string
    refreshReason: string
    dedupKey: string
    worldviewVersion: number
    phaseRevision: number
    sourceFingerprint: string
    renderFingerprint: string
    status: string
    publicPersisted: boolean
    noteJson: unknown
    createdAt: Date
  }): AgentBioRenderLog {
    return {
      id: row.id,
      agent_id: row.agentId,
      refresh_kind: row.refreshKind as AgentBioRenderLog['refresh_kind'],
      refresh_reason: row.refreshReason,
      dedup_key: row.dedupKey,
      worldview_version: row.worldviewVersion,
      phase_revision: row.phaseRevision,
      source_fingerprint: row.sourceFingerprint,
      render_fingerprint: row.renderFingerprint,
      status: row.status as AgentBioRenderLog['status'],
      public_persisted: row.publicPersisted,
      note_json: row.noteJson === null ? null : toUnknownRecord(row.noteJson),
      created_at: row.createdAt,
    }
  }
}

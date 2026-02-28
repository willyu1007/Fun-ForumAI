import { randomUUID } from 'node:crypto'
import { Prisma, type AgentInclinationAsset as PrismaInclinationAsset, type PrismaClient } from '@prisma/client'
import type {
  AgentInclinationAsset,
  CreateAgentInclinationAssetInput,
} from '../types.js'
import type {
  InclinationAssetRepository,
  UpdateInclinationAssetPatch,
} from '../inclination-asset-repository.js'

export class PgInclinationAssetRepository implements InclinationAssetRepository {
  private cache = new Map<string, AgentInclinationAsset>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agentInclinationAsset.findMany()
    for (const row of rows) {
      const asset = this.toDomain(row)
      this.cache.set(asset.id, asset)
    }
  }

  create(input: CreateAgentInclinationAssetInput): AgentInclinationAsset {
    const now = new Date()
    const id = input.id ?? randomUUID()
    const asset: AgentInclinationAsset = {
      id,
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      source_type: input.source_type,
      origin_url: input.origin_url ?? null,
      storage_key: input.storage_key ?? null,
      media_url: input.media_url,
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      owner_note: input.owner_note ?? null,
      vision_summary: input.vision_summary,
      status: input.status ?? 'PENDING',
      consumed_post_id: null,
      consumed_at: null,
      created_at: now,
    }

    this.cache.set(id, asset)

    this.prisma.agentInclinationAsset.create({
      data: {
        id,
        agentId: asset.agent_id,
        ownerUserId: asset.owner_user_id,
        sourceType: asset.source_type,
        originUrl: asset.origin_url,
        storageKey: asset.storage_key,
        mediaUrl: asset.media_url,
        mimeType: asset.mime_type,
        fileSizeBytes: asset.file_size_bytes,
        ownerNote: asset.owner_note,
        visionSummaryJson: asset.vision_summary as unknown as Prisma.InputJsonValue,
        status: asset.status,
        consumedPostId: null,
        consumedAt: null,
        createdAt: now,
      },
    }).catch((err: unknown) => console.error('[PgInclinationAssetRepo] create error:', err))

    return asset
  }

  findById(id: string): AgentInclinationAsset | null {
    return this.cache.get(id) ?? null
  }

  findPendingByAgent(agentId: string): AgentInclinationAsset | null {
    const pending = Array.from(this.cache.values())
      .filter((item) => item.agent_id === agentId && item.status === 'PENDING')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return pending[0] ?? null
  }

  findLastConsumedByAgent(agentId: string): AgentInclinationAsset | null {
    const consumed = Array.from(this.cache.values())
      .filter((item) => item.agent_id === agentId && item.status === 'CONSUMED')
      .sort((a, b) => {
        const aTs = (a.consumed_at ?? a.created_at).getTime()
        const bTs = (b.consumed_at ?? b.created_at).getTime()
        return bTs - aTs
      })
    return consumed[0] ?? null
  }

  listPendingAgentIds(limit = 100): string[] {
    const unique: string[] = []
    const seen = new Set<string>()
    const pending = Array.from(this.cache.values())
      .filter((item) => item.status === 'PENDING')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

    for (const item of pending) {
      if (seen.has(item.agent_id)) continue
      seen.add(item.agent_id)
      unique.push(item.agent_id)
      if (unique.length >= limit) break
    }
    return unique
  }

  update(id: string, patch: UpdateInclinationAssetPatch): AgentInclinationAsset | null {
    const current = this.cache.get(id)
    if (!current) return null

    if (patch.status !== undefined) current.status = patch.status
    if (patch.consumed_post_id !== undefined) current.consumed_post_id = patch.consumed_post_id
    if (patch.consumed_at !== undefined) current.consumed_at = patch.consumed_at
    if (patch.media_url !== undefined) current.media_url = patch.media_url
    if (patch.storage_key !== undefined) current.storage_key = patch.storage_key

    this.prisma.agentInclinationAsset.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.consumed_post_id !== undefined ? { consumedPostId: patch.consumed_post_id } : {}),
        ...(patch.consumed_at !== undefined ? { consumedAt: patch.consumed_at } : {}),
        ...(patch.media_url !== undefined ? { mediaUrl: patch.media_url } : {}),
        ...(patch.storage_key !== undefined ? { storageKey: patch.storage_key } : {}),
      },
    }).catch((err: unknown) => console.error('[PgInclinationAssetRepo] update error:', err))

    return current
  }

  replacePending(agentId: string, replacedById?: string): number {
    const pending = Array.from(this.cache.values())
      .filter((item) => item.agent_id === agentId && item.status === 'PENDING')
      .filter((item) => !replacedById || item.id !== replacedById)

    if (pending.length === 0) return 0

    for (const item of pending) {
      item.status = 'REPLACED'
    }

    const ids = pending.map((item) => item.id)
    this.prisma.agentInclinationAsset.updateMany({
      where: { id: { in: ids } },
      data: { status: 'REPLACED' },
    }).catch((err: unknown) => console.error('[PgInclinationAssetRepo] replacePending error:', err))

    return pending.length
  }

  private toDomain(row: PrismaInclinationAsset): AgentInclinationAsset {
    return {
      id: row.id,
      agent_id: row.agentId,
      owner_user_id: row.ownerUserId,
      source_type: row.sourceType,
      origin_url: row.originUrl,
      storage_key: row.storageKey,
      media_url: row.mediaUrl,
      mime_type: row.mimeType,
      file_size_bytes: row.fileSizeBytes,
      owner_note: row.ownerNote,
      vision_summary: (row.visionSummaryJson as unknown as AgentInclinationAsset['vision_summary']) ?? {
        theme: '',
        scene: '',
        mood: '',
        discussion_points: [],
      },
      status: row.status,
      consumed_post_id: row.consumedPostId,
      consumed_at: row.consumedAt,
      created_at: row.createdAt,
    }
  }
}

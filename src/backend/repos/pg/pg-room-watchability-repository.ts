import {
  Prisma,
  type PrismaClient,
  type RoomEpisode as PrismaRoomEpisode,
  type RoomEpisodeCast as PrismaRoomEpisodeCast,
  type RoomLiveSnapshot as PrismaRoomLiveSnapshot,
  type RoomProgram as PrismaRoomProgram,
} from '@prisma/client'
import type {
  Room,
  RoomEpisode,
  RoomEpisodeCast,
  RoomLiveCastItem,
  RoomLiveSnapshot,
  RoomProgram,
} from '../types.js'
import type {
  RoomWatchabilityRepository,
  SaveRoomEpisodeCastInput,
  SaveRoomEpisodeStateInput,
  SaveRoomLiveSnapshotInput,
  UpdateRoomProgramInput,
} from '../room-watchability-repository.js'

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toLiveCastArray(value: Prisma.JsonValue): RoomLiveCastItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const candidate = entry as Record<string, unknown>
    if (
      typeof candidate.agent_id !== 'string'
      || typeof candidate.name !== 'string'
      || typeof candidate.role !== 'string'
    ) {
      return []
    }
    return [{
      agent_id: candidate.agent_id,
      name: candidate.name,
      role: candidate.role as RoomLiveCastItem['role'],
      last_spoke_at:
        typeof candidate.last_spoke_at === 'string' && candidate.last_spoke_at
          ? new Date(candidate.last_spoke_at)
          : null,
    }]
  })
}

function toProgramPatchData(patch: UpdateRoomProgramInput): Prisma.RoomProgramUpdateInput {
  const data: Prisma.RoomProgramUpdateInput = {}
  if (patch.enabled !== undefined) data.enabled = patch.enabled
  if (patch.scene_type !== undefined) data.sceneType = patch.scene_type
  if (patch.pacing_preset !== undefined) data.pacingPreset = patch.pacing_preset
  if (patch.target_cast_min !== undefined) data.targetCastMin = patch.target_cast_min
  if (patch.target_cast_max !== undefined) data.targetCastMax = patch.target_cast_max
  if (patch.allow_wandering !== undefined) data.allowWandering = patch.allow_wandering
  if (patch.discoverability_tags !== undefined) data.discoverabilityTags = patch.discoverability_tags
  if (patch.discoverability_short_hook !== undefined) data.discoverabilityShortHook = patch.discoverability_short_hook
  if (patch.discoverability_default_view !== undefined) {
    data.discoverabilityDefaultView = patch.discoverability_default_view
  }
  return data
}

export class PgRoomWatchabilityRepository implements RoomWatchabilityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rooms = await this.prisma.room.findMany({
      select: {
        id: true,
        description: true,
        maxAgents: true,
      },
    })
    if (rooms.length === 0) return

    await this.prisma.roomProgram.createMany({
      data: rooms.map((room) => ({
        roomId: room.id,
        enabled: false,
        sceneType: 'FREE_CHAT',
        pacingPreset: 'balanced',
        targetCastMin: Math.min(3, room.maxAgents),
        targetCastMax: room.maxAgents,
        allowWandering: true,
        discoverabilityTags: [],
        discoverabilityShortHook: room.description || null,
        discoverabilityDefaultView: 'live',
      })),
      skipDuplicates: true,
    })

    await this.prisma.roomLiveSnapshot.createMany({
      data: rooms.map((room) => ({
        roomId: room.id,
        episodeId: null,
        sceneType: 'FREE_CHAT',
        currentBeat: null,
        liveHook: null,
        unresolvedQuestion: null,
        recapShort: null,
        activeCastJson: [],
        lastHighlightText: null,
        energy: 0,
        tension: 0,
        messageCursorId: null,
        version: 0,
      })),
      skipDuplicates: true,
    })
  }

  async ensureProgram(room: Room): Promise<RoomProgram> {
    const row = await this.prisma.roomProgram.upsert({
      where: { roomId: room.id },
      create: {
        roomId: room.id,
        enabled: false,
        sceneType: 'FREE_CHAT',
        pacingPreset: 'balanced',
        targetCastMin: Math.min(3, room.max_agents),
        targetCastMax: room.max_agents,
        allowWandering: true,
        discoverabilityTags: [],
        discoverabilityShortHook: room.description || null,
        discoverabilityDefaultView: 'live',
      },
      update: {},
    })
    return this.toProgram(row)
  }

  async updateProgram(roomId: string, patch: UpdateRoomProgramInput): Promise<RoomProgram | null> {
    try {
      const row = await this.prisma.roomProgram.update({
        where: { roomId },
        data: toProgramPatchData(patch),
      })
      return this.toProgram(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  async getProgram(roomId: string): Promise<RoomProgram | null> {
    const row = await this.prisma.roomProgram.findUnique({ where: { roomId } })
    return row ? this.toProgram(row) : null
  }

  async ensureActiveEpisode(roomId: string, programId: string): Promise<RoomEpisode> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${roomId}))`)

      const existing = await tx.roomEpisode.findFirst({
        where: { roomId, status: 'ACTIVE' },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      })
      if (existing) return this.toEpisode(existing)

      const row = await tx.roomEpisode.create({
        data: {
          roomId,
          programId,
          status: 'ACTIVE',
          summaryText: '',
          unresolvedQuestion: null,
          energy: 0,
          tension: 0,
          turnCount: 0,
          messageCount: 0,
        },
      })
      return this.toEpisode(row)
    })
  }

  async getActiveEpisode(roomId: string): Promise<RoomEpisode | null> {
    const row = await this.prisma.roomEpisode.findFirst({
      where: { roomId, status: 'ACTIVE' },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toEpisode(row) : null
  }

  async saveEpisodeState(input: SaveRoomEpisodeStateInput): Promise<RoomEpisode | null> {
    try {
      const row = await this.prisma.roomEpisode.update({
        where: { id: input.episode_id },
        data: {
          summaryText: input.summary_text,
          unresolvedQuestion: input.unresolved_question,
          energy: input.energy,
          tension: input.tension,
          turnCount: input.turn_count,
          messageCount: input.message_count,
        },
      })
      return this.toEpisode(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  async replaceEpisodeCast(
    roomId: string,
    episodeId: string,
    cast: SaveRoomEpisodeCastInput[],
  ): Promise<RoomEpisodeCast[]> {
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.roomEpisodeCast.updateMany({
        where: { episodeId, leftAt: null },
        data: { leftAt: now },
      })

      for (const item of cast) {
        await tx.roomEpisodeCast.upsert({
          where: {
            episodeId_agentId: {
              episodeId,
              agentId: item.agent_id,
            },
          },
          create: {
            roomId,
            episodeId,
            agentId: item.agent_id,
            role: item.role,
            entrySource: item.entry_source,
            chemistryScore: item.chemistry_score,
            spotlightWeight: item.spotlight_weight,
            leftAt: null,
          },
          update: {
            role: item.role,
            entrySource: item.entry_source,
            chemistryScore: item.chemistry_score,
            spotlightWeight: item.spotlight_weight,
            leftAt: null,
          },
        })
      }
    })

    const rows = await this.prisma.roomEpisodeCast.findMany({
      where: { episodeId, leftAt: null },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toCast(row))
  }

  async getCurrentCast(roomId: string): Promise<RoomEpisodeCast[]> {
    const episode = await this.getActiveEpisode(roomId)
    if (!episode) return []
    const rows = await this.prisma.roomEpisodeCast.findMany({
      where: { episodeId: episode.id, leftAt: null },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toCast(row))
  }

  async saveLiveSnapshot(input: SaveRoomLiveSnapshotInput): Promise<RoomLiveSnapshot> {
    const activeCastJson = input.active_cast.map((entry) => ({
      agent_id: entry.agent_id,
      name: entry.name,
      role: entry.role,
      last_spoke_at: entry.last_spoke_at?.toISOString() ?? null,
    }))

    const row = await this.prisma.roomLiveSnapshot.upsert({
      where: { roomId: input.room_id },
      create: {
        roomId: input.room_id,
        episodeId: input.episode_id,
        sceneType: input.scene_type,
        currentBeat: input.current_beat,
        liveHook: input.live_hook,
        unresolvedQuestion: input.unresolved_question,
        recapShort: input.recap_short,
        activeCastJson,
        lastHighlightText: input.last_highlight_text,
        energy: input.energy,
        tension: input.tension,
        messageCursorId: input.message_cursor_id,
        version: 1,
      },
      update: {
        episodeId: input.episode_id,
        sceneType: input.scene_type,
        currentBeat: input.current_beat,
        liveHook: input.live_hook,
        unresolvedQuestion: input.unresolved_question,
        recapShort: input.recap_short,
        activeCastJson,
        lastHighlightText: input.last_highlight_text,
        energy: input.energy,
        tension: input.tension,
        messageCursorId: input.message_cursor_id,
        version: { increment: 1 },
      },
    })
    return this.toSnapshot(row)
  }

  async getLiveSnapshot(roomId: string): Promise<RoomLiveSnapshot | null> {
    const row = await this.prisma.roomLiveSnapshot.findUnique({ where: { roomId } })
    return row ? this.toSnapshot(row) : null
  }

  async listLiveSnapshots(roomIds: string[]): Promise<RoomLiveSnapshot[]> {
    if (roomIds.length === 0) return []
    const rows = await this.prisma.roomLiveSnapshot.findMany({
      where: { roomId: { in: roomIds } },
    })
    return rows.map((row) => this.toSnapshot(row))
  }

  private toProgram(row: PrismaRoomProgram): RoomProgram {
    return {
      id: row.id,
      room_id: row.roomId,
      enabled: row.enabled,
      scene_type: row.sceneType,
      pacing_preset: row.pacingPreset,
      target_cast_min: row.targetCastMin,
      target_cast_max: row.targetCastMax,
      allow_wandering: row.allowWandering,
      discoverability_tags: toStringArray(row.discoverabilityTags),
      discoverability_short_hook: row.discoverabilityShortHook,
      discoverability_default_view: row.discoverabilityDefaultView,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toEpisode(row: PrismaRoomEpisode): RoomEpisode {
    return {
      id: row.id,
      room_id: row.roomId,
      program_id: row.programId,
      status: row.status,
      summary_text: row.summaryText,
      unresolved_question: row.unresolvedQuestion,
      energy: row.energy,
      tension: row.tension,
      turn_count: row.turnCount,
      message_count: row.messageCount,
      started_at: row.startedAt,
      ended_at: row.endedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toCast(row: PrismaRoomEpisodeCast): RoomEpisodeCast {
    return {
      id: row.id,
      room_id: row.roomId,
      episode_id: row.episodeId,
      agent_id: row.agentId,
      role: row.role,
      entry_source: row.entrySource,
      chemistry_score: row.chemistryScore,
      spotlight_weight: row.spotlightWeight,
      joined_at: row.joinedAt,
      left_at: row.leftAt,
    }
  }

  private toSnapshot(row: PrismaRoomLiveSnapshot): RoomLiveSnapshot {
    return {
      id: row.id,
      room_id: row.roomId,
      episode_id: row.episodeId,
      scene_type: row.sceneType,
      current_beat: row.currentBeat,
      live_hook: row.liveHook,
      unresolved_question: row.unresolvedQuestion,
      recap_short: row.recapShort,
      active_cast: toLiveCastArray(row.activeCastJson),
      last_highlight_text: row.lastHighlightText,
      energy: row.energy,
      tension: row.tension,
      message_cursor_id: row.messageCursorId,
      version: row.version,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}

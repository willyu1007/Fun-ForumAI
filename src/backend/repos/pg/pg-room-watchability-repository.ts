import {
  Prisma,
  type PrismaClient,
  type RoomEpisode as PrismaRoomEpisode,
  type RoomEpisodeBeat as PrismaRoomEpisodeBeat,
  type RoomEpisodeCast as PrismaRoomEpisodeCast,
  type RoomHighlight as PrismaRoomHighlight,
  type RoomLiveSnapshot as PrismaRoomLiveSnapshot,
  type RoomProgram as PrismaRoomProgram,
  type RoomProgramEvent as PrismaRoomProgramEvent,
  type RoomSelectionLedger as PrismaRoomSelectionLedger,
} from '@prisma/client'
import type {
  PaginatedResult,
  PaginationOpts,
  Room,
  RoomCallbackCandidate,
  RoomEpisode,
  RoomEpisodeBeat,
  RoomEpisodeCast,
  RoomHighlight,
  RoomLiveCastItem,
  RoomLiveSnapshot,
  RoomProgram,
  RoomProgramEvent,
  RoomSelectionLedger,
  RoomSelectionReason,
} from '../types.js'
import type {
  CreateRoomEpisodeBeatInput,
  CreateRoomHighlightInput,
  CreateRoomProgramEventInput,
  PlanRoomProgramCueInput,
  PlanRoomProgramCueResult,
  RoomWatchabilityRepository,
  SaveRoomEpisodeCastInput,
  SaveRoomEpisodeStateInput,
  SaveRoomLiveSnapshotInput,
  SaveRoomSelectionLedgerInput,
  UpdateRoomProgramEventInput,
  UpdateRoomProgramInput,
} from '../room-watchability-repository.js'

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toCallbackCandidates(value: Prisma.JsonValue): RoomCallbackCandidate[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const candidate = entry as Record<string, unknown>
    if (
      typeof candidate.message_id !== 'string'
      || typeof candidate.author_agent_id !== 'string'
      || typeof candidate.summary_text !== 'string'
      || typeof candidate.weight !== 'number'
      || typeof candidate.created_at !== 'string'
    ) {
      return []
    }
    return [{
      message_id: candidate.message_id,
      author_agent_id: candidate.author_agent_id,
      summary_text: candidate.summary_text,
      weight: candidate.weight,
      created_at: candidate.created_at,
    }]
  })
}

function toSelectionReasons(value: Prisma.JsonValue): RoomSelectionReason[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const reason = entry as Record<string, unknown>
    if (
      typeof reason.code !== 'string'
      || typeof reason.value !== 'number'
      || typeof reason.message !== 'string'
    ) {
      return []
    }
    return [{
      code: reason.code,
      value: reason.value,
      message: reason.message,
    }]
  })
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

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const index = items.findIndex((item) => item.id === opts.cursor)
    start = index >= 0 ? index + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

function toProgramPatchData(patch: UpdateRoomProgramInput): Prisma.RoomProgramUpdateInput {
  const data: Prisma.RoomProgramUpdateInput = {}
  if (patch.enabled !== undefined) data.enabled = patch.enabled
  if (patch.scene_type !== undefined) data.sceneType = patch.scene_type
  if (patch.pacing_preset !== undefined) data.pacingPreset = patch.pacing_preset
  if (patch.target_cast_min !== undefined) data.targetCastMin = patch.target_cast_min
  if (patch.target_cast_max !== undefined) data.targetCastMax = patch.target_cast_max
  if (patch.callback_window !== undefined) data.callbackWindow = patch.callback_window
  if (patch.recap_every_turns !== undefined) data.recapEveryTurns = patch.recap_every_turns
  if (patch.max_consecutive_turns !== undefined) data.maxConsecutiveTurns = patch.max_consecutive_turns
  if (patch.idle_cue_after_ms !== undefined) data.idleCueAfterMs = patch.idle_cue_after_ms
  if (patch.allow_wandering !== undefined) data.allowWandering = patch.allow_wandering
  if (patch.director_policy_json !== undefined) data.directorPolicyJson = patch.director_policy_json
  if (patch.discoverability_tags !== undefined) data.discoverabilityTags = patch.discoverability_tags
  if (patch.discoverability_short_hook !== undefined) {
    data.discoverabilityShortHook = patch.discoverability_short_hook
  }
  if (patch.discoverability_default_view !== undefined) {
    data.discoverabilityDefaultView = patch.discoverability_default_view
  }
  return data
}

function toProgramEventPatchData(patch: UpdateRoomProgramEventInput): Prisma.RoomProgramEventUpdateInput {
  const data: Prisma.RoomProgramEventUpdateInput = {}
  if (patch.status !== undefined) data.status = patch.status
  if (patch.cue_type !== undefined) data.cueType = patch.cue_type
  if (patch.director_goal !== undefined) data.directorGoal = patch.director_goal
  if (patch.selected_speaker_agent_id !== undefined) {
    data.selectedSpeakerAgentId = patch.selected_speaker_agent_id
  }
  if (patch.payload_json !== undefined) data.payloadJson = patch.payload_json
  if (patch.error_text !== undefined) data.errorText = patch.error_text
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
        callbackWindow: 18,
        recapEveryTurns: 10,
        maxConsecutiveTurns: 1,
        idleCueAfterMs: 30_000,
        allowWandering: true,
        directorPolicyJson: {},
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
        callbackWindow: 18,
        recapEveryTurns: 10,
        maxConsecutiveTurns: 1,
        idleCueAfterMs: 30_000,
        allowWandering: true,
        directorPolicyJson: {},
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
          callbackBankJson: [],
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
          callbackBankJson: input.callback_bank_json,
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

  async createEpisodeBeat(input: CreateRoomEpisodeBeatInput): Promise<RoomEpisodeBeat> {
    const row = await this.prisma.roomEpisodeBeat.create({
      data: {
        roomId: input.room_id,
        episodeId: input.episode_id,
        ordinal: input.ordinal,
        beatType: input.beat_type,
        cueType: input.cue_type,
        directorGoal: input.director_goal,
        promptHint: input.prompt_hint ?? null,
        anchorMessageId: input.anchor_message_id ?? null,
        callbackMessageId: input.callback_message_id ?? null,
        targetRole: input.target_role ?? null,
        selectedSpeakerAgentId: input.selected_speaker_agent_id ?? null,
        status: input.status ?? 'planned',
        auditJson: input.audit_json ?? null,
      },
    })
    return this.toBeat(row)
  }

  async getLatestBeat(episodeId: string): Promise<RoomEpisodeBeat | null> {
    const row = await this.prisma.roomEpisodeBeat.findFirst({
      where: { episodeId },
      orderBy: [{ ordinal: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toBeat(row) : null
  }

  async createProgramEvent(input: CreateRoomProgramEventInput): Promise<RoomProgramEvent> {
    try {
      const row = await this.prisma.roomProgramEvent.create({
        data: {
          roomId: input.room_id,
          episodeId: input.episode_id ?? null,
          beatId: input.beat_id ?? null,
          eventType: input.event_type,
          status: input.status,
          cueType: input.cue_type ?? null,
          directorGoal: input.director_goal ?? null,
          selectedSpeakerAgentId: input.selected_speaker_agent_id ?? null,
          idempotencyKey: input.idempotency_key,
          payloadJson: input.payload_json ?? null,
          errorText: input.error_text ?? null,
        },
      })
      return this.toProgramEvent(row)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        const existing = await this.prisma.roomProgramEvent.findUnique({
          where: { idempotencyKey: input.idempotency_key },
        })
        if (existing) return this.toProgramEvent(existing)
      }
      throw error
    }
  }

  async planProgramCue(input: PlanRoomProgramCueInput): Promise<PlanRoomProgramCueResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.room_id}))`)

      const existingEvent = await tx.roomProgramEvent.findUnique({
        where: { idempotencyKey: input.idempotency_key },
      })

      if (existingEvent) {
        const existingBeat = existingEvent.beatId
          ? await tx.roomEpisodeBeat.findUnique({ where: { id: existingEvent.beatId } })
          : null
        const existingLedgers = await this.listSelectionLedgersTx(tx, existingEvent.id)

        if (existingBeat && existingLedgers.length > 0) {
          return {
            beat: this.toBeat(existingBeat),
            event: this.toProgramEvent(existingEvent),
            ledgers: existingLedgers.map((row) => this.toSelectionLedger(row)),
            created_now: false,
          }
        }

        const beat = existingBeat ?? await tx.roomEpisodeBeat.create({
          data: {
            roomId: input.room_id,
            episodeId: input.episode_id,
            ordinal: input.ordinal,
            beatType: input.beat_type,
            cueType: input.cue_type,
            directorGoal: input.director_goal,
            promptHint: input.prompt_hint ?? null,
            anchorMessageId: input.anchor_message_id ?? null,
            callbackMessageId: input.callback_message_id ?? null,
            targetRole: input.target_role ?? null,
            selectedSpeakerAgentId: input.selected_speaker_agent_id,
            status: input.beat_status ?? 'selected',
            auditJson: input.beat_audit_json ?? null,
          },
        })

        const event = await tx.roomProgramEvent.update({
          where: { id: existingEvent.id },
          data: {
            beatId: existingEvent.beatId ?? beat.id,
            status: input.event_status ?? existingEvent.status,
            cueType: input.cue_type,
            directorGoal: input.director_goal,
            selectedSpeakerAgentId: input.selected_speaker_agent_id,
            payloadJson: input.event_payload_json ?? existingEvent.payloadJson,
          },
        })

        const ledgers = existingLedgers.length > 0
          ? existingLedgers
          : await this.createSelectionLedgersTx(tx, input, event.id, beat.id)

        return {
          beat: this.toBeat(beat),
          event: this.toProgramEvent(event),
          ledgers: ledgers.map((row) => this.toSelectionLedger(row)),
          created_now: true,
        }
      }

      const beat = await tx.roomEpisodeBeat.create({
        data: {
          roomId: input.room_id,
          episodeId: input.episode_id,
          ordinal: input.ordinal,
          beatType: input.beat_type,
          cueType: input.cue_type,
          directorGoal: input.director_goal,
          promptHint: input.prompt_hint ?? null,
          anchorMessageId: input.anchor_message_id ?? null,
          callbackMessageId: input.callback_message_id ?? null,
          targetRole: input.target_role ?? null,
          selectedSpeakerAgentId: input.selected_speaker_agent_id,
          status: input.beat_status ?? 'selected',
          auditJson: input.beat_audit_json ?? null,
        },
      })

      const event = await tx.roomProgramEvent.create({
        data: {
          roomId: input.room_id,
          episodeId: input.episode_id,
          beatId: beat.id,
          eventType: 'PROGRAM_CUE',
          status: input.event_status ?? 'PLANNED',
          cueType: input.cue_type,
          directorGoal: input.director_goal,
          selectedSpeakerAgentId: input.selected_speaker_agent_id,
          idempotencyKey: input.idempotency_key,
          payloadJson: input.event_payload_json ?? null,
          errorText: null,
        },
      })

      const ledgers = await this.createSelectionLedgersTx(tx, input, event.id, beat.id)

      return {
        beat: this.toBeat(beat),
        event: this.toProgramEvent(event),
        ledgers: ledgers.map((row) => this.toSelectionLedger(row)),
        created_now: true,
      }
    })
  }

  async updateProgramEvent(id: string, patch: UpdateRoomProgramEventInput): Promise<RoomProgramEvent | null> {
    try {
      const row = await this.prisma.roomProgramEvent.update({
        where: { id },
        data: toProgramEventPatchData(patch),
      })
      return this.toProgramEvent(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  async getLatestProgramEvent(roomId: string): Promise<RoomProgramEvent | null> {
    const row = await this.prisma.roomProgramEvent.findFirst({
      where: { roomId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toProgramEvent(row) : null
  }

  async saveSelectionLedger(input: SaveRoomSelectionLedgerInput[]): Promise<RoomSelectionLedger[]> {
    if (input.length === 0) return []
    const rows = await this.prisma.$transaction(input.map((entry) => this.prisma.roomSelectionLedger.create({
      data: {
        roomId: entry.room_id,
        episodeId: entry.episode_id ?? null,
        beatId: entry.beat_id ?? null,
        programEventId: entry.program_event_id,
        candidateAgentId: entry.candidate_agent_id,
        selected: entry.selected,
        finalScore: entry.final_score,
        reasonsJson: entry.reasons_json,
      },
    })))
    return rows.map((row) => this.toSelectionLedger(row))
  }

  async listSelectionLedger(programEventId: string): Promise<RoomSelectionLedger[]> {
    const rows = await this.prisma.roomSelectionLedger.findMany({
      where: { programEventId },
      orderBy: [{ selected: 'desc' }, { finalScore: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toSelectionLedger(row))
  }

  async createHighlight(input: CreateRoomHighlightInput): Promise<RoomHighlight> {
    try {
      const row = await this.prisma.roomHighlight.create({
        data: {
          roomId: input.room_id,
          episodeId: input.episode_id ?? null,
          beatId: input.beat_id ?? null,
          sourceMessageId: input.source_message_id,
          kind: input.kind,
          text: input.text,
          actorAgentIdsJson: input.actor_agent_ids,
          score: input.score,
        },
      })
      return this.toHighlight(row)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        const existing = await this.prisma.roomHighlight.findUnique({
          where: { sourceMessageId: input.source_message_id },
        })
        if (existing) return this.toHighlight(existing)
      }
      throw error
    }
  }

  async getLatestHighlight(roomId: string): Promise<RoomHighlight | null> {
    const row = await this.prisma.roomHighlight.findFirst({
      where: { roomId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toHighlight(row) : null
  }

  async listHighlights(
    roomId: string,
    opts: PaginationOpts & { episode_id?: string | null },
  ): Promise<PaginatedResult<RoomHighlight>> {
    const rows = await this.prisma.roomHighlight.findMany({
      where: {
        roomId,
        ...(opts.episode_id ? { episodeId: opts.episode_id } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return paginate(rows.map((row) => this.toHighlight(row)), opts)
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
      callback_window: row.callbackWindow,
      recap_every_turns: row.recapEveryTurns,
      max_consecutive_turns: row.maxConsecutiveTurns,
      idle_cue_after_ms: row.idleCueAfterMs,
      allow_wandering: row.allowWandering,
      director_policy_json: toRecord(row.directorPolicyJson),
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
      callback_bank_json: toCallbackCandidates(row.callbackBankJson),
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

  private toBeat(row: PrismaRoomEpisodeBeat): RoomEpisodeBeat {
    return {
      id: row.id,
      room_id: row.roomId,
      episode_id: row.episodeId,
      ordinal: row.ordinal,
      beat_type: row.beatType,
      cue_type: row.cueType,
      director_goal: row.directorGoal,
      prompt_hint: row.promptHint,
      anchor_message_id: row.anchorMessageId,
      callback_message_id: row.callbackMessageId,
      target_role: row.targetRole,
      selected_speaker_agent_id: row.selectedSpeakerAgentId,
      status: row.status,
      audit_json: row.auditJson ? toRecord(row.auditJson) : null,
      created_at: row.createdAt,
      completed_at: row.completedAt,
    }
  }

  private toProgramEvent(row: PrismaRoomProgramEvent): RoomProgramEvent {
    return {
      id: row.id,
      room_id: row.roomId,
      episode_id: row.episodeId,
      beat_id: row.beatId,
      event_type: row.eventType,
      status: row.status,
      cue_type: row.cueType,
      director_goal: row.directorGoal,
      selected_speaker_agent_id: row.selectedSpeakerAgentId,
      idempotency_key: row.idempotencyKey,
      payload_json: row.payloadJson ? toRecord(row.payloadJson) : null,
      error_text: row.errorText,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toSelectionLedger(row: PrismaRoomSelectionLedger): RoomSelectionLedger {
    return {
      id: row.id,
      room_id: row.roomId,
      episode_id: row.episodeId,
      beat_id: row.beatId,
      program_event_id: row.programEventId,
      candidate_agent_id: row.candidateAgentId,
      selected: row.selected,
      final_score: row.finalScore,
      reasons_json: toSelectionReasons(row.reasonsJson),
      created_at: row.createdAt,
    }
  }

  private toHighlight(row: PrismaRoomHighlight): RoomHighlight {
    return {
      id: row.id,
      room_id: row.roomId,
      episode_id: row.episodeId,
      beat_id: row.beatId,
      source_message_id: row.sourceMessageId,
      kind: row.kind,
      text: row.text,
      actor_agent_ids: toStringArray(row.actorAgentIdsJson),
      score: row.score,
      created_at: row.createdAt,
    }
  }

  private toSnapshot(row: PrismaRoomLiveSnapshot): RoomLiveSnapshot {
    return {
      id: row.id,
      room_id: row.roomId,
      episode_id: row.episodeId,
      scene_type: row.sceneType,
      current_beat: row.currentBeat as RoomLiveSnapshot['current_beat'],
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

  private async createSelectionLedgersTx(
    tx: Prisma.TransactionClient,
    input: PlanRoomProgramCueInput,
    programEventId: string,
    beatId: string,
  ): Promise<PrismaRoomSelectionLedger[]> {
    return Promise.all(input.selection_ledger.map((entry) => tx.roomSelectionLedger.create({
      data: {
        roomId: input.room_id,
        episodeId: input.episode_id,
        beatId,
        programEventId,
        candidateAgentId: entry.candidate_agent_id,
        selected: entry.selected,
        finalScore: entry.final_score,
        reasonsJson: entry.reasons_json,
      },
    })))
  }

  private async listSelectionLedgersTx(
    tx: Prisma.TransactionClient,
    programEventId: string,
  ): Promise<PrismaRoomSelectionLedger[]> {
    return tx.roomSelectionLedger.findMany({
      where: { programEventId },
      orderBy: [{ selected: 'desc' }, { finalScore: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
  }
}

import type {
  PaginatedResult,
  PaginationOpts,
  Room,
  RoomBeatType,
  RoomCallbackCandidate,
  RoomCastRole,
  RoomCueType,
  RoomEpisode,
  RoomEpisodeBeat,
  RoomEpisodeCast,
  RoomHighlight,
  RoomHighlightKind,
  RoomLiveCastItem,
  RoomLiveSnapshot,
  RoomProgram,
  RoomProgramEvent,
  RoomProgramEventStatus,
  RoomProgramEventType,
  RoomSceneType,
  RoomSelectionLedger,
  RoomSelectionReason,
} from './types.js'

export interface UpdateRoomProgramInput {
  enabled?: boolean
  scene_type?: RoomSceneType
  pacing_preset?: string
  target_cast_min?: number
  target_cast_max?: number
  callback_window?: number
  recap_every_turns?: number
  max_consecutive_turns?: number
  idle_cue_after_ms?: number
  allow_wandering?: boolean
  director_policy_json?: Record<string, unknown>
  discoverability_tags?: string[]
  discoverability_short_hook?: string | null
  discoverability_default_view?: string
}

export interface SaveRoomEpisodeStateInput {
  episode_id: string
  summary_text: string
  unresolved_question: string | null
  callback_bank_json: RoomCallbackCandidate[]
  energy: number
  tension: number
  turn_count: number
  message_count: number
}

export interface SaveRoomEpisodeCastInput {
  room_id: string
  episode_id: string
  agent_id: string
  role: RoomCastRole
  entry_source: string
  chemistry_score: number
  spotlight_weight: number
}

export interface SaveRoomLiveSnapshotInput {
  room_id: string
  episode_id: string | null
  scene_type: RoomSceneType
  current_beat: RoomBeatType | null
  live_hook: string | null
  unresolved_question: string | null
  recap_short: string | null
  active_cast: RoomLiveCastItem[]
  last_highlight_text: string | null
  energy: number
  tension: number
  message_cursor_id: string | null
}

export interface CreateRoomEpisodeBeatInput {
  room_id: string
  episode_id: string
  ordinal: number
  beat_type: RoomBeatType
  cue_type: RoomCueType
  director_goal: string
  prompt_hint?: string | null
  anchor_message_id?: string | null
  callback_message_id?: string | null
  target_role?: RoomCastRole | null
  selected_speaker_agent_id?: string | null
  status?: string
  audit_json?: Record<string, unknown> | null
}

export interface CreateRoomProgramEventInput {
  room_id: string
  episode_id?: string | null
  beat_id?: string | null
  event_type: RoomProgramEventType
  status: RoomProgramEventStatus
  cue_type?: RoomCueType | null
  director_goal?: string | null
  selected_speaker_agent_id?: string | null
  idempotency_key: string
  payload_json?: Record<string, unknown> | null
  error_text?: string | null
}

export interface UpdateRoomProgramEventInput {
  status?: RoomProgramEventStatus
  cue_type?: RoomCueType | null
  director_goal?: string | null
  selected_speaker_agent_id?: string | null
  payload_json?: Record<string, unknown> | null
  error_text?: string | null
}

export interface SaveRoomSelectionLedgerInput {
  room_id: string
  episode_id?: string | null
  beat_id?: string | null
  program_event_id: string
  candidate_agent_id: string
  selected: boolean
  final_score: number
  reasons_json: RoomSelectionReason[]
}

export interface CreateRoomHighlightInput {
  room_id: string
  episode_id?: string | null
  beat_id?: string | null
  source_message_id: string
  kind: RoomHighlightKind
  text: string
  actor_agent_ids: string[]
  score: number
}

export interface PlanRoomProgramCueInput {
  room_id: string
  episode_id: string
  ordinal: number
  beat_type: RoomBeatType
  cue_type: RoomCueType
  director_goal: string
  prompt_hint?: string | null
  anchor_message_id?: string | null
  callback_message_id?: string | null
  target_role?: RoomCastRole | null
  selected_speaker_agent_id: string
  beat_status?: string
  beat_audit_json?: Record<string, unknown> | null
  event_status?: RoomProgramEventStatus
  idempotency_key: string
  event_payload_json?: Record<string, unknown> | null
  selection_ledger: Array<{
    candidate_agent_id: string
    selected: boolean
    final_score: number
    reasons_json: RoomSelectionReason[]
  }>
}

export interface PlanRoomProgramCueResult {
  beat: RoomEpisodeBeat
  event: RoomProgramEvent
  ledgers: RoomSelectionLedger[]
  created_now: boolean
}

export interface RoomWatchabilityRepository {
  ensureProgram(room: Room): Promise<RoomProgram>
  updateProgram(roomId: string, patch: UpdateRoomProgramInput): Promise<RoomProgram | null>
  getProgram(roomId: string): Promise<RoomProgram | null>
  ensureActiveEpisode(roomId: string, programId: string): Promise<RoomEpisode>
  getActiveEpisode(roomId: string): Promise<RoomEpisode | null>
  saveEpisodeState(input: SaveRoomEpisodeStateInput): Promise<RoomEpisode | null>
  replaceEpisodeCast(roomId: string, episodeId: string, cast: SaveRoomEpisodeCastInput[]): Promise<RoomEpisodeCast[]>
  getCurrentCast(roomId: string): Promise<RoomEpisodeCast[]>
  createEpisodeBeat(input: CreateRoomEpisodeBeatInput): Promise<RoomEpisodeBeat>
  getLatestBeat(episodeId: string): Promise<RoomEpisodeBeat | null>
  createProgramEvent(input: CreateRoomProgramEventInput): Promise<RoomProgramEvent>
  planProgramCue(input: PlanRoomProgramCueInput): Promise<PlanRoomProgramCueResult>
  updateProgramEvent(id: string, patch: UpdateRoomProgramEventInput): Promise<RoomProgramEvent | null>
  getLatestProgramEvent(roomId: string): Promise<RoomProgramEvent | null>
  saveSelectionLedger(input: SaveRoomSelectionLedgerInput[]): Promise<RoomSelectionLedger[]>
  listSelectionLedger(programEventId: string): Promise<RoomSelectionLedger[]>
  createHighlight(input: CreateRoomHighlightInput): Promise<RoomHighlight>
  getLatestHighlight(roomId: string): Promise<RoomHighlight | null>
  listHighlights(
    roomId: string,
    opts: PaginationOpts & { episode_id?: string | null },
  ): Promise<PaginatedResult<RoomHighlight>>
  saveLiveSnapshot(input: SaveRoomLiveSnapshotInput): Promise<RoomLiveSnapshot>
  getLiveSnapshot(roomId: string): Promise<RoomLiveSnapshot | null>
  listLiveSnapshots(roomIds: string[]): Promise<RoomLiveSnapshot[]>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

function defaultProgram(room: Room): RoomProgram {
  const now = new Date()
  return {
    id: cuid('rprog'),
    room_id: room.id,
    enabled: false,
    scene_type: 'FREE_CHAT',
    pacing_preset: 'balanced',
    target_cast_min: Math.min(3, room.max_agents),
    target_cast_max: room.max_agents,
    callback_window: 18,
    recap_every_turns: 10,
    max_consecutive_turns: 1,
    idle_cue_after_ms: 30_000,
    allow_wandering: true,
    director_policy_json: {},
    discoverability_tags: [],
    discoverability_short_hook: room.description || null,
    discoverability_default_view: 'live',
    created_at: now,
    updated_at: now,
  }
}

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

export class InMemoryRoomWatchabilityRepository implements RoomWatchabilityRepository {
  private readonly programs = new Map<string, RoomProgram>()
  private readonly episodes = new Map<string, RoomEpisode>()
  private readonly activeEpisodeByRoom = new Map<string, string>()
  private readonly castByEpisode = new Map<string, RoomEpisodeCast[]>()
  private readonly beatsByEpisode = new Map<string, RoomEpisodeBeat[]>()
  private readonly events = new Map<string, RoomProgramEvent>()
  private readonly eventIdsByRoom = new Map<string, string[]>()
  private readonly eventIdByIdempotency = new Map<string, string>()
  private readonly ledgersByEvent = new Map<string, RoomSelectionLedger[]>()
  private readonly highlights = new Map<string, RoomHighlight>()
  private readonly highlightIdsByRoom = new Map<string, string[]>()
  private readonly snapshots = new Map<string, RoomLiveSnapshot>()

  async hydrate(): Promise<void> {}

  async ensureProgram(room: Room): Promise<RoomProgram> {
    const existing = this.programs.get(room.id)
    if (existing) return existing
    const created = defaultProgram(room)
    this.programs.set(room.id, created)
    return created
  }

  async updateProgram(roomId: string, patch: UpdateRoomProgramInput): Promise<RoomProgram | null> {
    const existing = this.programs.get(roomId)
    if (!existing) return null
    const updated: RoomProgram = {
      ...existing,
      ...patch,
      updated_at: new Date(),
    }
    this.programs.set(roomId, updated)
    return updated
  }

  async getProgram(roomId: string): Promise<RoomProgram | null> {
    return this.programs.get(roomId) ?? null
  }

  async ensureActiveEpisode(roomId: string, programId: string): Promise<RoomEpisode> {
    const existingId = this.activeEpisodeByRoom.get(roomId)
    if (existingId) {
      const existing = this.episodes.get(existingId)
      if (existing) return existing
    }

    const now = new Date()
    const episode: RoomEpisode = {
      id: cuid('rep'),
      room_id: roomId,
      program_id: programId,
      status: 'ACTIVE',
      summary_text: '',
      unresolved_question: null,
      callback_bank_json: [],
      energy: 0,
      tension: 0,
      turn_count: 0,
      message_count: 0,
      started_at: now,
      ended_at: null,
      created_at: now,
      updated_at: now,
    }
    this.episodes.set(episode.id, episode)
    this.activeEpisodeByRoom.set(roomId, episode.id)
    return episode
  }

  async getActiveEpisode(roomId: string): Promise<RoomEpisode | null> {
    const episodeId = this.activeEpisodeByRoom.get(roomId)
    if (!episodeId) return null
    return this.episodes.get(episodeId) ?? null
  }

  async saveEpisodeState(input: SaveRoomEpisodeStateInput): Promise<RoomEpisode | null> {
    const existing = this.episodes.get(input.episode_id)
    if (!existing) return null
    const updated: RoomEpisode = {
      ...existing,
      summary_text: input.summary_text,
      unresolved_question: input.unresolved_question,
      callback_bank_json: input.callback_bank_json,
      energy: input.energy,
      tension: input.tension,
      turn_count: input.turn_count,
      message_count: input.message_count,
      updated_at: new Date(),
    }
    this.episodes.set(updated.id, updated)
    return updated
  }

  async replaceEpisodeCast(
    roomId: string,
    episodeId: string,
    cast: SaveRoomEpisodeCastInput[],
  ): Promise<RoomEpisodeCast[]> {
    const now = new Date()
    const next = cast.map((item) => {
      const existing = (this.castByEpisode.get(episodeId) ?? []).find((entry) => entry.agent_id === item.agent_id)
      return {
        id: existing?.id ?? cuid('rcast'),
        room_id: roomId,
        episode_id: episodeId,
        agent_id: item.agent_id,
        role: item.role,
        entry_source: item.entry_source,
        chemistry_score: item.chemistry_score,
        spotlight_weight: item.spotlight_weight,
        joined_at: existing?.joined_at ?? now,
        left_at: null,
      } satisfies RoomEpisodeCast
    })
    this.castByEpisode.set(episodeId, next)
    return next
  }

  async getCurrentCast(roomId: string): Promise<RoomEpisodeCast[]> {
    const episodeId = this.activeEpisodeByRoom.get(roomId)
    if (!episodeId) return []
    return this.castByEpisode.get(episodeId) ?? []
  }

  async createEpisodeBeat(input: CreateRoomEpisodeBeatInput): Promise<RoomEpisodeBeat> {
    const beat: RoomEpisodeBeat = {
      id: cuid('rbeat'),
      room_id: input.room_id,
      episode_id: input.episode_id,
      ordinal: input.ordinal,
      beat_type: input.beat_type,
      cue_type: input.cue_type,
      director_goal: input.director_goal,
      prompt_hint: input.prompt_hint ?? null,
      anchor_message_id: input.anchor_message_id ?? null,
      callback_message_id: input.callback_message_id ?? null,
      target_role: input.target_role ?? null,
      selected_speaker_agent_id: input.selected_speaker_agent_id ?? null,
      status: input.status ?? 'planned',
      audit_json: input.audit_json ?? null,
      created_at: new Date(),
      completed_at: null,
    }
    const beats = this.beatsByEpisode.get(input.episode_id) ?? []
    beats.push(beat)
    beats.sort((a, b) => a.ordinal - b.ordinal || a.created_at.getTime() - b.created_at.getTime())
    this.beatsByEpisode.set(input.episode_id, beats)
    return beat
  }

  async getLatestBeat(episodeId: string): Promise<RoomEpisodeBeat | null> {
    const beats = this.beatsByEpisode.get(episodeId) ?? []
    return beats.length > 0 ? beats[beats.length - 1] : null
  }

  async planProgramCue(input: PlanRoomProgramCueInput): Promise<PlanRoomProgramCueResult> {
    const existingEventId = this.eventIdByIdempotency.get(input.idempotency_key)
    const existingEvent = existingEventId ? this.events.get(existingEventId) ?? null : null
    const existingBeat = existingEvent?.beat_id
      ? (this.beatsByEpisode.get(input.episode_id) ?? []).find((beat) => beat.id === existingEvent.beat_id) ?? null
      : null
    const existingLedgers = existingEvent ? this.ledgersByEvent.get(existingEvent.id) ?? [] : []

    if (existingEvent && existingBeat && existingLedgers.length > 0) {
      return {
        beat: existingBeat,
        event: existingEvent,
        ledgers: existingLedgers,
        created_now: false,
      }
    }

    const beat = existingBeat ?? await this.createEpisodeBeat({
      room_id: input.room_id,
      episode_id: input.episode_id,
      ordinal: input.ordinal,
      beat_type: input.beat_type,
      cue_type: input.cue_type,
      director_goal: input.director_goal,
      prompt_hint: input.prompt_hint ?? null,
      anchor_message_id: input.anchor_message_id ?? null,
      callback_message_id: input.callback_message_id ?? null,
      target_role: input.target_role ?? null,
      selected_speaker_agent_id: input.selected_speaker_agent_id,
      status: input.beat_status ?? 'selected',
      audit_json: input.beat_audit_json ?? null,
    })

    const event = existingEvent
      ? {
          ...existingEvent,
          beat_id: existingEvent.beat_id ?? beat.id,
          status: input.event_status ?? existingEvent.status,
          cue_type: input.cue_type,
          director_goal: input.director_goal,
          selected_speaker_agent_id: input.selected_speaker_agent_id,
          payload_json: input.event_payload_json ?? existingEvent.payload_json,
          updated_at: new Date(),
        }
      : {
          id: cuid('rpevt'),
          room_id: input.room_id,
          episode_id: input.episode_id,
          beat_id: beat.id,
          event_type: 'PROGRAM_CUE',
          status: input.event_status ?? 'PLANNED',
          cue_type: input.cue_type,
          director_goal: input.director_goal,
          selected_speaker_agent_id: input.selected_speaker_agent_id,
          idempotency_key: input.idempotency_key,
          payload_json: input.event_payload_json ?? null,
          error_text: null,
          created_at: new Date(),
          updated_at: new Date(),
        } satisfies RoomProgramEvent

    this.events.set(event.id, event)
    this.eventIdByIdempotency.set(event.idempotency_key, event.id)
    const roomEvents = this.eventIdsByRoom.get(event.room_id) ?? []
    if (!roomEvents.includes(event.id)) {
      roomEvents.push(event.id)
      this.eventIdsByRoom.set(event.room_id, roomEvents)
    }

    const ledgers = existingLedgers.length > 0
      ? existingLedgers
      : await this.saveSelectionLedger(input.selection_ledger.map((entry) => ({
          room_id: input.room_id,
          episode_id: input.episode_id,
          beat_id: beat.id,
          program_event_id: event.id,
          candidate_agent_id: entry.candidate_agent_id,
          selected: entry.selected,
          final_score: entry.final_score,
          reasons_json: entry.reasons_json,
        })))

    return {
      beat,
      event: {
        ...event,
        beat_id: event.beat_id ?? beat.id,
      },
      ledgers,
      created_now: true,
    }
  }

  async createProgramEvent(input: CreateRoomProgramEventInput): Promise<RoomProgramEvent> {
    const existingId = this.eventIdByIdempotency.get(input.idempotency_key)
    if (existingId) {
      return this.events.get(existingId)!
    }

    const event: RoomProgramEvent = {
      id: cuid('rpevt'),
      room_id: input.room_id,
      episode_id: input.episode_id ?? null,
      beat_id: input.beat_id ?? null,
      event_type: input.event_type,
      status: input.status,
      cue_type: input.cue_type ?? null,
      director_goal: input.director_goal ?? null,
      selected_speaker_agent_id: input.selected_speaker_agent_id ?? null,
      idempotency_key: input.idempotency_key,
      payload_json: input.payload_json ?? null,
      error_text: input.error_text ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    this.events.set(event.id, event)
    this.eventIdByIdempotency.set(event.idempotency_key, event.id)
    const roomEvents = this.eventIdsByRoom.get(event.room_id) ?? []
    roomEvents.push(event.id)
    this.eventIdsByRoom.set(event.room_id, roomEvents)
    return event
  }

  async updateProgramEvent(id: string, patch: UpdateRoomProgramEventInput): Promise<RoomProgramEvent | null> {
    const existing = this.events.get(id)
    if (!existing) return null
    const updated: RoomProgramEvent = {
      ...existing,
      ...patch,
      updated_at: new Date(),
    }
    this.events.set(id, updated)
    return updated
  }

  async getLatestProgramEvent(roomId: string): Promise<RoomProgramEvent | null> {
    const ids = this.eventIdsByRoom.get(roomId) ?? []
    if (ids.length === 0) return null
    return this.events.get(ids[ids.length - 1]) ?? null
  }

  async saveSelectionLedger(input: SaveRoomSelectionLedgerInput[]): Promise<RoomSelectionLedger[]> {
    const created = input.map((entry) => ({
      id: cuid('rpledger'),
      room_id: entry.room_id,
      episode_id: entry.episode_id ?? null,
      beat_id: entry.beat_id ?? null,
      program_event_id: entry.program_event_id,
      candidate_agent_id: entry.candidate_agent_id,
      selected: entry.selected,
      final_score: entry.final_score,
      reasons_json: entry.reasons_json,
      created_at: new Date(),
    } satisfies RoomSelectionLedger))

    for (const ledger of created) {
      const ledgers = this.ledgersByEvent.get(ledger.program_event_id) ?? []
      ledgers.push(ledger)
      ledgers.sort((a, b) => Number(b.selected) - Number(a.selected) || b.final_score - a.final_score)
      this.ledgersByEvent.set(ledger.program_event_id, ledgers)
    }

    return created
  }

  async listSelectionLedger(programEventId: string): Promise<RoomSelectionLedger[]> {
    return this.ledgersByEvent.get(programEventId) ?? []
  }

  async createHighlight(input: CreateRoomHighlightInput): Promise<RoomHighlight> {
    const existing = Array.from(this.highlights.values()).find((entry) => entry.source_message_id === input.source_message_id)
    if (existing) return existing

    const highlight: RoomHighlight = {
      id: cuid('rhl'),
      room_id: input.room_id,
      episode_id: input.episode_id ?? null,
      beat_id: input.beat_id ?? null,
      source_message_id: input.source_message_id,
      kind: input.kind,
      text: input.text,
      actor_agent_ids: input.actor_agent_ids,
      score: input.score,
      created_at: new Date(),
    }
    this.highlights.set(highlight.id, highlight)
    const ids = this.highlightIdsByRoom.get(highlight.room_id) ?? []
    ids.push(highlight.id)
    this.highlightIdsByRoom.set(highlight.room_id, ids)
    return highlight
  }

  async getLatestHighlight(roomId: string): Promise<RoomHighlight | null> {
    const ids = this.highlightIdsByRoom.get(roomId) ?? []
    if (ids.length === 0) return null
    return this.highlights.get(ids[ids.length - 1]) ?? null
  }

  async listHighlights(
    roomId: string,
    opts: PaginationOpts & { episode_id?: string | null },
  ): Promise<PaginatedResult<RoomHighlight>> {
    const ids = this.highlightIdsByRoom.get(roomId) ?? []
    const items = ids
      .map((id) => this.highlights.get(id)!)
      .filter((highlight) => !opts.episode_id || highlight.episode_id === opts.episode_id)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  async saveLiveSnapshot(input: SaveRoomLiveSnapshotInput): Promise<RoomLiveSnapshot> {
    const existing = this.snapshots.get(input.room_id)
    const now = new Date()
    const snapshot: RoomLiveSnapshot = {
      id: existing?.id ?? cuid('rsnap'),
      room_id: input.room_id,
      episode_id: input.episode_id,
      scene_type: input.scene_type,
      current_beat: input.current_beat,
      live_hook: input.live_hook,
      unresolved_question: input.unresolved_question,
      recap_short: input.recap_short,
      active_cast: input.active_cast,
      last_highlight_text: input.last_highlight_text,
      energy: input.energy,
      tension: input.tension,
      message_cursor_id: input.message_cursor_id,
      version: (existing?.version ?? 0) + 1,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    this.snapshots.set(input.room_id, snapshot)
    return snapshot
  }

  async getLiveSnapshot(roomId: string): Promise<RoomLiveSnapshot | null> {
    return this.snapshots.get(roomId) ?? null
  }

  async listLiveSnapshots(roomIds: string[]): Promise<RoomLiveSnapshot[]> {
    return roomIds
      .map((roomId) => this.snapshots.get(roomId) ?? null)
      .filter((snapshot): snapshot is RoomLiveSnapshot => snapshot !== null)
  }
}

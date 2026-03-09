import type {
  Room,
  RoomCastRole,
  RoomEpisode,
  RoomEpisodeCast,
  RoomLiveCastItem,
  RoomLiveSnapshot,
  RoomProgram,
  RoomSceneType,
} from './types.js'

export interface UpdateRoomProgramInput {
  enabled?: boolean
  scene_type?: RoomSceneType
  pacing_preset?: string
  target_cast_min?: number
  target_cast_max?: number
  allow_wandering?: boolean
  discoverability_tags?: string[]
  discoverability_short_hook?: string | null
  discoverability_default_view?: string
}

export interface SaveRoomEpisodeStateInput {
  episode_id: string
  summary_text: string
  unresolved_question: string | null
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
  current_beat: string | null
  live_hook: string | null
  unresolved_question: string | null
  recap_short: string | null
  active_cast: RoomLiveCastItem[]
  last_highlight_text: string | null
  energy: number
  tension: number
  message_cursor_id: string | null
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
    allow_wandering: true,
    discoverability_tags: [],
    discoverability_short_hook: room.description || null,
    discoverability_default_view: 'live',
    created_at: now,
    updated_at: now,
  }
}

export class InMemoryRoomWatchabilityRepository implements RoomWatchabilityRepository {
  private readonly programs = new Map<string, RoomProgram>()
  private readonly episodes = new Map<string, RoomEpisode>()
  private readonly activeEpisodeByRoom = new Map<string, string>()
  private readonly castByEpisode = new Map<string, RoomEpisodeCast[]>()
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

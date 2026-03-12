import { NotFoundError, ValidationError } from '../lib/errors.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { RoomRepository, UpdateRoomMemberControlInput } from '../repos/room-repository.js'
import type {
  CreateRoomEpisodeBeatInput,
  RoomWatchabilityRepository,
  UpdateRoomProgramInput,
} from '../repos/room-watchability-repository.js'
import type {
  RoomCastRole,
  RoomControlStateReadModel,
  RoomCueType,
  RoomProgramEvent,
  RoomProgramReadModel,
} from '../repos/types.js'
import type { SseHub } from '../sse/hub.js'
import type { AgentPublicProjectionService } from './agent-public-projection-service.js'
import type { RoomProjector } from './room-projector.js'
import type { RoomProgramScorer } from './room-program-scorer.js'
import type { RoomProgramStateLoader } from './room-program-state-loader.js'

export interface ChatroomControlServiceDeps {
  roomRepo: RoomRepository
  watchabilityRepo: RoomWatchabilityRepository
  agentRepo: AgentRepository
  roomProjector: RoomProjector
  stateLoader: RoomProgramStateLoader
  scorer: RoomProgramScorer
  projectionService: AgentPublicProjectionService
  sseHub?: SseHub | null
}

type FastLaneHook = (input: { roomId: string; agentId: string }) => Promise<void>

export interface ManualRoomCueInput {
  cue_type: RoomCueType
  director_goal: string
  target_roles?: RoomCastRole[]
  anchor_message_id?: string | null
  callback_message_id?: string | null
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`)
  }
}

function assertInRange(value: number, field: string, min: number, max: number): void {
  if (value < min || value > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}`)
  }
}

function validateProgramPatch(
  room: { max_agents: number },
  current: {
    target_cast_min: number
    target_cast_max: number
    callback_window: number
    recap_every_turns: number
    max_consecutive_turns: number
    idle_cue_after_ms: number
  },
  patch: UpdateRoomProgramInput,
): void {
  const targetCastMin = patch.target_cast_min ?? current.target_cast_min
  const targetCastMax = patch.target_cast_max ?? current.target_cast_max
  const callbackWindow = patch.callback_window ?? current.callback_window
  const recapEveryTurns = patch.recap_every_turns ?? current.recap_every_turns
  const maxConsecutiveTurns = patch.max_consecutive_turns ?? current.max_consecutive_turns
  const idleCueAfterMs = patch.idle_cue_after_ms ?? current.idle_cue_after_ms

  assertPositiveInteger(targetCastMin, 'target_cast_min')
  assertPositiveInteger(targetCastMax, 'target_cast_max')
  assertPositiveInteger(callbackWindow, 'callback_window')
  assertPositiveInteger(recapEveryTurns, 'recap_every_turns')
  assertPositiveInteger(maxConsecutiveTurns, 'max_consecutive_turns')
  assertPositiveInteger(idleCueAfterMs, 'idle_cue_after_ms')

  if (targetCastMin > targetCastMax) {
    throw new ValidationError('target_cast_min cannot exceed target_cast_max')
  }
  if (targetCastMax > room.max_agents) {
    throw new ValidationError(`target_cast_max cannot exceed room.max_agents (${room.max_agents})`)
  }

  if (patch.wander_policy_json) {
    assertNonNegativeInteger(patch.wander_policy_json.entry_cooldown_ms, 'wander_policy.entry_cooldown_ms')
    assertPositiveInteger(patch.wander_policy_json.max_parallel_rooms, 'wander_policy.max_parallel_rooms')
    assertInRange(
      patch.wander_policy_json.min_discoverability_score,
      'wander_policy.min_discoverability_score',
      0,
      1,
    )
  }
}

function validateMemberControlPatch(patch: UpdateRoomMemberControlInput): void {
  if (patch.spotlight_weight !== undefined) {
    assertInRange(patch.spotlight_weight, 'spotlight_weight', 0.25, 3)
  }
}

function pickPromptHint(cueType: RoomCueType): string {
  switch (cueType) {
    case 'CALLBACK':
      return '这是 owner 手动抛的高层 cue，用自然 callback 的方式接住。'
    case 'SUMMARIZE':
      return '用一句短 recap 把刚才这拍收住。'
    case 'ASK':
      return '补一个能继续往前推的追问或追打。'
    case 'COOL_DOWN':
      return '轻一点，把现场从高张力里带出来。'
    case 'CLOSE':
      return '收一小段，不要宣布整个房间结束。'
    case 'ADVANCE':
    default:
      return '把这一拍稳稳往前推。'
  }
}

export class ChatroomControlService {
  private fastLaneHook: FastLaneHook | null = null

  constructor(private readonly deps: ChatroomControlServiceDeps) {}

  setFastLaneHook(hook: FastLaneHook | null): void {
    this.fastLaneHook = hook
  }

  async updateProgram(roomId: string, patch: UpdateRoomProgramInput): Promise<RoomProgramReadModel> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)

    const program =
      await this.deps.watchabilityRepo.getProgram(roomId)
      ?? await this.deps.watchabilityRepo.ensureProgram(room)
    validateProgramPatch(room, program, patch)
    const updated = await this.deps.watchabilityRepo.updateProgram(roomId, patch)
    if (!updated) throw new NotFoundError('RoomProgram', roomId)

    if (room.status === 'active') {
      await this.deps.roomProjector.refreshRoom(roomId).catch(() => null)
    }
    const snapshot = await this.deps.watchabilityRepo.getLiveSnapshot(roomId)
    const episode = await this.deps.watchabilityRepo.getActiveEpisode(roomId)
    this.broadcastControlStateUpdated(roomId, 'program_patch')
    return this.deps.roomProjector.toProgramReadModel(updated ?? program, snapshot, episode)
  }

  async updateMemberControl(
    roomId: string,
    agentId: string,
    patch: UpdateRoomMemberControlInput,
  ): Promise<Awaited<ReturnType<RoomRepository['updateMemberControl']>> & { name?: string }> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)
    validateMemberControlPatch(patch)
    const member = await this.deps.roomRepo.updateMemberControl(roomId, agentId, patch)
    if (!member) throw new NotFoundError('RoomMember', `${roomId}:${agentId}`)
    if (room.status === 'active') {
      await this.deps.roomProjector.refreshRoom(roomId).catch(() => null)
    }
    this.broadcastControlStateUpdated(roomId, 'member_control_patch')
    return {
      ...member,
      name: this.deps.agentRepo.findById(agentId)?.display_name ?? agentId,
    }
  }

  async createCue(roomId: string, input: ManualRoomCueInput): Promise<{
    beat: Awaited<ReturnType<RoomWatchabilityRepository['createEpisodeBeat']>>
    event: RoomProgramEvent
    selected_agent_id: string
  }> {
    let state = await this.deps.stateLoader.load(roomId)
    if (!state) throw new NotFoundError('Room', roomId)
    if (state.room.status !== 'active') {
      throw new ValidationError('Room must be active before a cue can be created')
    }
    if (!state.program.enabled) {
      throw new ValidationError('Room program is disabled')
    }
    if (!state.episode) {
      await this.deps.roomProjector.refreshRoom(roomId)
      state = await this.deps.stateLoader.load(roomId)
    }
    if (!state?.episode) {
      throw new ValidationError('Active room episode is not ready')
    }

    const targetRole = input.target_roles?.[0] ?? null
    const cue = {
      cue_type: input.cue_type,
      beat_type: cueTypeToBeatType(input.cue_type),
      director_goal: input.director_goal,
      prompt_hint: pickPromptHint(input.cue_type),
      target_role: targetRole,
      anchor_message_id: input.anchor_message_id ?? null,
      callback_message_id: input.callback_message_id ?? null,
      audit_json: {
        trigger: 'owner_manual_cue',
        target_roles: input.target_roles ?? [],
      },
    }

    const scored = this.deps.scorer.score({
      cast: state.cast,
      recentMessages: state.recentMessages,
      cue,
      scene_type: state.program.scene_type,
      maxConsecutiveTurns: state.program.max_consecutive_turns,
    })
    const selected = scored.find((candidate) => candidate.final_score > -5)
    if (!selected) {
      throw new ValidationError('No eligible speaker found for this cue')
    }

    const planned = await this.deps.watchabilityRepo.planProgramCue({
      room_id: roomId,
      episode_id: state.episode.id,
      ordinal: (state.latestBeat?.ordinal ?? 0) + 1,
      beat_type: cue.beat_type,
      cue_type: cue.cue_type,
      director_goal: cue.director_goal,
      prompt_hint: cue.prompt_hint,
      anchor_message_id: cue.anchor_message_id,
      callback_message_id: cue.callback_message_id,
      target_role: cue.target_role,
      selected_speaker_agent_id: selected.agent_id,
      beat_status: 'selected',
      beat_audit_json: {
        ...cue.audit_json,
        selected_agent_id: selected.agent_id,
      },
      event_status: 'PLANNED',
      idempotency_key: `manual-cue:${roomId}:${Date.now()}:${input.cue_type}`,
      event_payload_json: {
        manual: true,
        director_goal: input.director_goal,
      },
      selection_ledger: scored.slice(0, 6).map((candidate) => ({
        candidate_agent_id: candidate.agent_id,
        selected: candidate.agent_id === selected.agent_id,
        final_score: candidate.final_score,
        reasons_json: candidate.reasons_json,
      })),
    })

    if (planned.created_now) {
      this.deps.sseHub?.broadcastToRoom(roomId, {
        type: 'ROOM_BEAT_CHANGED',
        payload: {
          room_id: roomId,
          beat: {
            id: planned.beat.id,
            episode_id: planned.beat.episode_id,
            ordinal: planned.beat.ordinal,
            beat_type: planned.beat.beat_type,
            cue_type: planned.beat.cue_type,
            director_goal: planned.beat.director_goal,
            selected_speaker_agent_id: planned.beat.selected_speaker_agent_id,
            target_role: planned.beat.target_role,
            created_at: planned.beat.created_at.toISOString(),
          },
        },
      })
    }
    this.broadcastControlStateUpdated(roomId, 'manual_cue', {
      selected_agent_id: selected.agent_id,
    })
    await this.fastLaneHook?.({
      roomId,
      agentId: selected.agent_id,
    }).catch(() => null)

    return {
      beat: planned.beat,
      event: planned.event,
      selected_agent_id: selected.agent_id,
    }
  }

  async getControlState(roomId: string): Promise<RoomControlStateReadModel> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)
    const program =
      await this.deps.watchabilityRepo.getProgram(roomId)
      ?? await this.deps.watchabilityRepo.ensureProgram(room)
    const snapshot =
      await this.deps.watchabilityRepo.getLiveSnapshot(roomId)
      ?? (room.status === 'active' ? (await this.deps.roomProjector.refreshRoom(roomId))?.snapshot : null)
      ?? null
    const episode = await this.deps.watchabilityRepo.getActiveEpisode(roomId)
    const programView = this.deps.roomProjector.toProgramReadModel(program, snapshot, episode)
    const members = await this.deps.roomRepo.getMembers(roomId)
    const cast = await this.deps.stateLoader.load(roomId).then((state) => state?.cast ?? [])
    const projections = await this.deps.projectionService.getOrBuildMany(members.map((member) => member.member_id))
    const recentHighlights = await this.deps.watchabilityRepo.listHighlights(roomId, { limit: 6 })
    const recentEvents = await this.deps.watchabilityRepo.listRecentProgramEvents(roomId, 6)
    const recentSharedMemory = await this.deps.watchabilityRepo.listSharedMemories(roomId, 6)

    const programEvents = await Promise.all(recentEvents.map(async (event) => ({
      ...event,
      selection_reasons: await this.deps.watchabilityRepo.listSelectionLedger(event.id),
    })))

    const alerts = [
      room.status !== 'active' ? `room_status:${room.status}` : null,
      members.some((member) => member.suppressed_until && member.suppressed_until.getTime() > Date.now())
        ? 'members_suppressed'
        : null,
      !snapshot ? 'snapshot_missing' : null,
    ].filter((item): item is string => Boolean(item))

    return {
      room_id: room.id,
      room_status: room.status,
      program: programView,
      snapshot,
      cast,
      members: members.map((member) => ({
        ...member,
        name: this.deps.agentRepo.findById(member.member_id)?.display_name ?? member.member_id,
        projection: projections.get(member.member_id) ?? null,
      })),
      recent_highlights: recentHighlights.items,
      recent_program_events: programEvents,
      recent_shared_memory: recentSharedMemory,
      alerts,
    }
  }

  broadcastControlStateUpdated(roomId: string, reason: string, payload: Record<string, unknown> = {}): void {
    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_CONTROL_STATE_UPDATED',
      payload: {
        room_id: roomId,
        reason,
        emitted_at: new Date().toISOString(),
        ...payload,
      },
    })
  }
}

function cueTypeToBeatType(cueType: RoomCueType): CreateRoomEpisodeBeatInput['beat_type'] {
  switch (cueType) {
    case 'ASK':
      return 'HOOK'
    case 'CALLBACK':
      return 'CALLBACK'
    case 'SUMMARIZE':
      return 'RECAP'
    case 'COOL_DOWN':
      return 'COOL_DOWN'
    case 'CLOSE':
      return 'LANDING'
    case 'ADVANCE':
    default:
      return 'HOOK'
  }
}

import type {
  ChatMessage,
  Room,
  RoomCastMemberView,
  RoomLiveSnapshot,
  RoomMember,
  RoomWatchabilitySummary,
} from '../../repos/types.js'
import type { RoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import { hasNoRecommendTag, readRoomHotTopicMode } from '../hot-topic-policy-config.js'
import { sanitizeVisibleText } from './shared.js'
import type { ChatServiceContext } from './types.js'

export async function buildCastView(
  context: ChatServiceContext,
  roomId: string,
): Promise<RoomCastMemberView[]> {
  const members = await context.deps.roomRepo.getMembers(roomId)
  const casts = (await context.deps.roomWatchabilityRepo?.getCurrentCast(roomId)) ?? []
  return casts.map((entry) => ({
    agent_id: entry.agent_id,
    name: context.deps.agentRepo.findById(entry.agent_id)?.display_name ?? entry.agent_id,
    role: entry.role,
    chemistry_score: entry.chemistry_score,
    spotlight_weight: entry.spotlight_weight,
    last_spoke_at:
      members.find((member) => member.member_id === entry.agent_id)?.last_spoke_at ?? null,
    role_hint: members.find((member) => member.member_id === entry.agent_id)?.role_hint ?? null,
    wander_eligible:
      members.find((member) => member.member_id === entry.agent_id)?.wander_eligible ?? true,
    suppressed_until:
      members.find((member) => member.member_id === entry.agent_id)?.suppressed_until ?? null,
    member_spotlight_weight:
      members.find((member) => member.member_id === entry.agent_id)?.spotlight_weight ?? 1,
    projection: null,
  }))
}

export function buildWatchabilitySummary(
  context: ChatServiceContext,
  room: Room,
  snapshot: RoomLiveSnapshot | null,
  program: Awaited<ReturnType<RoomWatchabilityRepository['getProgram']>> | null,
): RoomWatchabilitySummary | null {
  if (context.roomProjector) {
    const summary = context.roomProjector.summarizeWatchability(room, snapshot)
    return {
      ...summary,
      hot_topic_mode: readRoomHotTopicMode(program?.director_policy_json),
      distribution_state: hasNoRecommendTag(program?.discoverability_tags)
        ? 'NO_RECOMMEND'
        : 'NORMAL',
      discoverability_tags: program?.discoverability_tags ?? [],
    }
  }

  return {
    scene_type: snapshot?.scene_type ?? 'FREE_CHAT',
    current_beat: snapshot?.current_beat ?? null,
    live_hook:
      snapshot?.live_hook ?? (room.description || `这间房正在展开一场新的 live 群聊。`),
    unresolved_question: snapshot?.unresolved_question ?? null,
    active_cast_preview:
      snapshot?.active_cast.slice(0, 3).map((entry) => ({
        agent_id: entry.agent_id,
        name: entry.name,
        role: entry.role,
      })) ?? [],
    last_highlight_text: snapshot?.last_highlight_text ?? null,
    energy: snapshot?.energy ?? 0,
    tension: snapshot?.tension ?? 0,
    continuity_summary: snapshot?.continuity_summary ?? null,
    canonization_note: snapshot?.canonization_note ?? null,
    cameo_hint: snapshot?.cameo_hint ?? null,
    snapshot_updated_at: snapshot?.updated_at ?? null,
    hot_topic_mode: readRoomHotTopicMode(program?.director_policy_json),
    distribution_state: hasNoRecommendTag(program?.discoverability_tags)
      ? 'NO_RECOMMEND'
      : 'NORMAL',
    discoverability_tags: program?.discoverability_tags ?? [],
  }
}

export async function enrichSnapshot(
  context: ChatServiceContext,
  snapshot: RoomLiveSnapshot | null,
  roomId: string,
): Promise<RoomLiveSnapshot | null> {
  if (!snapshot || !context.deps.roomWatchabilityRepo) return snapshot
  const [continuity, canonization, cameo] = await Promise.all([
    context.deps.roomWatchabilityRepo.getLatestSharedMemory(roomId, 'CONTINUITY'),
    context.deps.roomWatchabilityRepo.getLatestSharedMemory(roomId, 'CANONIZATION'),
    context.deps.roomWatchabilityRepo.getLatestSharedMemory(roomId, 'CAMEO'),
  ])
  return {
    ...snapshot,
    live_hook: sanitizeVisibleText(snapshot.live_hook),
    unresolved_question: sanitizeVisibleText(snapshot.unresolved_question) ?? null,
    recap_short: sanitizeVisibleText(snapshot.recap_short) ?? null,
    last_highlight_text: sanitizeVisibleText(snapshot.last_highlight_text) ?? null,
    continuity_summary:
      sanitizeVisibleText(continuity?.summary_text ?? snapshot.continuity_summary) ?? null,
    canonization_note:
      sanitizeVisibleText(canonization?.summary_text ?? snapshot.canonization_note) ?? null,
    cameo_hint: sanitizeVisibleText(cameo?.summary_text ?? snapshot.cameo_hint) ?? null,
  }
}

export async function projectRoom(context: ChatServiceContext, roomId: string) {
  if (!context.roomProjector) return null
  try {
    return await context.roomProjector.refreshRoom(roomId)
  } catch (err) {
    console.warn(`[ChatService] room projector failed for room=${roomId}:`, err)
    return null
  }
}

export async function projectRoomAfterMessage(
  context: ChatServiceContext,
  message: ChatMessage,
): Promise<void> {
  try {
    if (context.roomProgramProjector) {
      await context.roomProgramProjector.onMessageCreated(message)
      return
    }

    const projection = await projectRoom(context, message.room_id)
    broadcastProjectionUpdate(context, message.room_id, projection)
  } catch (err) {
    console.warn(`[ChatService] room program projector failed for room=${message.room_id}:`, err)
  }
}

export function emitRoomMemberJoined(
  context: ChatServiceContext,
  roomId: string,
  member: RoomMember,
): void {
  context.deps.sseHub?.broadcastToRoom(roomId, {
    type: 'ROOM_MEMBER_JOINED',
    payload: { room_id: roomId, member },
  })
}

export function emitRoomMemberLeft(
  context: ChatServiceContext,
  roomId: string,
  agentId: string,
): void {
  context.deps.sseHub?.broadcastToRoom(roomId, {
    type: 'ROOM_MEMBER_LEFT',
    payload: { room_id: roomId, agent_id: agentId },
  })
}

export async function refreshAndBroadcastRoom(
  context: ChatServiceContext,
  roomId: string,
): Promise<void> {
  const projection = await projectRoom(context, roomId)
  broadcastProjectionUpdate(context, roomId, projection)
}

export function broadcastProjectionUpdate(
  context: ChatServiceContext,
  roomId: string,
  projection: { snapshot: RoomLiveSnapshot; cast: RoomCastMemberView[] } | null,
): void {
  if (!projection) return
  broadcastSnapshotUpdate(context, roomId, projection.snapshot)
  broadcastCastUpdate(context, roomId, projection.snapshot.episode_id, projection.cast)
}

export function broadcastSnapshotUpdate(
  context: ChatServiceContext,
  roomId: string,
  snapshot: RoomLiveSnapshot | null,
): void {
  if (!snapshot) return
  context.deps.sseHub?.broadcastToRoom(roomId, {
    type: 'ROOM_LIVE_SNAPSHOT_UPDATED',
    payload: {
      room_id: roomId,
      episode_id: snapshot.episode_id,
      version: snapshot.version,
      snapshot: {
        current_beat: snapshot.current_beat,
        live_hook: snapshot.live_hook,
        unresolved_question: snapshot.unresolved_question,
        energy: snapshot.energy,
        tension: snapshot.tension,
        last_highlight_text: snapshot.last_highlight_text,
      },
    },
  })
}

export function broadcastCastUpdate(
  context: ChatServiceContext,
  roomId: string,
  episodeId: string | null,
  cast: RoomCastMemberView[],
): void {
  context.deps.sseHub?.broadcastToRoom(roomId, {
    type: 'ROOM_CAST_UPDATED',
    payload: {
      room_id: roomId,
      episode_id: episodeId,
      cast,
    },
  })
}

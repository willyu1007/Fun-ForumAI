import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { RoomHighlight } from '../repos/types.js'
import type { SseHub } from '../sse/hub.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { ForumWriteService } from './forum-write-service.js'

export interface ChatroomCanonizationServiceDeps {
  roomRepo: RoomRepository
  watchabilityRepo: RoomWatchabilityRepository
  chronicleService: AchievementChronicleService
  forumWriteService: ForumWriteService
  sseHub?: SseHub | null
}

function buildCanonizationSummary(input: {
  roomName: string
  episodeSummary: string
  highlightText: string | null
}): string {
  const parts = [
    `房间「${input.roomName}」刚刚沉淀出一段公共 canon。`,
    input.episodeSummary || '这拍的核心是台上关系和包袱都被重新对齐了。',
    input.highlightText ? `高光锚点：${input.highlightText}` : null,
  ].filter(Boolean)
  return parts.join(' ')
}

export class ChatroomCanonizationService {
  constructor(private readonly deps: ChatroomCanonizationServiceDeps) {}

  async considerHighlight(roomId: string, highlight: RoomHighlight): Promise<void> {
    if (highlight.score < 0.9) return
    await this.canonize(roomId, {
      episodeSummary: highlight.text,
      highlight,
      reason: 'highlight_threshold',
    })
  }

  async onEpisodeEnded(roomId: string): Promise<void> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) return

    const latestEnded = await this.deps.watchabilityRepo.endActiveEpisode(roomId)
    if (!latestEnded) return

    const highlights = await this.deps.watchabilityRepo.listHighlights(roomId, {
      limit: 3,
      episode_id: latestEnded.id,
    })

    await this.canonize(roomId, {
      episodeSummary: latestEnded.summary_text || highlights.items[0]?.text || room.description,
      highlight: highlights.items[0] ?? null,
      reason: 'episode_end',
    })
  }

  private async canonize(
    roomId: string,
    input: {
      episodeSummary: string
      highlight: RoomHighlight | null
      reason: string
    },
  ): Promise<void> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) return

    const summary = buildCanonizationSummary({
      roomName: room.name,
      episodeSummary: input.episodeSummary,
      highlightText: input.highlight?.text ?? null,
    })
    const latestCanon = await this.deps.watchabilityRepo.getLatestSharedMemory(roomId, 'CANONIZATION')
    if (latestCanon?.summary_text === summary) return

    await this.deps.watchabilityRepo.createSharedMemory({
      room_id: roomId,
      episode_id: input.highlight?.episode_id ?? null,
      memory_kind: 'CANONIZATION',
      summary_text: summary,
      tags: ['canonization', input.reason],
      source_highlight_id: input.highlight?.id ?? null,
      source_message_id: input.highlight?.source_message_id ?? null,
      score: input.highlight?.score ?? 0.8,
    })

    await this.deps.chronicleService.recordChronicle({
      agent_id: room.created_by_agent_id,
      visibility: 'PUBLIC',
      type: 'HIGHLIGHT',
      title: `聊天室 canon · ${room.name}`,
      summary,
      importance_score: input.highlight?.score ?? 0.82,
      evidence: [
        { kind: 'room', ref_id: room.id, summary: room.name },
        ...(input.highlight
          ? [{ kind: 'room_highlight', ref_id: input.highlight.id, summary: input.highlight.text }]
          : []),
      ],
      tags: ['chatroom', 'canonization'],
      dedup_key: `room-canon:${roomId}:${input.reason}:${input.highlight?.id ?? 'episode'}`,
    }).catch((error) => {
      console.error('[ChatroomCanonizationService] chronicle write failed:', error)
    })

    if (room.community_id) {
      await this.deps.forumWriteService.createPost({
        actor_agent_id: room.created_by_agent_id,
        run_id: `room-canon:${roomId}:${Date.now()}`,
        community_id: room.community_id,
        title: `${room.name} · 本场 canon 摘要`,
        body: summary,
        tags: ['chatroom', 'canonization'],
      }).catch((error) => {
        console.error('[ChatroomCanonizationService] forum canonization failed:', error)
      })
    }

    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_CONTROL_STATE_UPDATED',
      payload: {
        room_id: roomId,
        reason: 'canonization',
        emitted_at: new Date().toISOString(),
      },
    })
  }
}

import type {
  ChatMessage,
  CreateChatMessageInput,
  Room,
} from '../../repos/types.js'
import { NotFoundError, ValidationError } from '../../lib/errors.js'
import { config } from '../../lib/config.js'
import {
  projectRoomAfterMessage,
} from './projection-broadcast.js'
import { sanitizeVisibleText } from './shared.js'
import type { ChatServiceContext } from './types.js'

async function buildRoomTopicContext(
  context: ChatServiceContext,
  room: Room,
): Promise<{
  topic_context_text: string
  topic_context_tags: string[]
}> {
  const recentMessages = await context.deps.messageRepo.getLatestMessages(room.id, 5)
  const snapshot = (await context.deps.roomWatchabilityRepo?.getLiveSnapshot(room.id)) ?? null
  const program = (await context.deps.roomWatchabilityRepo?.getProgram(room.id)) ?? null
  return {
    topic_context_text: [
      room.description,
      snapshot?.live_hook ?? '',
      snapshot?.unresolved_question ?? '',
      ...recentMessages.map((message) => message.body),
    ]
      .filter(Boolean)
      .join('\n\n'),
    topic_context_tags: program?.discoverability_tags ?? [],
  }
}

export function enrichMessage(
  context: ChatServiceContext,
  message: ChatMessage,
  opts: { fallbackToRawBody?: boolean } = {},
): ChatMessage | null {
  if (message.visibility === 'QUARANTINE' || message.state === 'REJECTED') {
    return null
  }
  const body = sanitizeVisibleText(message.body)
  const displayName =
    (context.deps.agentRepo as Partial<typeof context.deps.agentRepo>).findById?.(message.author_id)
      ?.display_name ?? null

  if (!body && !opts.fallbackToRawBody) return null

  return {
    ...message,
    body: body ?? message.body,
    author_display_name: displayName,
  }
}

export async function sendMessage(
  context: ChatServiceContext,
  input: CreateChatMessageInput,
): Promise<ChatMessage> {
  const room = await context.deps.roomRepo.findById(input.room_id)
  if (!room) throw new NotFoundError('Room', input.room_id)
  if (room.status === 'archived') {
    throw new ValidationError('Cannot send messages to an archived room')
  }

  if (!(await context.deps.roomRepo.isMember(input.room_id, input.author_id))) {
    throw new ValidationError('Author is not a member of this room')
  }

  const topicContext = context.deps.policyGatewayService
    ? await buildRoomTopicContext(context, room)
    : null
  const policyDecision = context.deps.policyGatewayService
    ? await context.deps.policyGatewayService.evaluate({
        channel: 'chat_room',
        text: input.body,
        topic_context_text: topicContext?.topic_context_text,
        topic_context_tags: topicContext?.topic_context_tags,
        author_agent_id: input.author_id,
        community_id: room.community_id,
        target_type: 'message',
        room_id: input.room_id,
        scene: 'chat_room',
        sampling_metrics: {
          post_comment_count: 0,
          room_message_count_hour: await context.deps.messageRepo.countByRoomThisHour(
            input.room_id,
          ),
          report_count_24h: 0,
        },
      })
    : null
  if (policyDecision) {
    context.deps.policyGatewayService?.assertAllowed(policyDecision)
  }

  const created = await context.deps.messageRepo.create({
    ...input,
    body: policyDecision?.final_text ?? input.body,
    visibility:
      policyDecision?.visibility_override ??
      policyDecision?.moderation.visibility ??
      'PUBLIC',
    state:
      policyDecision?.state_override ??
      policyDecision?.moderation.state ??
      'APPROVED',
    moderation_metadata: policyDecision?.metadata ?? input.moderation_metadata ?? null,
  })
  const enriched = enrichMessage(context, created, { fallbackToRawBody: true })

  if (policyDecision) {
    await context.deps.policyGatewayService?.finalizeRecordedOutcomeTarget(policyDecision, {
      target_id: created.id,
      room_id: input.room_id,
      message_id: created.id,
    })
  }

  await context.deps.roomRepo.updateLastMessageAt(input.room_id, created.created_at)
  await context.deps.roomRepo.recordMemberMessage(
    input.room_id,
    input.author_id,
    created.created_at,
  )

  context.deps.eventRepo.create({
    event_type: 'MESSAGE_CREATED',
    plane: 'DATA',
    schema_version: 'v1',
    room_id: input.room_id,
    actor_type: 'agent',
    actor_id: input.author_id,
    correlation_id: `room:${input.room_id}`,
    idempotency_key: `message:${created.id}`,
    payload_json: {
      message_id: created.id,
      room_id: input.room_id,
      author_agent_id: input.author_id,
      message_kind: created.message_kind,
    },
  })

  if (room.status === 'cooling') {
    await context.deps.roomRepo.updateStatus(room.id, 'active')
    context.deps.sseHub?.broadcastToRoom(input.room_id, {
      type: 'ROOM_STATUS_CHANGED',
      payload: { room_id: room.id, status: 'active' },
    })
  }

  if (enriched) {
    context.deps.sseHub?.broadcastToRoom(input.room_id, {
      type: 'MESSAGE_CREATED',
      payload: { room_id: input.room_id, message: enriched },
    })
  }

  if (context.deps.nurtureOrchestrator) {
    context.deps.nurtureOrchestrator
      .onContentProduced(input.author_id, 'chat_message', 1, {
        dedup_key: `message:${created.id}`,
      })
      .catch((err) => {
        console.error('[ChatService] nurture onContentProduced failed:', err)
      })
  } else {
    context.deps.xpService?.awardXP(input.author_id, 'chat_message', 1).catch((err) => {
      console.error('[ChatService] chat_message XP award failed:', err)
    })
  }

  if (config.features.publicObservationMemory && context.deps.publicObservationService) {
    context.deps.publicObservationService
      .onRoomMessage({
        roomId: input.room_id,
        messageId: created.id,
        authorAgentId: input.author_id,
      })
      .catch((err) => {
        console.error('[ChatService] publicObservation onRoomMessage failed:', err)
      })
  }

  if (context.deps.relationService) {
    context.deps.relationService.onRoomMessage(input.room_id, created.id, input.author_id).catch(
      (err) => {
        console.error('[ChatService] relationService onRoomMessage failed:', err)
      },
    )
  }

  void projectRoomAfterMessage(context, created)

  return enriched ?? created
}

import type {
  PrivateSession,
  PrivateMessage,
  CreatePrivateSessionInput,
  CreatePrivateMessageInput,
  PaginatedResult,
  PaginationOpts,
  PrivateSessionStatus,
  SessionInitiator,
  DigestStatus,
  PrivateMessageRuntimeStatus,
} from './types.js'

export interface UpdatePrivateMessagePatch {
  content?: string
  delivery_status?: CreatePrivateMessageInput['delivery_status']
  moderation_metadata?: CreatePrivateMessageInput['moderation_metadata']
  runtime_status?: PrivateMessageRuntimeStatus
  runtime_error_code?: string | null
}

export interface PrivateChannelRepository {
  createSession(input: CreatePrivateSessionInput): Promise<PrivateSession>
  findSessionById(id: string): Promise<PrivateSession | null>
  listSessions(
    agentId: string,
    opts: PaginationOpts & { status?: PrivateSessionStatus; initiator?: SessionInitiator },
  ): Promise<PaginatedResult<PrivateSession>>
  updateSessionStatus(
    id: string,
    status: PrivateSessionStatus,
    endedAt?: Date,
  ): Promise<PrivateSession | null>
  updateDigestStatus(
    id: string,
    digestStatus: DigestStatus,
  ): Promise<PrivateSession | null>
  findTimedOutSessions(timeoutMs: number): Promise<PrivateSession[]>

  createMessage(input: CreatePrivateMessageInput): Promise<PrivateMessage>
  updateMessage(id: string, patch: UpdatePrivateMessagePatch): Promise<PrivateMessage | null>
  findPendingAgentReply(sessionId: string): Promise<PrivateMessage | null>
  listPendingAgentRepliesOlderThan(cutoff: Date, limit: number): Promise<PrivateMessage[]>
  deleteMessage(id: string): Promise<boolean>
  findLatestSessionsByAgentIds(
    agentIds: string[],
    humanUserId: string,
  ): Promise<Map<string, PrivateSession>>
  findLatestMessagesBySessionIds(
    sessionIds: string[],
    limitPerSession: number,
  ): Promise<Map<string, PrivateMessage[]>>
  listMessages(
    sessionId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<PrivateMessage>>
  countMessages(sessionId: string): Promise<number>
}

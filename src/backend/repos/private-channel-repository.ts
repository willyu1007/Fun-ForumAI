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
} from './types.js'

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
  listMessages(
    sessionId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<PrivateMessage>>
  countMessages(sessionId: string): Promise<number>
}

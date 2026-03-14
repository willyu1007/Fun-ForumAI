import { NotFoundError, ValidationError } from '../lib/errors.js'
import type {
  CommentRepository,
  MessageRepository,
  PostRepository,
  RiskGovernanceRepository,
  RoomRepository,
} from '../repos/index.js'
import type { ChatService } from './chat-service.js'
import type { ChatroomControlService } from './chatroom-control-service.js'

type HotTopicDistributionState = 'NORMAL' | 'NO_RECOMMEND' | 'BLOCKED'
type HotTopicRestrictionState = 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'BLOCKED'
type HotTopicTargetType = 'post' | 'room'
type HotTopicAlertSeverity = 'low' | 'medium' | 'high'

export interface HotTopicDashboardItem {
  target_type: HotTopicTargetType
  target_id: string
  title: string
  community_id: string | null
  topic_domain: string
  hot_score: number
  drift_risk_score: number
  report_count_24h: number
  distribution_state: HotTopicDistributionState
  restriction_state: HotTopicRestrictionState
  sampled_review_required: boolean
  linked_case_id: string | null
  latest_event_at: string | null
}

export interface HotTopicAlert {
  severity: HotTopicAlertSeverity
  reason: string
  item: HotTopicDashboardItem
}

export interface HotTopicDashboardResult {
  generated_at: string
  items: HotTopicDashboardItem[]
}

export interface HotTopicAlertsResult {
  generated_at: string
  items: HotTopicAlert[]
}

interface HotTopicOpsServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  messageRepo: MessageRepository
  roomRepo: RoomRepository
  riskRepo: RiskGovernanceRepository
  chatService: ChatService
  chatroomControlService: ChatroomControlService
}

interface HotTopicSignalSnapshot {
  topic_domain: string
  drift_risk_score: number
  sampled_review_required: boolean
  distribution_state: HotTopicDistributionState | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeDistributionState(value: unknown): HotTopicDistributionState | null {
  return value === 'NORMAL' || value === 'NO_RECOMMEND' || value === 'BLOCKED'
    ? value
    : null
}

function readTopicSignals(value: unknown): HotTopicSignalSnapshot | null {
  if (!isRecord(value)) return null
  return {
    topic_domain: typeof value.topic_domain === 'string' ? value.topic_domain : 'GENERAL',
    drift_risk_score: typeof value.drift_risk_score === 'number' ? value.drift_risk_score : 0,
    sampled_review_required: value.sampled_review_required === true,
    distribution_state: normalizeDistributionState(value.distribution_state),
  }
}

function readLatestTopicSignals(payload: unknown): HotTopicSignalSnapshot | null {
  if (!isRecord(payload)) return null
  const topicSignals = readTopicSignals(payload.topic_signals)
  if (!topicSignals) return null
  return {
    ...topicSignals,
    distribution_state:
      normalizeDistributionState(payload.distribution_state)
      ?? topicSignals.distribution_state,
  }
}

function byCreatedDesc<T extends { created_at: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
}

function severityRank(value: HotTopicAlertSeverity): number {
  if (value === 'high') return 3
  if (value === 'medium') return 2
  return 1
}

export class HotTopicOpsService {
  constructor(private readonly deps: HotTopicOpsServiceDeps) {}

  private async listHotTopicCases() {
    const cases = await this.deps.riskRepo.listCases({
      queue: 'HOT_TOPIC',
      limit: 200,
      cursor: undefined,
    })

    const roomCaseIds = new Map<string, string>()
    const postCaseIds = new Map<string, string>()

    for (const item of cases.items) {
      const targets = await this.deps.riskRepo.listCaseTargets(item.id)
      for (const target of targets) {
        if (target.target_type === 'post') {
          postCaseIds.set(target.target_id, item.id)
        }
        if (target.room_id) {
          roomCaseIds.set(target.room_id, item.id)
        }
      }
    }

    return { roomCaseIds, postCaseIds }
  }

  private async countRecentReportsByPost(postId: string): Promise<number> {
    const tickets = await this.deps.riskRepo.listComplaintTickets({
      limit: 500,
      cursor: undefined,
    })
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return tickets.items.filter((ticket) =>
      ticket.target_type === 'post'
      && ticket.target_id === postId
      && ticket.created_at.getTime() >= cutoff).length
  }

  private async countRecentReportsByRoom(roomId: string): Promise<number> {
    const [messages, tickets] = await Promise.all([
      this.deps.messageRepo.findByRoom(roomId, { limit: 500, cursor: undefined }),
      this.deps.riskRepo.listComplaintTickets({
        limit: 500,
        cursor: undefined,
      }),
    ])
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const messageIds = new Set(messages.items.map((message) => message.id))
    return tickets.items.filter((ticket) =>
      ticket.target_type === 'message'
      && messageIds.has(ticket.target_id)
      && ticket.created_at.getTime() >= cutoff).length
  }

  private derivePostRestrictionState(input: {
    visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
    state: 'PENDING' | 'APPROVED' | 'REJECTED'
    distribution_state: HotTopicDistributionState
  }): HotTopicRestrictionState {
    if (
      input.distribution_state === 'BLOCKED'
      || input.visibility === 'QUARANTINE'
      || input.state === 'REJECTED'
    ) {
      return 'BLOCKED'
    }
    if (
      input.distribution_state === 'NO_RECOMMEND'
      || input.visibility === 'GRAY'
      || input.state === 'PENDING'
    ) {
      return 'MANUAL_REVIEW_ONLY'
    }
    return 'NORMAL'
  }

  private deriveRoomStates(input: {
    hot_topic_mode: string | null | undefined
    discoverability_tags: string[] | null | undefined
    signal_distribution_state?: HotTopicDistributionState | null
  }): {
    distribution_state: HotTopicDistributionState
    restriction_state: HotTopicRestrictionState
  } {
    const noRecommend = (input.discoverability_tags ?? []).some((tag) => tag.trim().toLowerCase() === 'no_recommend')
    if (input.signal_distribution_state === 'BLOCKED') {
      return {
        distribution_state: 'BLOCKED',
        restriction_state: 'BLOCKED',
      }
    }
    if (input.signal_distribution_state === 'NO_RECOMMEND') {
      return {
        distribution_state: 'NO_RECOMMEND',
        restriction_state: input.hot_topic_mode === 'DISABLED'
          ? 'BLOCKED'
          : 'MANUAL_REVIEW_ONLY',
      }
    }
    if (input.hot_topic_mode === 'DISABLED') {
      return {
        distribution_state: 'BLOCKED',
        restriction_state: 'BLOCKED',
      }
    }
    if (input.hot_topic_mode === 'MANUAL_REVIEW_ONLY' || noRecommend) {
      return {
        distribution_state: 'NO_RECOMMEND',
        restriction_state: 'MANUAL_REVIEW_ONLY',
      }
    }
    return {
      distribution_state: 'NORMAL',
      restriction_state: 'NORMAL',
    }
  }

  private deriveAlertSeverity(item: HotTopicDashboardItem): HotTopicAlertSeverity {
    if (item.distribution_state === 'BLOCKED' || item.drift_risk_score >= 0.82) {
      return 'high'
    }
    if (item.distribution_state === 'NO_RECOMMEND' || item.sampled_review_required) {
      return 'medium'
    }
    return 'low'
  }

  private deriveAlertReason(item: HotTopicDashboardItem): string {
    if (item.distribution_state === 'BLOCKED') {
      return 'distribution_blocked'
    }
    if (item.drift_risk_score >= 0.82) {
      return 'drift_risk_high'
    }
    if (item.distribution_state === 'NO_RECOMMEND') {
      return 'distribution_no_recommend'
    }
    if (item.sampled_review_required) {
      return 'sampled_review_required'
    }
    return 'watch'
  }

  async getDashboard(): Promise<HotTopicDashboardResult> {
    const [riskEvents, roomsPage, caseMaps] = await Promise.all([
      this.deps.riskRepo.listRiskEvents({ limit: 400, cursor: undefined }),
      this.deps.roomRepo.list({ limit: 200, cursor: undefined }),
      this.listHotTopicCases(),
    ])

    const allEvents = byCreatedDesc(riskEvents.items)
    const latestPostEventById = new Map<string, typeof allEvents[number]>()
    const latestRoomEventById = new Map<string, typeof allEvents[number]>()

    for (const event of allEvents) {
      if (event.target_type === 'post' && event.target_id && !latestPostEventById.has(event.target_id)) {
        const topicSignals = readLatestTopicSignals(event.payload)
        if (topicSignals || event.case_id) {
          latestPostEventById.set(event.target_id, event)
        }
      }
      if (event.room_id && !latestRoomEventById.has(event.room_id)) {
        const topicSignals = readLatestTopicSignals(event.payload)
        if (topicSignals || event.case_id) {
          latestRoomEventById.set(event.room_id, event)
        }
      }
    }

    const candidatePostIds = new Set([
      ...latestPostEventById.keys(),
      ...caseMaps.postCaseIds.keys(),
    ])

    const postItems = await Promise.all(
      Array.from(candidatePostIds).map(async (postId) => {
        const post = await this.deps.postRepo.findById(postId)
        if (!post) return null

        const latestEvent = latestPostEventById.get(postId) ?? null
        const metadata = isRecord(post.moderation_metadata) ? post.moderation_metadata : null
        const latestSignals = readLatestTopicSignals(latestEvent?.payload ?? null)
        const storedSignals = readTopicSignals(metadata?.topic_signals)
        const distribution_state =
          normalizeDistributionState(metadata?.distribution_state)
          ?? latestSignals?.distribution_state
          ?? storedSignals?.distribution_state
          ?? 'NORMAL'
        const report_count_24h = await this.countRecentReportsByPost(post.id)
        const approved_comment_count_last24h = (await this.deps.commentRepo.findByPostsSince(
          [post.id],
          new Date(Date.now() - 24 * 60 * 60 * 1000),
        )).filter((comment) => comment.state === 'APPROVED').length
        const hot_score = approved_comment_count_last24h + report_count_24h * 5
        const sampled_review_required =
          latestSignals?.sampled_review_required
          ?? storedSignals?.sampled_review_required
          ?? (hot_score >= 20 || report_count_24h >= 3)

        return {
          target_type: 'post' as const,
          target_id: post.id,
          title: post.title,
          community_id: post.community_id,
          topic_domain: latestSignals?.topic_domain ?? storedSignals?.topic_domain ?? 'GENERAL',
          hot_score,
          drift_risk_score: latestSignals?.drift_risk_score ?? storedSignals?.drift_risk_score ?? 0,
          report_count_24h,
          distribution_state,
          restriction_state: this.derivePostRestrictionState({
            visibility: post.visibility,
            state: post.state,
            distribution_state,
          }),
          sampled_review_required,
          linked_case_id: latestEvent?.case_id ?? caseMaps.postCaseIds.get(post.id) ?? null,
          latest_event_at: latestEvent?.created_at.toISOString() ?? null,
        } satisfies HotTopicDashboardItem
      }),
    )

    const roomItems = await Promise.all(
      roomsPage.items.map(async (room) => {
        const [program, report_count_24h] = await Promise.all([
          this.deps.chatService.getRoomProgram(room.id),
          this.countRecentReportsByRoom(room.id),
        ])
        const latestEvent = latestRoomEventById.get(room.id) ?? null
        const latestSignals = readLatestTopicSignals(latestEvent?.payload ?? null)
        const { distribution_state, restriction_state } = this.deriveRoomStates({
          hot_topic_mode: typeof program.director_policy?.hot_topic_mode === 'string'
            ? program.director_policy.hot_topic_mode
            : null,
          discoverability_tags: program.discoverability?.tags ?? [],
          signal_distribution_state: latestSignals?.distribution_state ?? null,
        })
        const hot_score = await this.deps.messageRepo.countByRoomThisHour(room.id) + report_count_24h * 5
        const sampled_review_required =
          latestSignals?.sampled_review_required
          ?? (hot_score >= 20 || report_count_24h >= 3)

        const shouldInclude = Boolean(
          latestSignals
          || distribution_state !== 'NORMAL'
          || sampled_review_required
          || hot_score > 0
          || caseMaps.roomCaseIds.has(room.id),
        )
        if (!shouldInclude) return null

        return {
          target_type: 'room' as const,
          target_id: room.id,
          title: room.name,
          community_id: room.community_id,
          topic_domain: latestSignals?.topic_domain ?? 'GENERAL',
          hot_score,
          drift_risk_score: latestSignals?.drift_risk_score ?? 0,
          report_count_24h,
          distribution_state,
          restriction_state,
          sampled_review_required,
          linked_case_id: latestEvent?.case_id ?? caseMaps.roomCaseIds.get(room.id) ?? null,
          latest_event_at: latestEvent?.created_at.toISOString() ?? null,
        } satisfies HotTopicDashboardItem
      }),
    )

    const items = [...postItems, ...roomItems]
      .flatMap((item) => (item ? [item] : []))
      .sort((a, b) =>
        b.hot_score - a.hot_score
        || b.drift_risk_score - a.drift_risk_score
        || (Date.parse(b.latest_event_at ?? '1970-01-01T00:00:00.000Z')
          - Date.parse(a.latest_event_at ?? '1970-01-01T00:00:00.000Z')))

    return {
      generated_at: new Date().toISOString(),
      items,
    }
  }

  async getAlerts(): Promise<HotTopicAlertsResult> {
    const dashboard = await this.getDashboard()
    const items = dashboard.items
      .map((item) => ({
        severity: this.deriveAlertSeverity(item),
        reason: this.deriveAlertReason(item),
        item,
      }))
      .filter((alert) => alert.severity !== 'low')
      .sort((a, b) =>
        severityRank(b.severity) - severityRank(a.severity)
        || b.item.hot_score - a.item.hot_score
        || b.item.drift_risk_score - a.item.drift_risk_score)

    return {
      generated_at: dashboard.generated_at,
      items,
    }
  }

  async updatePostDistribution(input: {
    post_id: string
    distribution_state: 'NORMAL' | 'NO_RECOMMEND'
    actor_user_id: string
    reason?: string | null
  }): Promise<HotTopicDashboardItem> {
    const post = await this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    const existingMetadata = isRecord(post.moderation_metadata) ? post.moderation_metadata : {}
    const existingSignals = isRecord(existingMetadata.topic_signals) ? existingMetadata.topic_signals : {}
    const nextMetadata = {
      ...existingMetadata,
      distribution_state: input.distribution_state,
      topic_signals: {
        ...existingSignals,
        distribution_state: input.distribution_state,
        enforcement_reason: input.reason ?? 'admin_hot_topic_distribution_override',
      },
      admin_distribution_override: {
        state: input.distribution_state,
        actor_user_id: input.actor_user_id,
        reason: input.reason ?? null,
        updated_at: new Date().toISOString(),
      },
    }

    await this.deps.postRepo.updateModerationMetadata(post.id, nextMetadata)
    await this.deps.riskRepo.createGovernanceActionLog({
      action: 'admin_hot_topic_distribution_override',
      target_type: 'post',
      target_id: post.id,
      actor_user_id: input.actor_user_id,
      reason: input.reason ?? null,
      result: {
        distribution_state: input.distribution_state,
      },
    })

    const [riskEvents, caseMaps, report_count_24h, recentComments] = await Promise.all([
      this.deps.riskRepo.listRiskEvents({ limit: 400, cursor: undefined }),
      this.listHotTopicCases(),
      this.countRecentReportsByPost(post.id),
      this.deps.commentRepo.findByPostsSince(
        [post.id],
        new Date(Date.now() - 24 * 60 * 60 * 1000),
      ),
    ])
    const latestEvent = byCreatedDesc(riskEvents.items).find((event) =>
      event.target_type === 'post'
      && event.target_id === post.id
      && (readLatestTopicSignals(event.payload) || event.case_id)) ?? null
    const latestSignals = readLatestTopicSignals(latestEvent?.payload ?? null)
    const storedSignals = readTopicSignals(nextMetadata.topic_signals)
    const distribution_state =
      normalizeDistributionState(nextMetadata.distribution_state)
      ?? latestSignals?.distribution_state
      ?? storedSignals?.distribution_state
      ?? 'NORMAL'
    const approved_comment_count_last24h = recentComments.filter((comment) => comment.state === 'APPROVED').length
    const hot_score = approved_comment_count_last24h + report_count_24h * 5
    const sampled_review_required =
      latestSignals?.sampled_review_required
      ?? storedSignals?.sampled_review_required
      ?? (hot_score >= 20 || report_count_24h >= 3)

    return {
      target_type: 'post',
      target_id: post.id,
      title: post.title,
      community_id: post.community_id,
      topic_domain: latestSignals?.topic_domain ?? storedSignals?.topic_domain ?? 'GENERAL',
      hot_score,
      drift_risk_score: latestSignals?.drift_risk_score ?? storedSignals?.drift_risk_score ?? 0,
      report_count_24h,
      distribution_state,
      restriction_state: this.derivePostRestrictionState({
        visibility: post.visibility,
        state: post.state,
        distribution_state,
      }),
      sampled_review_required,
      linked_case_id: latestEvent?.case_id ?? caseMaps.postCaseIds.get(post.id) ?? null,
      latest_event_at: latestEvent?.created_at.toISOString() ?? null,
    }
  }

  async updateRoomControl(input: {
    room_id: string
    actor_user_id: string
    hot_topic_mode?: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
    distribution_state?: HotTopicDistributionState
    reason?: string | null
  }): Promise<HotTopicDashboardItem> {
    if (!input.hot_topic_mode && !input.distribution_state) {
      throw new ValidationError('hot_topic_mode or distribution_state is required')
    }

    const room = await this.deps.roomRepo.findById(input.room_id)
    if (!room) throw new NotFoundError('Room', input.room_id)

    const currentProgram = await this.deps.chatService.getRoomProgram(input.room_id)
    const currentTags = currentProgram.discoverability?.tags ?? []
    const nextTags = input.distribution_state === 'NO_RECOMMEND'
      ? Array.from(new Set([...currentTags, 'no_recommend']))
      : input.distribution_state === 'NORMAL'
        ? currentTags.filter((tag) => tag.trim().toLowerCase() !== 'no_recommend')
        : currentTags
    const resolvedHotTopicMode = input.hot_topic_mode
      ?? (input.distribution_state === 'BLOCKED'
        ? 'DISABLED'
        : typeof currentProgram.director_policy?.hot_topic_mode === 'string'
          ? currentProgram.director_policy.hot_topic_mode as 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
          : 'NORMAL')

    await this.deps.chatroomControlService.updateProgram(input.room_id, {
      director_policy_json: {
        ...(currentProgram.director_policy ?? {}),
        hot_topic_mode: resolvedHotTopicMode,
      },
      discoverability_tags: nextTags,
    })
    await this.deps.riskRepo.createGovernanceActionLog({
      action: 'admin_hot_topic_room_control',
      target_type: 'room',
      target_id: input.room_id,
      actor_user_id: input.actor_user_id,
      reason: input.reason ?? null,
      result: {
        hot_topic_mode: resolvedHotTopicMode,
        distribution_state: input.distribution_state ?? null,
        discoverability_tags: nextTags,
      },
    })

    const [riskEvents, caseMaps, updatedProgram, report_count_24h, room_message_count_hour] = await Promise.all([
      this.deps.riskRepo.listRiskEvents({ limit: 400, cursor: undefined }),
      this.listHotTopicCases(),
      this.deps.chatService.getRoomProgram(input.room_id),
      this.countRecentReportsByRoom(input.room_id),
      this.deps.messageRepo.countByRoomThisHour(input.room_id),
    ])
    const latestEvent = byCreatedDesc(riskEvents.items).find((event) =>
      event.room_id === room.id
      && (readLatestTopicSignals(event.payload) || event.case_id)) ?? null
    const latestSignals = readLatestTopicSignals(latestEvent?.payload ?? null)
    const { distribution_state, restriction_state } = this.deriveRoomStates({
      hot_topic_mode: typeof updatedProgram.director_policy?.hot_topic_mode === 'string'
        ? updatedProgram.director_policy.hot_topic_mode
        : null,
      discoverability_tags: updatedProgram.discoverability?.tags ?? [],
      signal_distribution_state: latestSignals?.distribution_state ?? null,
    })
    const hot_score = room_message_count_hour + report_count_24h * 5
    const sampled_review_required =
      latestSignals?.sampled_review_required
      ?? (hot_score >= 20 || report_count_24h >= 3)

    return {
      target_type: 'room',
      target_id: room.id,
      title: room.name,
      community_id: room.community_id,
      topic_domain: latestSignals?.topic_domain ?? 'GENERAL',
      hot_score,
      drift_risk_score: latestSignals?.drift_risk_score ?? 0,
      report_count_24h,
      distribution_state,
      restriction_state,
      sampled_review_required,
      linked_case_id: latestEvent?.case_id ?? caseMaps.roomCaseIds.get(room.id) ?? null,
      latest_event_at: latestEvent?.created_at.toISOString() ?? null,
    }
  }
}

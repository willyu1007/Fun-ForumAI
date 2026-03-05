import type {
  PostRepository,
  HumanVoteRepository,
  AgentRepository,
  AudienceMessage,
  EventRepository,
  AftershowArtifactRepository,
  NotificationRepository,
  AftershowArtifact,
  AftershowCallout,
} from '../repos/index.js'
import type { AftershowRunRepository } from '../repos/aftershow-run-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { AudienceRepository } from '../repos/audience-repository.js'
import { ForbiddenError, NotFoundError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import { resolveStageSpecFromRules } from '../stage/index.js'

const MAX_CALLOUTS_PER_AFTERSHOW = 10
const MAX_UNIQUE_USERS_NOTIFIED_PER_AFTERSHOW = 8
const MAX_NOTIFICATIONS_PER_USER_PER_DAY = 20
const MAX_NOTIFICATIONS_PER_POST_PER_HOUR = 20
const MAX_AFTERSHOW_PUBLISH_PER_POST_PER_HOUR = 1
const PER_USER_PER_POST_NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000

export interface AftershowServiceDeps {
  postRepo: PostRepository
  humanVoteRepo: HumanVoteRepository
  audienceRepo: AudienceRepository
  agentRepo: AgentRepository
  communityRepo: CommunityRepository
  runRepo: AftershowRunRepository
  artifactRepo: AftershowArtifactRepository
  eventRepo: EventRepository
  notificationRepo?: NotificationRepository | null
}

function toStartOfDay(now: Date): Date {
  const next = new Date(now)
  next.setHours(0, 0, 0, 0)
  return next
}

export class AftershowService {
  constructor(private readonly deps: AftershowServiceDeps) {}

  private buildAudienceSummary(messages: AudienceMessage[]): string {
    const uniqueUsers = new Set(messages.map((m) => m.author_user_id)).size
    const totalChars = messages.reduce((sum, m) => sum + m.body.length, 0)
    const avgLen = messages.length > 0 ? Math.round(totalChars / messages.length) : 0
    return [
      `Audience summary window collected ${messages.length} messages from ${uniqueUsers} users.`,
      `Average message length is ${avgLen} characters.`,
      'Raw audience text is intentionally excluded from aftershow context; downstream must consume summary only.',
    ].join(' ')
  }

  private buildAftershowContent(input: {
    postTitle: string
    messages: AudienceMessage[]
    summaryText: string
  }): Record<string, unknown> {
    const latestHighlights = input.messages
      .slice(-5)
      .map((item) => ({
        audience_message_id: item.id,
        user_id: item.author_user_id,
        excerpt: item.body.slice(0, 160),
      }))

    return {
      title: `Aftershow · ${input.postTitle}`,
      summary: input.summaryText,
      highlights: latestHighlights,
      generated_at: new Date().toISOString(),
    }
  }

  private async emitRuntimeEvent(input: {
    event_type: string
    community_id: string
    post_id: string
    cause_event_id?: string | null
    correlation_id: string
    payload_json: Record<string, unknown>
  }): Promise<void> {
    this.deps.eventRepo.create({
      event_type: input.event_type,
      plane: 'RUNTIME',
      schema_version: 'v1',
      community_id: input.community_id,
      post_id: input.post_id,
      actor_type: 'system',
      actor_id: 'aftershow-runtime',
      cause_event_id: input.cause_event_id ?? null,
      correlation_id: input.correlation_id,
      payload_json: input.payload_json,
    })
  }

  private async createNotificationsForCallouts(input: {
    artifact: AftershowArtifact
    callouts: AftershowCallout[]
    post_id: string
  }): Promise<number> {
    if (!this.deps.notificationRepo) return 0

    const startOfDay = toStartOfDay(new Date())
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    let postCountThisHour = await this.deps.artifactRepo.countCalloutsByPostSince(input.post_id, oneHourAgo)
    const notifiedUsers = new Set<string>()
    let createdCount = 0

    for (let calloutIndex = 0; calloutIndex < input.callouts.length; calloutIndex += 1) {
      if (notifiedUsers.size >= MAX_UNIQUE_USERS_NOTIFIED_PER_AFTERSHOW) break
      if (postCountThisHour >= MAX_NOTIFICATIONS_PER_POST_PER_HOUR) break
      const callout = input.callouts[calloutIndex]
      if (notifiedUsers.has(callout.user_id)) continue

      const recentlyNotifiedOnPost = await this.deps.artifactRepo.countCalloutsByUserAndPostSince(
        callout.user_id,
        input.post_id,
        new Date(Date.now() - PER_USER_PER_POST_NOTIFICATION_COOLDOWN_MS),
      )
      // The current artifact's callout is already persisted before notification fanout.
      // Block only when there is at least one additional recent callout on the same post.
      if (recentlyNotifiedOnPost > 1) continue

      const sentToday = await this.deps.artifactRepo.countCalloutsByUserSince(callout.user_id, startOfDay)
      if (sentToday >= MAX_NOTIFICATIONS_PER_USER_PER_DAY) continue

      const notification = await this.deps.notificationRepo.create({
        user_id: callout.user_id,
        type: 'AFTERSHOW_CALLOUT',
        title: '你在 Aftershow 中被点名',
        body: callout.reason,
        target_type: 'AFTERSHOW_CALLOUT',
        target_id: `${input.post_id}:${input.artifact.id}:${calloutIndex}`,
      })
      createdCount += 1
      postCountThisHour += 1
      notifiedUsers.add(callout.user_id)

      await this.deps.artifactRepo.updateCallout(callout.id, {
        notification_id: notification.id,
      })

      this.deps.eventRepo.create({
        event_type: 'HUMAN_NOTIFICATION_CREATED',
        plane: 'CONTROL',
        schema_version: 'v1',
        community_id: input.artifact.community_id,
        post_id: input.post_id,
        actor_type: 'system',
        actor_id: 'aftershow-runtime',
        correlation_id: input.artifact.id,
        payload_json: {
          callout_id: callout.id,
          notification_id: notification.id,
          user_id: callout.user_id,
          post_id: input.post_id,
          artifact_id: input.artifact.id,
          callout_index: calloutIndex,
        },
      })
    }

    return createdCount
  }

  private buildCalloutCandidates(messages: AudienceMessage[]): Array<{
    user_id: string
    audience_message_id: string
    reason: string
    evidence_ref: string
  }> {
    const out: Array<{
      user_id: string
      audience_message_id: string
      reason: string
      evidence_ref: string
    }> = []
    const dedupUser = new Set<string>()

    for (const message of [...messages].reverse()) {
      if (dedupUser.has(message.author_user_id)) continue
      dedupUser.add(message.author_user_id)
      out.push({
        user_id: message.author_user_id,
        audience_message_id: message.id,
        reason: 'Aftershow 回答了你在观众区的讨论观点',
        evidence_ref: `audience_message:${message.id}`,
      })
      if (out.length >= MAX_CALLOUTS_PER_AFTERSHOW) break
    }

    return out
  }

  async trigger(input: {
    post_id: string
    triggered_by_user_id?: string | null
    actor_role?: 'admin' | 'user' | null
    mode: 'AUTO' | 'MANUAL'
    force: boolean
  }) {
    const post = await this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    if (input.mode === 'MANUAL' && input.triggered_by_user_id && input.actor_role !== 'admin') {
      const authorAgent = this.deps.agentRepo.findById(post.author_agent_id)
      if (!authorAgent || authorAgent.owner_id !== input.triggered_by_user_id) {
        throw new ForbiddenError('Only admin or post owner can manually trigger aftershow')
      }
    }

    const community = this.deps.communityRepo.findById(post.community_id)
    if (!community) throw new NotFoundError('Community', post.community_id)

    const stageResolved = resolveStageSpecFromRules(community.rules_json, {
      community_id: community.id,
    })

    const { aftershow } = stageResolved.stage_spec
    const stageMode = aftershow.mode
    const threshold = aftershow.threshold

    const audienceThread = await this.deps.audienceRepo.findThreadByPost(post.id)
    const audienceMessageCount = audienceThread
      ? await this.deps.audienceRepo.countMessagesByThread(audienceThread.id)
      : 0
    const humanVotes = this.deps.humanVoteRepo.countByTarget('POST', post.id)

    const thresholdPass = audienceMessageCount >= threshold.audience_comments
      || humanVotes.score >= threshold.human_vote_score

    let status: 'CREATED' | 'SKIPPED' | 'COMPLETED' = 'CREATED'
    let reason = 'triggered'
    let summaryRef: string | null = null

    if (!input.force) {
      if (!aftershow.enabled) {
        status = 'SKIPPED'
        reason = 'aftershow_disabled'
      } else if (stageMode === 'OFF') {
        status = 'SKIPPED'
        reason = 'aftershow_mode_off'
      } else if (stageMode === 'THRESHOLD' && !thresholdPass) {
        status = 'SKIPPED'
        reason = 'threshold_not_met'
      } else if (stageMode === 'PERIODIC' && !aftershow.periodic?.enabled) {
        status = 'SKIPPED'
        reason = 'periodic_disabled'
      }
    }

    const messages = audienceThread ? await this.deps.audienceRepo.listMessagesByThread(audienceThread.id) : []

    if (
      config.features.aftershowAudienceSummaryV1
      && audienceThread
      && audienceMessageCount > 0
      && !stageResolved.stage_spec.human_participation.agent_reads_audience_zone
    ) {
      const now = new Date()
      const summary = await this.deps.audienceRepo.createSummary({
        thread_id: audienceThread.id,
        post_id: post.id,
        community_id: post.community_id,
        window_start: messages[0]?.created_at ?? now,
        window_end: messages[messages.length - 1]?.created_at ?? now,
        summary_text: this.buildAudienceSummary(messages),
        message_count: audienceMessageCount,
        meta: {
          source: 'aftershow_trigger',
          safe_mode: true,
        },
      })
      summaryRef = summary.id
    }

    const thresholdDetail = {
      audience_comments: {
        required: threshold.audience_comments,
        actual: audienceMessageCount,
      },
      human_vote_score: {
        required: threshold.human_vote_score,
        actual: humanVotes.score,
      },
    }

    const run = await this.deps.runRepo.create({
      post_id: post.id,
      community_id: post.community_id,
      mode: stageMode,
      status,
      threshold_min_comments: threshold.audience_comments,
      threshold_min_audience_comments: threshold.audience_comments,
      threshold_min_human_votes: threshold.human_vote_score,
      comments_at_trigger: 0,
      audience_message_count_at_trigger: audienceMessageCount,
      human_vote_score_at_trigger: humanVotes.score,
      audience_summary_ref: summaryRef,
      threshold_detail: thresholdDetail,
      triggered_by_user_id: input.triggered_by_user_id ?? null,
      meta: {
        trigger_mode: input.mode,
        force: input.force,
        threshold_pass: thresholdPass,
        reason,
        audience_summary_ref: summaryRef,
        used_stage_fallback: stageResolved.used_fallback,
        ...(stageResolved.errors.length > 0 && { stage_spec_errors: stageResolved.errors }),
      },
    })

    richCommunitiesMetrics.recordAftershowTrigger({
      mode: stageMode,
      status,
    })

    let artifact: AftershowArtifact | null = null
    let callouts: AftershowCallout[] = []
    let notifications_created = 0

    if (config.features.aftershowEventPipelineV1) {
      const correlationId = `aftershow-run:${run.id}`
      await this.emitRuntimeEvent({
        event_type: 'AFTERSHOW_DUE',
        community_id: post.community_id,
        post_id: post.id,
        correlation_id: correlationId,
        payload_json: {
          run_id: run.id,
          reason,
          threshold_pass: thresholdPass,
        },
      })

      const publishedInLastHour = await this.deps.artifactRepo.countPublishedByPostSince(
        post.id,
        new Date(Date.now() - 60 * 60 * 1000),
      )
      if (publishedInLastHour >= MAX_AFTERSHOW_PUBLISH_PER_POST_PER_HOUR) {
        status = 'SKIPPED'
        reason = 'publish_rate_limited'
      }

      const baseSummaryText = this.buildAudienceSummary(messages)
      const now = new Date()
      artifact = await this.deps.artifactRepo.createArtifact({
        run_id: run.id,
        post_id: post.id,
        community_id: post.community_id,
        status: 'DUE',
        window_start: messages[0]?.created_at ?? now,
        window_end: messages[messages.length - 1]?.created_at ?? now,
        summary_text: baseSummaryText,
        audience_summary_ref: summaryRef,
        correlation_id: correlationId,
        idempotency_key: `${post.id}:${stageMode}:${summaryRef ?? run.id}`,
        meta: {
          reason,
          threshold_pass: thresholdPass,
        },
      })

      await this.deps.artifactRepo.updateArtifact(artifact.id, {
        status: 'SNAPSHOT_CREATED',
      })
      await this.emitRuntimeEvent({
        event_type: 'AFTERSHOW_SNAPSHOT_CREATED',
        community_id: post.community_id,
        post_id: post.id,
        correlation_id: correlationId,
        payload_json: {
          artifact_id: artifact.id,
          message_count: messages.length,
          summary_ref: summaryRef,
        },
      })

      await this.emitRuntimeEvent({
        event_type: 'AFTERSHOW_INPUT_SNAPSHOT_CREATED',
        community_id: post.community_id,
        post_id: post.id,
        correlation_id: correlationId,
        payload_json: {
          artifact_id: artifact.id,
          message_count: messages.length,
          summary_ref: summaryRef,
        },
      })

      await this.emitRuntimeEvent({
        event_type: 'AFTERSHOW_COMPOSE_REQUESTED',
        community_id: post.community_id,
        post_id: post.id,
        correlation_id: correlationId,
        payload_json: {
          artifact_id: artifact.id,
        },
      })

      const content = this.buildAftershowContent({
        postTitle: post.title,
        messages,
        summaryText: baseSummaryText,
      })
      artifact = await this.deps.artifactRepo.updateArtifact(artifact.id, {
        status: 'COMPOSED',
        content,
      })
      if (!artifact) throw new NotFoundError('AftershowArtifact', run.id)

      await this.emitRuntimeEvent({
        event_type: 'AFTERSHOW_COMPOSED',
        community_id: post.community_id,
        post_id: post.id,
        correlation_id: correlationId,
        payload_json: {
          artifact_id: artifact.id,
          content_ready: true,
        },
      })

      if (status === 'SKIPPED') {
        artifact = await this.deps.artifactRepo.updateArtifact(artifact.id, {
          status: 'ABORTED',
          meta: {
            ...(artifact.meta ?? {}),
            reason,
          },
        })

        await this.emitRuntimeEvent({
          event_type: 'AFTERSHOW_ABORTED',
          community_id: post.community_id,
          post_id: post.id,
          correlation_id: correlationId,
          payload_json: {
            artifact_id: artifact?.id,
            reason,
          },
        })
      } else {
        artifact = await this.deps.artifactRepo.updateArtifact(artifact.id, {
          status: 'PUBLISHED',
          published_at: new Date(),
          meta: {
            ...(artifact.meta ?? {}),
            publish_shape: 'aftershow_block',
          },
        })
        if (!artifact) throw new NotFoundError('AftershowArtifact', run.id)

        await this.emitRuntimeEvent({
          event_type: 'AFTERSHOW_PUBLISHED',
          community_id: post.community_id,
          post_id: post.id,
          correlation_id: correlationId,
          payload_json: {
            artifact_id: artifact.id,
            publish_shape: 'aftershow_block',
          },
        })

        this.deps.eventRepo.create({
          event_type: 'AFTERSHOW_COMMENT_CREATED',
          plane: 'DATA',
          schema_version: 'v1',
          community_id: post.community_id,
          post_id: post.id,
          actor_type: 'system',
          actor_id: 'aftershow-runtime',
          correlation_id: correlationId,
          payload_json: {
            artifact_id: artifact.id,
            post_id: post.id,
          },
        })

        const candidates = this.buildCalloutCandidates(messages)
        for (const candidate of candidates) {
          const created = await this.deps.artifactRepo.createCallout({
            artifact_id: artifact.id,
            user_id: candidate.user_id,
            audience_message_id: candidate.audience_message_id,
            reason: candidate.reason,
            evidence_ref: candidate.evidence_ref,
          })
          callouts.push(created)
        }

        this.deps.eventRepo.create({
          event_type: 'AFTERSHOW_CALLOUTS_EXTRACTED',
          plane: 'CONTROL',
          schema_version: 'v1',
          community_id: post.community_id,
          post_id: post.id,
          actor_type: 'system',
          actor_id: 'aftershow-runtime',
          correlation_id: correlationId,
          payload_json: {
            artifact_id: artifact.id,
            callout_count: callouts.length,
            user_ids: callouts.map((item) => item.user_id),
          },
        })

        notifications_created = await this.createNotificationsForCallouts({
          artifact,
          callouts,
          post_id: post.id,
        })
      }
    }
    return {
      run,
      threshold_pass: thresholdPass,
      reason,
      audience_message_count: audienceMessageCount,
      summary_ref: summaryRef,
      threshold_detail: thresholdDetail,
      artifact,
      callouts,
      notifications_created,
    }
  }

  async getLatestByPost(postId: string): Promise<{
    artifact: AftershowArtifact | null
    callouts: AftershowCallout[]
  }> {
    const artifact = await this.deps.artifactRepo.findLatestPublishedByPost(postId)
    if (!artifact) return { artifact: null, callouts: [] }
    const callouts = await this.deps.artifactRepo.listCalloutsByArtifact(artifact.id)
    return { artifact, callouts }
  }
}

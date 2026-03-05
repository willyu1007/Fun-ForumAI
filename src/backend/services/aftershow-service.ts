import type { PostRepository, HumanVoteRepository, AgentRepository, AudienceMessage } from '../repos/index.js'
import type { AftershowRunRepository } from '../repos/aftershow-run-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { AudienceRepository } from '../repos/audience-repository.js'
import { ForbiddenError, NotFoundError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import { resolveStageSpecFromRules } from '../stage/index.js'

export interface AftershowServiceDeps {
  postRepo: PostRepository
  humanVoteRepo: HumanVoteRepository
  audienceRepo: AudienceRepository
  agentRepo: AgentRepository
  communityRepo: CommunityRepository
  runRepo: AftershowRunRepository
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

    if (
      config.features.aftershowAudienceSummaryV1
      && audienceThread
      && audienceMessageCount > 0
      && !stageResolved.stage_spec.human_participation.agent_reads_audience_zone
    ) {
      const messages = await this.deps.audienceRepo.listMessagesByThread(audienceThread.id)
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
    return {
      run,
      threshold_pass: thresholdPass,
      reason,
      audience_message_count: audienceMessageCount,
      summary_ref: summaryRef,
      threshold_detail: thresholdDetail,
    }
  }
}

import type { PostRepository, CommentRepository, HumanVoteRepository } from '../repos/index.js'
import type { AftershowRunRepository } from '../repos/aftershow-run-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import { NotFoundError } from '../lib/errors.js'
import { resolveStageSpecFromRules } from '../stage/index.js'

export interface AftershowServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  humanVoteRepo: HumanVoteRepository
  communityRepo: CommunityRepository
  runRepo: AftershowRunRepository
}

export class AftershowService {
  constructor(private readonly deps: AftershowServiceDeps) {}

  async trigger(input: {
    post_id: string
    triggered_by_user_id?: string | null
    mode: 'AUTO' | 'MANUAL'
    force: boolean
  }) {
    const post = await this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    const community = this.deps.communityRepo.findById(post.community_id)
    if (!community) throw new NotFoundError('Community', post.community_id)

    const stageResolved = resolveStageSpecFromRules(community.rules_json, {
      community_id: community.id,
    })

    const stageMode = stageResolved.stage_spec.aftershow.mode
    const threshold = stageResolved.stage_spec.aftershow.threshold

    const commentCount = await this.deps.commentRepo.countByPost(post.id)
    const humanVotes = this.deps.humanVoteRepo.countByTarget('POST', post.id)

    const thresholdPass = commentCount >= threshold.min_comments || humanVotes.score >= threshold.min_human_vote_score

    let status: 'CREATED' | 'SKIPPED' | 'COMPLETED' = 'CREATED'
    let reason = 'triggered'

    if (!input.force) {
      if (stageMode === 'OFF') {
        status = 'SKIPPED'
        reason = 'aftershow_mode_off'
      } else if (stageMode === 'THRESHOLD' && !thresholdPass) {
        status = 'SKIPPED'
        reason = 'threshold_not_met'
      } else if (stageMode === 'PERIODIC' && !stageResolved.stage_spec.aftershow.periodic.enabled) {
        status = 'SKIPPED'
        reason = 'periodic_disabled'
      }
    }

    const run = await this.deps.runRepo.create({
      post_id: post.id,
      community_id: post.community_id,
      mode: stageMode,
      status,
      threshold_min_comments: threshold.min_comments,
      threshold_min_human_votes: threshold.min_human_vote_score,
      comments_at_trigger: commentCount,
      human_vote_score_at_trigger: humanVotes.score,
      triggered_by_user_id: input.triggered_by_user_id ?? null,
      meta: {
        trigger_mode: input.mode,
        force: input.force,
        threshold_pass: thresholdPass,
        reason,
        used_stage_fallback: stageResolved.used_fallback,
      },
    })

    return {
      run,
      threshold_pass: thresholdPass,
      reason,
    }
  }
}

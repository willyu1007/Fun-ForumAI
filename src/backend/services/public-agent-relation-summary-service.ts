import { buildAgentTarget } from '../../shared/agent-target.js'
import { getLightweightPersonalizationRuntime } from '../launch/lightweight-personalization.js'
import type {
  AchievementChronicleService,
} from './achievement-chronicle-service.js'
import type { ForumReadService } from './forum-read-service.js'
import type { HumanFollowRepository, PprSnapshotRepository } from '../repos/index.js'
import type { ViewerActorContext, ViewerPublicViewService } from './viewer-public-view-service.js'
import type { PairRelationHint, RelationService } from './relation-service.js'

export interface RelationSummaryTeaser {
  relation_label: string
  relation_state_delta: 'new_follow' | 'stable'
  shared_storyline_count: number
  recent_callout_presence: boolean
  cta_target: string
}

export interface PublicAgentRelationSummary extends RelationSummaryTeaser {
  target_agent_id: string
  viewer_agent_id: string
  pair_hint: PairRelationHint
  is_followed: boolean
  explainability: string[]
  recent_storyline_ids: string[]
  recent_ppr_candidates: string[]
}

export interface PublicAgentRelationSummaryServiceDeps {
  viewerPublicViewService: ViewerPublicViewService
  forumReadService: Pick<ForumReadService, 'getFeed'>
  achievementChronicleService: Pick<AchievementChronicleService, 'getPublicHighlights'>
  humanFollowRepo: HumanFollowRepository
  relationService?: Pick<RelationService, 'getPairHintSync'> | null
  pprSnapshotRepo: Pick<PprSnapshotRepository, 'listBySourceAgent'>
}

export class PublicAgentRelationSummaryService {
  constructor(private readonly deps: PublicAgentRelationSummaryServiceDeps) {}

  attachRuntimeDeps(input: {
    relationService?: Pick<RelationService, 'getPairHintSync'> | null
  }): void {
    if (input.relationService !== undefined) {
      this.deps.relationService = input.relationService
    }
  }

  async buildPublicSummary(input: {
    target_agent_id: string
    viewer: ViewerActorContext
  }): Promise<PublicAgentRelationSummary | null> {
    if (!input.viewer.viewer_agent_id) return null

    const recentSignals = await this.deps.viewerPublicViewService.getRecentSignals(input.viewer)
    const [recentPosts, highlights, pprRows] = await Promise.all([
      this.deps.forumReadService.getFeed({
        authorAgentIds: [input.target_agent_id],
        limit: 24,
      }),
      this.deps.achievementChronicleService.getPublicHighlights(input.target_agent_id),
      this.deps.pprSnapshotRepo.listBySourceAgent(input.viewer.viewer_agent_id, { limit: 12 }),
    ])

    const pairHint = this.deps.relationService?.getPairHintSync(
      input.viewer.viewer_agent_id,
      input.target_agent_id,
    ) ?? 'none'
    const follow = input.viewer.user_id
      ? this.deps.humanFollowRepo.findFollow(input.viewer.user_id, input.target_agent_id)
      : null
    const runtime = getLightweightPersonalizationRuntime()
    const recentCutoff = Date.now() - runtime.public_view_events.recent_window_days * 24 * 60 * 60 * 1000

    const targetStorylineIds = uniqueRecent(recentPosts.items.map((item) => item.storyline_id))
    const sharedStorylineCount = targetStorylineIds
      .filter((storylineId) => recentSignals.recent_storyline_ids.includes(storylineId))
      .length
    const topChronicle = highlights.top_chronicle[0]
    const recentCalloutPresence = Boolean(
      topChronicle && new Date(topChronicle.occurred_at).getTime() >= recentCutoff,
    )
    const recentPprCandidates = pprRows
      .map((row) => row.candidate_agent_id)
      .filter((candidateId) => candidateId === input.target_agent_id)

    const teaser: PublicAgentRelationSummary = {
      target_agent_id: input.target_agent_id,
      viewer_agent_id: input.viewer.viewer_agent_id,
      pair_hint: pairHint,
      is_followed: Boolean(follow),
      relation_label: mapRelationLabel(pairHint, Boolean(follow)),
      relation_state_delta: follow && follow.created_at.getTime() >= recentCutoff ? 'new_follow' : 'stable',
      shared_storyline_count: sharedStorylineCount,
      recent_callout_presence: recentCalloutPresence,
      cta_target: buildAgentTarget({
        agentId: input.target_agent_id,
        mode: 'readonly',
        tab: 'social',
      }),
      explainability: [
        ...recentSignals.explainability,
        ...(sharedStorylineCount > 0 ? [`shared_storyline_count:${sharedStorylineCount}`] : []),
        ...(recentCalloutPresence ? ['recent_callout_presence:true'] : []),
      ],
      recent_storyline_ids: targetStorylineIds.slice(0, 4),
      recent_ppr_candidates: recentPprCandidates,
    }

    return teaser
  }
}

function mapRelationLabel(pairHint: PairRelationHint, isFollowed: boolean): string {
  if (pairHint === 'friend') return '互相关注'
  if (pairHint === 'following' || isFollowed) return '已关注'
  if (pairHint === 'follower') return '对方已关注你'
  if (pairHint === 'blocked') return '关系受限'
  return '尚未建立明显关系'
}

function uniqueRecent(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (typeof value !== 'string' || value.trim().length === 0) continue
    const normalized = value.trim()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

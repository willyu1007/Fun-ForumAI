import {
  isLaunchNativeCreatorNoteCommunity,
  normalizeLaunchCreatorNoteTemplateId,
} from '../launch/creator-note-templates.js'
import type { PostLaunchTuningProfile } from '../launch/post-launch-tuning.js'
import type { ViewerRecentSignals } from '../repos/index.js'
import {
  readContentKind,
  readNoteTemplateId,
  readStorylineId,
} from '../../shared/semantic-taxonomy.js'
import type { PostWithMeta } from './forum-read-service.js'

export interface HomeViewerRankingRuntime {
  enabled: boolean
  recentSignals: ViewerRecentSignals | null
  followedAgentIds: Set<string>
  pprCandidateAgentIds: Set<string>
}

export interface HomeViewerSortOptions {
  preferStorylineRevisit?: boolean
  preferCreatorNoteRevisit?: boolean
}

type HeroSlotCandidate = Pick<PostWithMeta, 'content_semantics'> & {
  hero_reason?: string | null
}

export function sortPostsByViewerContext<T extends PostWithMeta>(
  items: T[],
  viewerRuntime: HomeViewerRankingRuntime,
  options?: HomeViewerSortOptions,
): T[] {
  if (!viewerRuntime.enabled || items.length <= 1) {
    return items
  }

  return items
    .map((item, index) => ({
      item,
      index,
      score: computeViewerScore(item, viewerRuntime, options),
    }))
    .sort((a, b) =>
      b.score - a.score
      || b.item.heat_score - a.item.heat_score
      || b.item.thread_turn_count - a.item.thread_turn_count
      || a.index - b.index,
    )
    .map((entry) => entry.item)
}

export function computeViewerScore(
  item: Pick<PostWithMeta, 'author' | 'content_semantics'>,
  viewerRuntime: HomeViewerRankingRuntime,
  options?: HomeViewerSortOptions,
): number {
  if (!viewerRuntime.enabled) return 0

  let score = 0
  const recentSignals = viewerRuntime.recentSignals
  const storylineId = readStorylineId(item)
  const noteTemplateId = readNoteTemplateId(item)

  if (viewerRuntime.followedAgentIds.has(item.author.id)) score += 30
  if (viewerRuntime.pprCandidateAgentIds.has(item.author.id)) score += 12
  if (recentSignals?.recent_target_agent_ids.includes(item.author.id)) score += 8
  if (
    options?.preferStorylineRevisit
    && storylineId
    && recentSignals?.recent_storyline_ids.includes(storylineId)
  ) {
    score += 40
  }
  if (
    options?.preferCreatorNoteRevisit
    && noteTemplateId
    && recentSignals?.recent_note_template_ids.includes(noteTemplateId)
  ) {
    score += 20
  }

  return score
}

export function readCreatorNoteTemplateRank(
  item: Pick<PostWithMeta, 'community_slug' | 'content_semantics'>,
  tuningProfile?: PostLaunchTuningProfile,
): number {
  const noteTemplateId = normalizeLaunchCreatorNoteTemplateId(readNoteTemplateId(item))
  if (!tuningProfile || !isLaunchNativeCreatorNoteCommunity(item.community_slug) || !noteTemplateId) {
    return 0
  }
  const preferred = tuningProfile.creator_note.preferred_templates_by_community[item.community_slug] ?? []
  const index = preferred.indexOf(noteTemplateId)
  return index >= 0 ? preferred.length - index : 0
}

export function applyHeroSlotCopy<T extends HeroSlotCandidate>(
  items: T[],
  tuningProfile?: PostLaunchTuningProfile,
): T[] {
  if (items.length === 0 || !tuningProfile) return items

  const [first, ...rest] = items
  const heroReason = tuningProfile.home.hero_slot_copy[readContentKind(first) ?? '']
    ?? tuningProfile.home.hero_slot_copy.must_watch_today
    ?? first.hero_reason

  return [{
    ...first,
    hero_reason: heroReason,
  }, ...rest]
}

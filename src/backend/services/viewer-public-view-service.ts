import type {
  CreateViewerPublicViewEventInput,
  ViewerPublicActorType,
  ViewerRecentSignals,
  ViewerPublicViewEventRepository,
} from '../repos/index.js'
import { getLightweightPersonalizationRuntime } from '../launch/lightweight-personalization.js'

export interface ViewerActorContext {
  actor_type: ViewerPublicActorType
  actor_id: string
  user_id?: string | null
  visitor_id?: string | null
  viewer_agent_id?: string | null
}

export class ViewerPublicViewService {
  constructor(private readonly repo: ViewerPublicViewEventRepository) {}

  async record(entries: CreateViewerPublicViewEventInput[]): Promise<void> {
    if (entries.length === 0) return
    const runtime = getLightweightPersonalizationRuntime()
    const retentionCutoff = new Date(
      Date.now() - runtime.public_view_events.retention_days * 24 * 60 * 60 * 1000,
    )
    await this.repo.purgeOlderThan(retentionCutoff)
    await this.repo.createMany(entries)
  }

  async mergeVisitorIntoUser(visitorId: string, userId: string): Promise<void> {
    if (!visitorId || !userId || visitorId === userId) return
    await this.repo.mergeVisitorIntoUser(visitorId, userId)
  }

  async getRecentSignals(actor: ViewerActorContext): Promise<ViewerRecentSignals> {
    const runtime = getLightweightPersonalizationRuntime()
    const since = new Date(Date.now() - runtime.public_view_events.recent_window_days * 24 * 60 * 60 * 1000)
    const actors: Array<{ actor_type: ViewerPublicActorType; actor_id: string }> = [
      { actor_type: actor.actor_type, actor_id: actor.actor_id },
    ]
    if (actor.actor_type === 'USER' && actor.visitor_id) {
      actors.push({ actor_type: 'VISITOR', actor_id: actor.visitor_id })
    }
    const rows = await this.repo.listRecentByActor(actors, { since, limit: 200 })
    const recentStorylineIds = uniqueRecent(rows.map((row) => row.storyline_id))
    const recentCommunityIds = uniqueRecent(rows.map((row) => row.community_id))
    const recentTemplateIds = uniqueRecent(rows.map((row) => row.note_template_id))
    const recentTargetAgentIds = uniqueRecent(rows.map((row) => row.target_agent_id))

    const explainability: string[] = []
    if (recentStorylineIds.length > 0) {
      explainability.push(`recent_storyline_revisit:${recentStorylineIds.slice(0, 2).join(',')}`)
    }
    if (recentTemplateIds.length > 0) {
      explainability.push(`recent_note_template_revisit:${recentTemplateIds.slice(0, 2).join(',')}`)
    }
    if (recentTargetAgentIds.length > 0) {
      explainability.push(`recent_agent_touch:${recentTargetAgentIds.slice(0, 2).join(',')}`)
    }

    return {
      actor_keys: actors.map((item) => `${item.actor_type}:${item.actor_id}`),
      recent_storyline_ids: recentStorylineIds,
      recent_community_ids: recentCommunityIds,
      recent_note_template_ids: recentTemplateIds,
      recent_target_agent_ids: recentTargetAgentIds,
      explainability,
    }
  }
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

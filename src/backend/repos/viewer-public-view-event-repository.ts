import type {
  CreateViewerPublicViewEventInput,
  ViewerPublicActorType,
  ViewerPublicViewEvent,
} from './types.js'

export interface ViewerPublicViewEventRepository {
  createMany(entries: CreateViewerPublicViewEventInput[]): Promise<ViewerPublicViewEvent[]>
  listRecentByActor(
    actors: Array<{ actor_type: ViewerPublicActorType; actor_id: string }>,
    opts?: { since?: Date; limit?: number },
  ): Promise<ViewerPublicViewEvent[]>
  mergeVisitorIntoUser(visitorId: string, userId: string): Promise<number>
  purgeOlderThan(cutoff: Date): Promise<number>
}

let counter = 0
function cuid(): string {
  return `viewer_public_view_${Date.now()}_${++counter}`
}

export class InMemoryViewerPublicViewEventRepository implements ViewerPublicViewEventRepository {
  private readonly store = new Map<string, ViewerPublicViewEvent>()

  async createMany(entries: CreateViewerPublicViewEventInput[]): Promise<ViewerPublicViewEvent[]> {
    const now = new Date()
    const rows = entries.map((entry) => {
      const row: ViewerPublicViewEvent = {
        id: cuid(),
        actor_type: entry.actor_type,
        actor_id: entry.actor_id,
        viewer_user_id: entry.viewer_user_id ?? null,
        viewer_agent_id: entry.viewer_agent_id ?? null,
        source_surface: entry.source_surface,
        source_shelf: entry.source_shelf ?? null,
        source_position: entry.source_position ?? null,
        target_kind: entry.target_kind,
        target_id: entry.target_id,
        target_agent_id: entry.target_agent_id ?? null,
        community_id: entry.community_id ?? null,
        storyline_id: entry.storyline_id ?? null,
        community_family: entry.community_family ?? null,
        public_participation_mode: entry.public_participation_mode ?? null,
        content_kind: entry.content_kind ?? null,
        editorial_shelf_id: entry.editorial_shelf_id ?? null,
        storyline_state: entry.storyline_state ?? null,
        format_kind: entry.format_kind ?? null,
        is_t4: entry.is_t4 ?? false,
        note_template_id: entry.note_template_id ?? null,
        cover_mode: entry.cover_mode ?? null,
        occurred_at: entry.occurred_at ?? now,
        created_at: now,
        updated_at: now,
      }
      this.store.set(row.id, row)
      return row
    })
    return rows
  }

  async listRecentByActor(
    actors: Array<{ actor_type: ViewerPublicActorType; actor_id: string }>,
    opts?: { since?: Date; limit?: number },
  ): Promise<ViewerPublicViewEvent[]> {
    const actorKeys = new Set(actors.map((actor) => `${actor.actor_type}:${actor.actor_id}`))
    const since = opts?.since ?? new Date(0)
    const limit = typeof opts?.limit === 'number' && opts.limit > 0
      ? Math.trunc(opts.limit)
      : Number.POSITIVE_INFINITY

    return Array.from(this.store.values())
      .filter((row) => actorKeys.has(`${row.actor_type}:${row.actor_id}`))
      .filter((row) => row.occurred_at >= since)
      .sort((a, b) => b.occurred_at.getTime() - a.occurred_at.getTime())
      .slice(0, limit)
  }

  async mergeVisitorIntoUser(visitorId: string, userId: string): Promise<number> {
    let updated = 0
    for (const [key, row] of this.store) {
      if (row.actor_type !== 'VISITOR' || row.actor_id !== visitorId) continue
      this.store.set(key, {
        ...row,
        actor_type: 'USER',
        actor_id: userId,
        viewer_user_id: userId,
        updated_at: new Date(),
      })
      updated += 1
    }
    return updated
  }

  async purgeOlderThan(cutoff: Date): Promise<number> {
    let removed = 0
    for (const [key, row] of this.store) {
      if (row.occurred_at < cutoff) {
        this.store.delete(key)
        removed += 1
      }
    }
    return removed
  }
}

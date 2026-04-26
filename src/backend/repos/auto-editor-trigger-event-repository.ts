/**
 * T-214 A-M1 — `AutoEditorTriggerEventRepository`.
 *
 * Append-only log keyed by `dedup_key`. The detector composes
 * `dedup_key` from `(trigger_type, community_id, window_id)` so multiple
 * ticks within the same window resolve to a single row. The repository
 * surfaces this as `recordIfAbsent`: the caller hands in a candidate and
 * gets back either the persisted row (new emission) or `null`
 * (suppressed). No update / delete API.
 */

import type {
  AutoEditorTriggerEventDomain,
  RecordAutoEditorTriggerEventInput,
} from '../programming/auto-editor/types.js'

export interface AutoEditorTriggerEventRepository {
  /**
   * Insert a new trigger event row iff `dedup_key` does not already
   * exist. Returns `null` when the dedup key collides (the caller can
   * count this as "trigger already emitted in this window").
   */
  recordIfAbsent(
    input: RecordAutoEditorTriggerEventInput,
  ): Promise<AutoEditorTriggerEventDomain | null>
  findByDedupKey(dedupKey: string): Promise<AutoEditorTriggerEventDomain | null>
  listRecentByCommunity(input: {
    communityId: string | null
    since: Date
    limit?: number
  }): Promise<AutoEditorTriggerEventDomain[]>
}

let counter = 0
function localId(): string {
  return `auto_editor_trigger_${Date.now().toString(36)}_${(++counter).toString(36)}`
}

export class InMemoryAutoEditorTriggerEventRepository
  implements AutoEditorTriggerEventRepository
{
  private readonly rows: AutoEditorTriggerEventDomain[] = []
  private readonly byDedupKey = new Map<string, string>()

  async recordIfAbsent(
    input: RecordAutoEditorTriggerEventInput,
  ): Promise<AutoEditorTriggerEventDomain | null> {
    if (this.byDedupKey.has(input.dedup_key)) return null
    const now = new Date()
    const row: AutoEditorTriggerEventDomain = {
      id: localId(),
      community_id: input.community_id ?? null,
      trigger_type: input.trigger_type,
      severity: input.severity,
      source: input.source,
      evidence: input.evidence,
      dedup_key: input.dedup_key,
      detected_at: input.detected_at ?? now,
      created_at: now,
    }
    this.rows.push(row)
    this.byDedupKey.set(row.dedup_key, row.id)
    return { ...row }
  }

  async findByDedupKey(
    dedupKey: string,
  ): Promise<AutoEditorTriggerEventDomain | null> {
    const id = this.byDedupKey.get(dedupKey)
    if (!id) return null
    const row = this.rows.find((r) => r.id === id)
    return row ? { ...row } : null
  }

  async listRecentByCommunity(input: {
    communityId: string | null
    since: Date
    limit?: number
  }): Promise<AutoEditorTriggerEventDomain[]> {
    const limit = input.limit ?? 100
    const filtered = this.rows
      .filter((r) =>
        r.community_id === input.communityId
        && r.detected_at.getTime() >= input.since.getTime())
      .sort((a, b) => b.detected_at.getTime() - a.detected_at.getTime())
      .slice(0, limit)
    return filtered.map((r) => ({ ...r }))
  }
}

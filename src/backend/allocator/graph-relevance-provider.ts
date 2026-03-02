import type { GraphRelevanceProvider, GraphRelevanceSnapshot } from './types.js'
import { PPR_TOPIC_FALLBACK, normalizeTopicToken } from './ppr-topic-key.js'

export interface GraphRelevanceSnapshotRecord extends GraphRelevanceSnapshot {
  source_agent_id: string
  community_id: string
  topic_key: string
}

function cacheKey(sourceAgentId: string, communityId: string, topicKey: string): string {
  return `${sourceAgentId}:${communityId}:${topicKey}`
}

function normalizeTopicKey(topicKey: string): string {
  const normalized = normalizeTopicToken(topicKey)
  return normalized.length > 0 ? normalized : PPR_TOPIC_FALLBACK
}

function byRank(a: GraphRelevanceSnapshot, b: GraphRelevanceSnapshot): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  if (a.ppr_score !== b.ppr_score) return b.ppr_score - a.ppr_score
  return a.candidate_agent_id.localeCompare(b.candidate_agent_id)
}

export class SnapshotGraphRelevanceProvider implements GraphRelevanceProvider {
  private readonly contexts = new Map<string, GraphRelevanceSnapshot[]>()

  hydrate(records: GraphRelevanceSnapshotRecord[]): void {
    this.contexts.clear()
    this.upsertRecords(records)
  }

  replaceSourceSnapshots(sourceAgentId: string, records: GraphRelevanceSnapshotRecord[]): void {
    for (const key of this.contexts.keys()) {
      if (key.startsWith(`${sourceAgentId}:`)) {
        this.contexts.delete(key)
      }
    }
    this.upsertRecords(records)
  }

  getSnapshot(input: {
    source_agent_id: string
    community_id: string
    topic_key: string
    now?: Date
  }): GraphRelevanceSnapshot[] {
    const nowMs = (input.now ?? new Date()).getTime()
    const topicKey = normalizeTopicKey(input.topic_key)
    const fallbackKeys = [
      cacheKey(input.source_agent_id, input.community_id, topicKey),
      cacheKey(input.source_agent_id, input.community_id, PPR_TOPIC_FALLBACK),
      cacheKey(input.source_agent_id, '__all__', topicKey),
      cacheKey(input.source_agent_id, '__all__', PPR_TOPIC_FALLBACK),
    ]

    for (const key of fallbackKeys) {
      const rows = this.contexts.get(key)
      if (!rows || rows.length === 0) continue

      const alive = rows.filter((row) => row.expires_at.getTime() > nowMs)
      if (alive.length === 0) continue
      return alive
    }

    return []
  }

  private upsertRecords(records: GraphRelevanceSnapshotRecord[]): void {
    const grouped = new Map<string, GraphRelevanceSnapshot[]>()

    for (const record of records) {
      const key = cacheKey(
        record.source_agent_id,
        record.community_id,
        normalizeTopicKey(record.topic_key),
      )
      const list = grouped.get(key) ?? []
      list.push({
        candidate_agent_id: record.candidate_agent_id,
        ppr_score: record.ppr_score,
        rank: record.rank,
        computed_at: record.computed_at,
        expires_at: record.expires_at,
      })
      grouped.set(key, list)
    }

    for (const [key, rows] of grouped) {
      this.contexts.set(key, rows.sort(byRank))
    }
  }
}

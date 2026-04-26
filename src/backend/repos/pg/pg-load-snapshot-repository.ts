/**
 * T-213 M2 — Postgres `LoadSnapshotRepository`.
 *
 * Backs the cached freshness pathway against the `community_runtime_load_snapshots`
 * table reserved by T-209. Append-only: every insert produces a new row so the
 * Cue Board's 30-min forward window can chart historical state without needing
 * a separate timeseries table.
 */

import {
  Prisma,
  type PrismaClient,
  type CommunityRuntimeLoadSnapshot as PrismaLoadSnapshot,
} from '@prisma/client'
import type {
  FindLatestForCommunityInput,
  LoadSnapshotRepository,
} from '../load-snapshot-repository.js'
import {
  LOAD_FRESHNESS_FROM_DB,
  LOAD_FRESHNESS_TO_DB,
  LOAD_STATE_FROM_DB,
  LOAD_STATE_TO_DB,
} from '../load-snapshot-repository.js'
import type { LoadSnapshot } from '../../programming/load/types.js'

export class PgLoadSnapshotRepository implements LoadSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findLatestForCommunity(
    input: FindLatestForCommunityInput,
  ): Promise<LoadSnapshot | null> {
    const row = await this.prisma.communityRuntimeLoadSnapshot.findFirst({
      where: {
        communityId: input.communityId,
        ...(input.freshness
          ? { freshness: LOAD_FRESHNESS_TO_DB[input.freshness] }
          : {}),
        ...(input.computedAfter
          ? { computedAt: { gt: input.computedAfter } }
          : {}),
      },
      orderBy: [{ computedAt: 'desc' }],
    })
    return row ? this.toDomain(row) : null
  }

  async insert(snapshot: LoadSnapshot): Promise<LoadSnapshot> {
    const data: Prisma.CommunityRuntimeLoadSnapshotUncheckedCreateInput = {
      communityId: snapshot.community_id,
      windowStart: snapshot.window_start,
      windowEnd: snapshot.window_end,
      freshness: LOAD_FRESHNESS_TO_DB[snapshot.freshness],
      state: LOAD_STATE_TO_DB[snapshot.state],
      globalState: LOAD_STATE_TO_DB[snapshot.global_state],
      scheduledCueCount: snapshot.scheduled_cue_count,
      dueCueCount: snapshot.due_cue_count,
      executingCueCount: snapshot.executing_cue_count,
      recentRootPostCount: snapshot.recent_root_post_count,
      recentThreadFollowupCount: snapshot.recent_thread_followup_count,
      activeSceneCount: snapshot.active_scene_count,
      hotThreadPressure: snapshot.hot_thread_pressure,
      visibleLlmQueueDepth: snapshot.visible_llm_queue_depth,
      mediaQueueDepth: snapshot.media_queue_depth,
      providerQueuePressure: snapshot.provider_queue_pressure,
      loadScore: snapshot.load_score,
      capacityRemaining: snapshot.capacity_remaining,
      computedAt: snapshot.computed_at,
    }
    const row = await this.prisma.communityRuntimeLoadSnapshot.create({ data })
    return this.toDomain(row)
  }

  private toDomain(row: PrismaLoadSnapshot): LoadSnapshot {
    return {
      community_id: row.communityId,
      window_start: row.windowStart,
      window_end: row.windowEnd,
      freshness: LOAD_FRESHNESS_FROM_DB[row.freshness],
      state: LOAD_STATE_FROM_DB[row.state],
      global_state: LOAD_STATE_FROM_DB[row.globalState],
      scheduled_cue_count: row.scheduledCueCount,
      due_cue_count: row.dueCueCount,
      executing_cue_count: row.executingCueCount,
      recent_root_post_count: row.recentRootPostCount,
      recent_thread_followup_count: row.recentThreadFollowupCount,
      active_scene_count: row.activeSceneCount,
      hot_thread_pressure: row.hotThreadPressure,
      visible_llm_queue_depth: row.visibleLlmQueueDepth,
      media_queue_depth: row.mediaQueueDepth,
      provider_queue_pressure: row.providerQueuePressure,
      load_score: row.loadScore,
      capacity_remaining: row.capacityRemaining,
      computed_at: row.computedAt,
    }
  }
}

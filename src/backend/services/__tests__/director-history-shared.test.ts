import { describe, expect, it } from 'vitest'
// @ts-expect-error test imports a repo script without a dedicated TS module contract
import { generateDirectorClosureReport, isRuntimeSceneArchiveCandidate, summarizeHistoricalChatroomDailyRows, summarizeHistoricalForumDailyRows } from '../../../../scripts/lib/director-history-shared.mjs'

describe('director history shared helpers', () => {
  it('only archives finalized runtime states that are no longer the protected latest row for a live room', () => {
    expect(isRuntimeSceneArchiveCandidate({
      status: 'active',
      roomId: 'room-1',
      id: 'runtime-1',
      room: { status: 'archived' },
    })).toBe(false)

    expect(isRuntimeSceneArchiveCandidate({
      status: 'closed',
      roomId: 'room-1',
      id: 'runtime-2',
      room: { status: 'active' },
    }, new Set(['runtime-2']))).toBe(false)

    expect(isRuntimeSceneArchiveCandidate({
      status: 'closed',
      roomId: 'room-1',
      id: 'runtime-3',
      room: { status: 'active' },
    }, new Set(['runtime-2']))).toBe(true)

    expect(isRuntimeSceneArchiveCandidate({
      status: 'cooldown',
      roomId: 'room-2',
      id: 'runtime-4',
      room: { status: 'archived' },
    })).toBe(true)

    expect(isRuntimeSceneArchiveCandidate({
      status: 'closed',
      roomId: null,
      id: 'runtime-5',
      room: null,
    })).toBe(true)
  })

  it('summarizes historical forum buckets without mixing binding and selector fallback counts', () => {
    const summary = summarizeHistoricalForumDailyRows([
      {
        totalCount: 3,
        source: 'binding',
        selectionMode: 'pool_guided',
        actorSurface: 'forum_post',
      },
      {
        totalCount: 2,
        source: 'selector_fallback',
        selectionMode: 'autonomous_anchored',
        actorSurface: 'forum_thread',
      },
    ])

    expect(summary.total).toBe(5)
    expect(summary.binding_hits).toBe(3)
    expect(summary.selector_fallback_total).toBe(2)
    expect(summary.selection_modes).toEqual({
      autonomous_anchored: 2,
      pool_guided: 3,
    })
  })

  it('summarizes historical chatroom buckets by source, close reason, and aftershow mode', () => {
    const summary = summarizeHistoricalChatroomDailyRows([
      {
        totalCount: 4,
        source: 'binding',
        status: 'closed',
        experimentBucket: 'A',
        closeReason: 'threshold',
        aftershowMode: 'threshold',
        aftershowStatus: 'published',
      },
      {
        totalCount: 1,
        source: 'missing_binding',
        status: 'cooldown',
        experimentBucket: 'B',
        closeReason: 'ttl',
        aftershowMode: 'off',
        aftershowStatus: 'skipped',
      },
    ])

    expect(summary.total).toBe(5)
    expect(summary.binding_hits).toBe(4)
    expect(summary.runtime_sources).toEqual([
      { source: 'binding', count: 4 },
      { source: 'missing_binding', count: 1 },
    ])
    expect(summary.close_reasons).toEqual([
      { reason: 'threshold', count: 4 },
      { reason: 'ttl', count: 1 },
    ])
    expect(summary.aftershow_modes).toEqual([
      { mode: 'off', count: 1 },
      { mode: 'threshold', count: 4 },
    ])
    expect(summary.aftershow_statuses).toEqual([
      { status: 'published', count: 4 },
      { status: 'skipped', count: 1 },
    ])
  })

  it('treats missing launch targets as zero current scope instead of querying all summaries', async () => {
    const findCurrentSummaries = {
      findMany: async () => {
        throw new Error('should not query current summaries when current scope is empty')
      },
    }
    const report = await generateDirectorClosureReport({
      directorCurrentScopeSummary: findCurrentSummaries,
      directorHistoricalDailySummary: {
        findMany: async () => [],
      },
    }, {
      version: 'v2',
      contract_version: 'public_director_contract_v1',
      stage_templates: [],
      scene_bindings: [],
    })

    expect(report.forum.total).toBe(0)
    expect(report.chatroom.total).toBe(0)
    expect(report.scope_definition.forum_launch_targets).toEqual([])
    expect(report.scope_definition.chatroom_launch_targets).toEqual([])
  })
})

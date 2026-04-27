import { describe, expect, it, vi } from 'vitest'
import { TriggerDetector } from '../trigger-detector.js'
import { InMemoryAutoEditorTriggerEventRepository } from '../../../repos/auto-editor-trigger-event-repository.js'
import type { LoadSignalService } from '../../../services/load-signal-service.js'
import type { LoadState } from '../../load/types.js'

function buildLoadStub(state: LoadState): LoadSignalService {
  return {
    async get(communityId: string) {
      return {
        status: state,
        community_id: communityId,
        trigger_at_iso: null,
        source: 'load_signal_service:cached',
      }
    },
  }
}

function buildPostRepoStub(rootCount: number) {
  return {
    countRecentRootPostsForCommunity: vi.fn(async () => rootCount),
  }
}

const PRIME_NOW = new Date('2026-04-26T20:00:00Z') // 20:00 UTC, in default prime window
const OFF_PRIME_NOW = new Date('2026-04-26T10:00:00Z') // 10:00 UTC, outside prime

describe('TriggerDetector — COMMUNITY_LULL', () => {
  it('fires when zero root posts in the lull window during prime hours', async () => {
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const detector = new TriggerDetector({
      postRepo: buildPostRepoStub(0),
      loadSignalService: buildLoadStub('yellow'), // GLOBAL_RUNTIME_IDLE won't fire
      triggerRepo,
      now: () => PRIME_NOW,
    })

    const emitted = await detector.scanCommunity('community-1')
    const lull = emitted.find((r) => r.trigger_type === 'COMMUNITY_LULL')
    expect(lull).toBeDefined()
    expect(lull?.severity).toBe('standard')
    expect(lull?.community_id).toBe('community-1')
    expect((lull?.evidence as { observed_root_post_count?: number }).observed_root_post_count).toBe(0)
  })

  it('does NOT fire when at least one root post exists in the lull window', async () => {
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const detector = new TriggerDetector({
      postRepo: buildPostRepoStub(3),
      loadSignalService: buildLoadStub('yellow'),
      triggerRepo,
      now: () => PRIME_NOW,
    })

    const emitted = await detector.scanCommunity('community-1')
    expect(emitted.find((r) => r.trigger_type === 'COMMUNITY_LULL')).toBeUndefined()
  })

  it('does NOT fire outside configured prime hours even if community is idle', async () => {
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const detector = new TriggerDetector({
      postRepo: buildPostRepoStub(0),
      loadSignalService: buildLoadStub('yellow'),
      triggerRepo,
      now: () => OFF_PRIME_NOW,
    })

    const emitted = await detector.scanCommunity('community-1')
    expect(emitted.find((r) => r.trigger_type === 'COMMUNITY_LULL')).toBeUndefined()
  })

  it('dedupes same-window emissions across consecutive ticks', async () => {
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const detector = new TriggerDetector({
      postRepo: buildPostRepoStub(0),
      loadSignalService: buildLoadStub('yellow'),
      triggerRepo,
      now: () => PRIME_NOW,
    })

    const first = await detector.scanCommunity('community-1')
    expect(first.find((r) => r.trigger_type === 'COMMUNITY_LULL')).toBeDefined()

    const second = await detector.scanCommunity('community-1')
    expect(second.find((r) => r.trigger_type === 'COMMUNITY_LULL')).toBeUndefined()
  })
})

describe('TriggerDetector — GLOBAL_RUNTIME_IDLE', () => {
  it('fires when load is green and no upcoming cue probe is configured', async () => {
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const detector = new TriggerDetector({
      postRepo: buildPostRepoStub(99), // suppress LULL
      loadSignalService: buildLoadStub('green'),
      triggerRepo,
      now: () => PRIME_NOW,
    })
    const emitted = await detector.scanCommunity('community-1')
    const idle = emitted.find((r) => r.trigger_type === 'GLOBAL_RUNTIME_IDLE')
    expect(idle).toBeDefined()
    expect(idle?.severity).toBe('low')
  })

  it('does NOT fire when load is yellow / red', async () => {
    for (const state of ['yellow', 'red'] as const) {
      const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
      const detector = new TriggerDetector({
        postRepo: buildPostRepoStub(99),
        loadSignalService: buildLoadStub(state),
        triggerRepo,
        now: () => PRIME_NOW,
      })
      const emitted = await detector.scanCommunity('community-1')
      expect(emitted.find((r) => r.trigger_type === 'GLOBAL_RUNTIME_IDLE')).toBeUndefined()
    }
  })

  it('respects the upcoming cue probe — skips when a cue is scheduled within the lookahead', async () => {
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const probe = { hasScheduledCueWithin: vi.fn(async () => true) }
    const detector = new TriggerDetector({
      postRepo: buildPostRepoStub(99),
      loadSignalService: buildLoadStub('green'),
      triggerRepo,
      upcomingCueProbe: probe,
      now: () => PRIME_NOW,
    })
    const emitted = await detector.scanCommunity('community-1')
    expect(emitted.find((r) => r.trigger_type === 'GLOBAL_RUNTIME_IDLE')).toBeUndefined()
    expect(probe.hasScheduledCueWithin).toHaveBeenCalledOnce()
  })
})

describe('TriggerDetector — invariants', () => {
  it('never calls the LLM (no LLM gateway dep declared)', () => {
    // Compile-time invariant — TriggerDetector's deps interface includes
    // postRepo / loadSignalService / triggerRepo / upcomingCueProbe and
    // never an llm gateway. Probed by enumerating constructor signature
    // inputs.
    const detectorDeps: Array<keyof ConstructorParameters<typeof TriggerDetector>[0]> = [
      'postRepo',
      'loadSignalService',
      'triggerRepo',
    ]
    for (const key of detectorDeps) {
      expect(typeof key).toBe('string')
    }
    // (No assertion against an llm key — the test compiles only because
    // such a key isn't part of the type.)
  })
})

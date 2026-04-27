import { describe, expect, it, vi } from 'vitest'
import { AutoCueEditor } from '../auto-cue-editor.js'
import { AutoCueEditorScheduler } from '../auto-cue-editor-scheduler.js'
import { LoadGate } from '../load-gate.js'
import { TriggerDetector } from '../trigger-detector.js'
import { InMemoryAutoEditorTriggerEventRepository } from '../../../repos/auto-editor-trigger-event-repository.js'
import { InMemoryCueRepository } from '../../../repos/cue-repository.js'
import type { LoadSignalService } from '../../../services/load-signal-service.js'

const PRIME_NOW = new Date('2026-04-27T20:00:00Z')

function buildLoadStub(state: 'green' | 'yellow' | 'red'): LoadSignalService {
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

function buildHappyEditorStub() {
  return {
    async run() {
      return {
        ok: true as const,
        output: {
          action: 'create_cue' as const,
          reason: 'community lull',
          risk_level: 'standard' as const,
          target_cue_id: null,
          patch_json: {
            version: 1,
            partial: { trigger_at: '2026-04-27T20:30:00Z' },
          },
          confidence: 0.7,
          requires_review: true,
        },
        risk: { band: 'standard' as const, reason_codes: ['create_cue_baseline'] },
        attempts: 1,
      }
    },
  } as unknown as AutoCueEditor
}

function buildEditor(outputs: { ok: false; reason: 'short_circuit' | 'no_action' | 'validator_failed'; attempts: number }[]) {
  let i = 0
  return {
    async run() {
      const r = outputs[Math.min(i, outputs.length - 1)]!
      i += 1
      return r
    },
  } as unknown as AutoCueEditor
}

describe('AutoCueEditorScheduler.tick — happy path', () => {
  it('detects → gate → editor → writes a pending CueChange row', async () => {
    const cueRepo = new InMemoryCueRepository()
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const loadSignalService = buildLoadStub('green')
    const detector = new TriggerDetector(
      {
        postRepo: buildPostRepoStub(0), // → COMMUNITY_LULL fires
        loadSignalService,
        triggerRepo,
        now: () => PRIME_NOW,
      },
    )
    const loadGate = new LoadGate({ loadSignalService })
    const editor = buildHappyEditorStub()
    const scheduler = new AutoCueEditorScheduler({
      triggerDetector: detector,
      loadGate,
      autoCueEditor: editor,
      cueRepo,
      communityProvider: async () => ['community-1'],
      now: () => PRIME_NOW,
    })

    const result = await scheduler.tick()
    expect(result.triggersDetected).toBeGreaterThanOrEqual(1)
    expect(result.proposalsWritten).toBeGreaterThanOrEqual(1)

    const changes = await cueRepo.listAutomatedChangesByApprovalStatus({
      approval_status: 'pending',
    })
    expect(changes.length).toBeGreaterThanOrEqual(1)
    expect(changes[0]!.source).toBe('automated')
    expect(changes[0]!.approval_status).toBe('pending')
    expect(changes[0]!.trigger_id).toBeTruthy()
    expect(changes[0]!.change_type).toBe('create_cue')
    expect(changes[0]!.risk_level).toBe('standard')
    expect(changes[0]!.actor_user_id).toBeNull()
  })

  it('emits proposalsWritten=0 when editor short-circuits', async () => {
    const cueRepo = new InMemoryCueRepository()
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const loadSignalService = buildLoadStub('green')
    const detector = new TriggerDetector(
      {
        postRepo: buildPostRepoStub(0),
        loadSignalService,
        triggerRepo,
        now: () => PRIME_NOW,
      },
    )
    const loadGate = new LoadGate({ loadSignalService })
    const editor = buildEditor([
      { ok: false, reason: 'short_circuit', attempts: 0 },
      { ok: false, reason: 'short_circuit', attempts: 0 },
    ])
    const scheduler = new AutoCueEditorScheduler({
      triggerDetector: detector,
      loadGate,
      autoCueEditor: editor,
      cueRepo,
      communityProvider: async () => ['community-1'],
      now: () => PRIME_NOW,
    })
    const result = await scheduler.tick()
    expect(result.proposalsWritten).toBe(0)
    const changes = await cueRepo.listAutomatedChangesByApprovalStatus({
      approval_status: 'pending',
    })
    expect(changes).toHaveLength(0)
  })

  it('isolates per-community failures (one community throwing does not abort the tick)', async () => {
    const cueRepo = new InMemoryCueRepository()
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const loadSignalService = buildLoadStub('green')
    const detector = {
      scanCommunity: vi.fn(async (cid: string) => {
        if (cid === 'community-bad') throw new Error('boom')
        return [{
          id: 'trigger-x',
          community_id: cid,
          trigger_type: 'COMMUNITY_LULL',
          severity: 'standard',
          source: 'scan',
          evidence: {},
          dedup_key: `COMMUNITY_LULL:${cid}:q1`,
          detected_at: PRIME_NOW,
          created_at: PRIME_NOW,
        }]
      }),
    } as unknown as TriggerDetector
    const loadGate = new LoadGate({ loadSignalService })
    const editor = buildHappyEditorStub()
    const scheduler = new AutoCueEditorScheduler({
      triggerDetector: detector,
      loadGate,
      autoCueEditor: editor,
      cueRepo,
      communityProvider: async () => ['community-bad', 'community-good'],
      now: () => PRIME_NOW,
    })
    const result = await scheduler.tick()
    expect(result.errors).toBe(1)
    expect(result.proposalsWritten).toBe(1)
    const changes = await cueRepo.listAutomatedChangesByApprovalStatus({
      approval_status: 'pending',
    })
    expect(changes).toHaveLength(1)
    void triggerRepo
  })

  it('respects the leader elector — non-leader skips entire tick', async () => {
    const cueRepo = new InMemoryCueRepository()
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const loadSignalService = buildLoadStub('green')
    const detector = new TriggerDetector(
      {
        postRepo: buildPostRepoStub(0),
        loadSignalService,
        triggerRepo,
        now: () => PRIME_NOW,
      },
    )
    const loadGate = new LoadGate({ loadSignalService })
    const editor = buildHappyEditorStub()
    const scheduler = new AutoCueEditorScheduler({
      triggerDetector: detector,
      loadGate,
      autoCueEditor: editor,
      cueRepo,
      communityProvider: async () => ['community-1'],
      leaderElector: {
        ensureLeadership: async () => false,
        releaseLeadership: async () => {},
        get isLeader() { return false },
      },
      now: () => PRIME_NOW,
    })
    const result = await scheduler.tick()
    expect(result.triggersDetected).toBe(0)
    expect(result.proposalsWritten).toBe(0)
  })

  it('invokes onPatchProposed when a row is written', async () => {
    const cueRepo = new InMemoryCueRepository()
    const triggerRepo = new InMemoryAutoEditorTriggerEventRepository()
    const loadSignalService = buildLoadStub('green')
    const detector = new TriggerDetector(
      {
        postRepo: buildPostRepoStub(0),
        loadSignalService,
        triggerRepo,
        now: () => PRIME_NOW,
      },
    )
    const loadGate = new LoadGate({ loadSignalService })
    const editor = buildHappyEditorStub()
    const onPatchProposed = vi.fn()
    const scheduler = new AutoCueEditorScheduler({
      triggerDetector: detector,
      loadGate,
      autoCueEditor: editor,
      cueRepo,
      communityProvider: async () => ['community-1'],
      onPatchProposed,
      now: () => PRIME_NOW,
    })
    await scheduler.tick()
    expect(onPatchProposed).toHaveBeenCalled()
    expect(onPatchProposed.mock.calls[0]?.[0]).toMatchObject({
      changeId: expect.any(String),
    })
  })
})

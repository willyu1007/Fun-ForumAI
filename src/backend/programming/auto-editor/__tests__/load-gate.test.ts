import { describe, expect, it } from 'vitest'
import { LoadGate } from '../load-gate.js'
import type {
  LoadSignalService,
  LoadSignalSnapshot,
} from '../../../services/load-signal-service.js'
import type { LoadState } from '../../load/types.js'

function buildSignalServiceStub(state: LoadState): LoadSignalService {
  return {
    async get(communityId: string): Promise<LoadSignalSnapshot> {
      return {
        status: state,
        community_id: communityId,
        trigger_at_iso: null,
        source: 'load_signal_service:cached',
      }
    },
  }
}

describe('LoadGate.evaluate — load-state to action envelope', () => {
  it('green → full surface, propose_only=false, no short circuit', async () => {
    const gate = new LoadGate({ loadSignalService: buildSignalServiceStub('green') })
    const decision = await gate.evaluate({ communityId: 'community-1' })
    expect(decision.load_state).toBe('green')
    expect(decision.propose_only).toBe(false)
    expect(decision.short_circuit).toBe(false)
    expect(decision.reason_code).toBe('green_full_surface')
    expect(decision.allowed_actions).toContain('create_cue')
    expect(decision.allowed_actions).toContain('attach_media')
  })

  it('yellow → triage shapes only, propose_only=false', async () => {
    const gate = new LoadGate({ loadSignalService: buildSignalServiceStub('yellow') })
    const decision = await gate.evaluate({ communityId: 'community-1' })
    expect(decision.load_state).toBe('yellow')
    expect(decision.propose_only).toBe(false)
    expect(decision.short_circuit).toBe(false)
    expect(decision.reason_code).toBe('yellow_triage_only')
    expect(decision.allowed_actions).not.toContain('create_cue')
    expect(decision.allowed_actions).toContain('cancel_cue')
  })

  it('red → only triage shapes + propose_only=true (overview §34)', async () => {
    const gate = new LoadGate({ loadSignalService: buildSignalServiceStub('red') })
    const decision = await gate.evaluate({ communityId: 'community-1' })
    expect(decision.load_state).toBe('red')
    expect(decision.propose_only).toBe(true)
    // Red still has triage shapes, so not a short-circuit:
    expect(decision.short_circuit).toBe(false)
    expect(decision.reason_code).toBe('red_propose_only')
    expect([...decision.allowed_actions].sort()).toEqual([
      'cancel_cue',
      'defer_cue',
      'merge_into_existing_cue',
    ])
  })

  it('forwards trigger_at_iso to LoadSignalService and surfaces source code', async () => {
    let observedTriggerIso: string | null | undefined
    const stub: LoadSignalService = {
      async get(communityId, triggerAtIso) {
        observedTriggerIso = triggerAtIso
        return {
          status: 'green',
          community_id: communityId,
          trigger_at_iso: triggerAtIso ?? null,
          source: 'load_signal_service:cached',
        }
      },
    }
    const gate = new LoadGate({ loadSignalService: stub })
    const decision = await gate.evaluate({
      communityId: 'community-1',
      triggerAtIso: '2026-04-26T20:00:00Z',
    })
    expect(observedTriggerIso).toBe('2026-04-26T20:00:00Z')
    expect(decision.load_signal_source).toBe('load_signal_service:cached')
  })

  it('deriveDecision — pure function path that bypasses LoadSignalService', () => {
    const gate = new LoadGate({ loadSignalService: buildSignalServiceStub('green') })
    const decision = gate.deriveDecision({
      loadState: 'red',
      communityId: 'community-1',
      loadSignalSource: 'admission_load_service:live',
    })
    expect(decision.load_state).toBe('red')
    expect(decision.propose_only).toBe(true)
    expect(decision.load_signal_source).toBe('admission_load_service:live')
  })
})

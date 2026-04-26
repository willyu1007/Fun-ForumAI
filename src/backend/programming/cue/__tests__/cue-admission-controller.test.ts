/**
 * T-212 M3 — CueAdmissionController three-step short-circuit + reservation
 * lifecycle (R4).
 */

import { describe, it, expect } from 'vitest'
import { CueAdmissionController } from '../cue-admission-controller.js'
import { InProcessTrivialCommunityBudgetService } from '../../../services/community-budget-service.js'
import { loadSignalServiceStub } from '../../../services/__stubs__/load-signal-service-stub.js'
import type { PublicDiscussionCueDomain } from '../types.js'
import type {
  CommunityBudgetAcquireResult,
  CommunityBudgetService,
} from '../../../services/community-budget-service.js'
import type { LoadSignalService } from '../../../services/__stubs__/load-signal-service-stub.js'

function makeCue(overrides: Partial<PublicDiscussionCueDomain> = {}): PublicDiscussionCueDomain {
  return {
    id: 'cue_1',
    schedule_id: 'sched_1',
    source_type: 'manual',
    status: 'scheduled',
    community_id: 'c1',
    scope: { mode: 'single', community_id: 'c1' },
    trigger_at: '2026-04-26T20:30:00.000Z',
    timezone: 'Asia/Shanghai',
    priority: 50,
    lane: 'standard',
    dispatch_policy: {
      trigger_at: '2026-04-26T20:30:00.000Z',
      timezone: 'Asia/Shanghai',
      dispatch_mode: 'graceful',
      grace_seconds: 60,
      priority: 50,
      lane: 'standard',
      misfire_policy: 'delay',
      max_attempts: 3,
      retry_backoff_seconds: 30,
    },
    theme_intent: { topic_seed: 'topic' },
    scene_constraints: {
      community_scope: { mode: 'single', community_id: 'c1' },
      public_stage_scope: ['forum'],
      privacy_policy: 'public_only',
      private_reference_policy: 'forbidden',
      safety_profile: 'standard',
    },
    role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
    locked_fields: [],
    risk_level: 'standard',
    revision: 1,
    idempotency_key: 'cue:sched_1:pending-x:0',
    created_at: '2026-04-26T19:00:00.000Z',
    updated_at: '2026-04-26T19:00:00.000Z',
    ...overrides,
  }
}

function alwaysAllowGrowthGate() {
  return {
    getRuntimeBaselineAdmission: async () => ({
      allow_public_growth: true,
      reasons: [],
    }),
  }
}

function deniedGrowthGate(reasons: string[] = ['warmup_layer_not_ready']) {
  return {
    getRuntimeBaselineAdmission: async () => ({
      allow_public_growth: false,
      reasons,
    }),
  }
}

const NOW = new Date('2026-04-26T20:30:00.000Z')

describe('CueAdmissionController — happy path', () => {
  it('admits when budget grants, growth allows, load is green', async () => {
    const budget = new InProcessTrivialCommunityBudgetService()
    const ctrl = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: alwaysAllowGrowthGate(),
      loadSignalService: loadSignalServiceStub,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.granted).toBe(true)
    expect(evaluation.result.decision).toBe('admit')
    expect(evaluation.result.reason_codes).toContain('load_green')
    expect(evaluation.reservation?.path).toBe('cue')
    // Reservation handed to caller — still tracked by budget
    const snapshot = await budget.query('c1')
    expect(snapshot.cue_used_today).toBe(1)
  })

  it('admits with degraded_media flag when load is yellow', async () => {
    const yellowLoad: LoadSignalService = {
      async get(communityId, triggerAtIso) {
        return {
          status: 'yellow',
          community_id: communityId,
          trigger_at_iso: triggerAtIso ?? null,
          source: 'stub_until_t213',
        }
      },
    }
    const budget = new InProcessTrivialCommunityBudgetService()
    const ctrl = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: alwaysAllowGrowthGate(),
      loadSignalService: yellowLoad,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.granted).toBe(true)
    expect(evaluation.result.decision).toBe('admit')
    expect(evaluation.result.degraded_media).toBe(true)
    expect(evaluation.reservation).toBeDefined()
  })
})

describe('CueAdmissionController — short-circuit at budget', () => {
  it('defers when budget is exhausted and includes retry_after as recommended_next_trigger_at', async () => {
    const exhaustedBudget: CommunityBudgetService = {
      async acquire(): Promise<CommunityBudgetAcquireResult> {
        return { granted: false, reason: 'budget_exhausted', retry_after_ms: 30_000 }
      },
      async release() {},
      async query() {
        return {
          communityId: 'c1',
          daily_remaining: 0,
          window_remaining: 0,
          autonomous_used_today: 0,
          cue_used_today: 0,
        }
      },
    }
    const ctrl = new CueAdmissionController({
      communityBudgetService: exhaustedBudget,
      publicGrowthGate: alwaysAllowGrowthGate(),
      loadSignalService: loadSignalServiceStub,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.decision).toBe('defer')
    expect(evaluation.result.reason_codes).toContain('budget_budget_exhausted')
    expect(evaluation.result.recommended_next_trigger_at).toBe(
      new Date(NOW.getTime() + 30_000).toISOString(),
    )
    expect(evaluation.reservation).toBeUndefined()
  })

  it('defers with default retry backoff when budget service does not return retry_after_ms', async () => {
    const rateLimited: CommunityBudgetService = {
      async acquire() {
        return { granted: false, reason: 'rate_limited' }
      },
      async release() {},
      async query() {
        return {
          communityId: 'c1',
          daily_remaining: 0,
          window_remaining: 0,
          autonomous_used_today: 0,
          cue_used_today: 0,
        }
      },
    }
    const ctrl = new CueAdmissionController({
      communityBudgetService: rateLimited,
      publicGrowthGate: alwaysAllowGrowthGate(),
      loadSignalService: loadSignalServiceStub,
      defaultBudgetRetryBackoffSeconds: 90,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.decision).toBe('defer')
    expect(evaluation.result.recommended_next_trigger_at).toBe(
      new Date(NOW.getTime() + 90_000).toISOString(),
    )
  })
})

describe('CueAdmissionController — short-circuit at growth gate', () => {
  it('defers and releases the reservation when growth gate denies', async () => {
    const budget = new InProcessTrivialCommunityBudgetService()
    const ctrl = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: deniedGrowthGate(['kickoff_layer_not_ready']),
      loadSignalService: loadSignalServiceStub,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.decision).toBe('defer')
    expect(evaluation.result.reason_codes).toEqual([
      'growth_gate:kickoff_layer_not_ready',
    ])
    expect(evaluation.reservation).toBeUndefined()
  })

  it('defers with growth_gate:blocked when growth denies without reasons', async () => {
    const budget = new InProcessTrivialCommunityBudgetService()
    const ctrl = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: deniedGrowthGate([]),
      loadSignalService: loadSignalServiceStub,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.reason_codes).toEqual(['growth_gate:blocked'])
  })
})

describe('CueAdmissionController — short-circuit at load', () => {
  it('defers and releases the reservation when load is red', async () => {
    const redLoad: LoadSignalService = {
      async get(communityId, triggerAtIso) {
        return {
          status: 'red',
          community_id: communityId,
          trigger_at_iso: triggerAtIso ?? null,
          source: 'stub_until_t213',
        }
      },
    }
    const budget = new InProcessTrivialCommunityBudgetService()
    const ctrl = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: alwaysAllowGrowthGate(),
      loadSignalService: redLoad,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.decision).toBe('defer')
    expect(evaluation.result.reason_codes).toEqual(['load_red'])
    expect(evaluation.reservation).toBeUndefined()
  })

  it('defers and releases the reservation when load signal throws', async () => {
    const throwingLoad: LoadSignalService = {
      async get() {
        throw new Error('boom')
      },
    }
    const budget = new InProcessTrivialCommunityBudgetService()
    const ctrl = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: alwaysAllowGrowthGate(),
      loadSignalService: throwingLoad,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.decision).toBe('defer')
    expect(evaluation.result.reason_codes[0]).toMatch(/^load_signal_error:boom/)
    expect(evaluation.reservation).toBeUndefined()
  })
})

describe('CueAdmissionController — degenerate inputs', () => {
  it('skips a cue with no resolvable community (no reservation acquired)', async () => {
    const budget = new InProcessTrivialCommunityBudgetService()
    const ctrl = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: alwaysAllowGrowthGate(),
      loadSignalService: loadSignalServiceStub,
    })
    const cueWithoutCommunity = makeCue({
      community_id: undefined,
      scope: { mode: 'runtime_select' },
    })
    const evaluation = await ctrl.evaluate({ cue: cueWithoutCommunity, now: NOW })
    expect(evaluation.result.decision).toBe('skip')
    expect(evaluation.result.reason_codes).toEqual(['cue_missing_community_id'])
    expect(evaluation.reservation).toBeUndefined()
    // Ensure no reservation was acquired (counter stayed at 0)
    const snapshot = await budget.query('c1')
    expect(snapshot.cue_used_today).toBe(0)
  })
})

describe('CueAdmissionController — reservation release semantics (R4)', () => {
  it('does NOT release the reservation on admit (caller owns it)', async () => {
    const budget = new InProcessTrivialCommunityBudgetService()
    let releaseCalls = 0
    const wrapper: CommunityBudgetService = {
      acquire: budget.acquire.bind(budget),
      release: async (id) => {
        releaseCalls += 1
        await budget.release(id)
      },
      query: budget.query.bind(budget),
    }
    const ctrl = new CueAdmissionController({
      communityBudgetService: wrapper,
      publicGrowthGate: alwaysAllowGrowthGate(),
      loadSignalService: loadSignalServiceStub,
    })
    const evaluation = await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(evaluation.result.granted).toBe(true)
    expect(releaseCalls).toBe(0)
    expect(evaluation.reservation).toBeDefined()
  })

  it('DOES release the reservation when growth gate or load defers', async () => {
    const budget = new InProcessTrivialCommunityBudgetService()
    let releaseCalls = 0
    const wrapper: CommunityBudgetService = {
      acquire: budget.acquire.bind(budget),
      release: async (id) => {
        releaseCalls += 1
        await budget.release(id)
      },
      query: budget.query.bind(budget),
    }
    const ctrl = new CueAdmissionController({
      communityBudgetService: wrapper,
      publicGrowthGate: deniedGrowthGate(),
      loadSignalService: loadSignalServiceStub,
    })
    await ctrl.evaluate({ cue: makeCue(), now: NOW })
    expect(releaseCalls).toBe(1)
  })
})

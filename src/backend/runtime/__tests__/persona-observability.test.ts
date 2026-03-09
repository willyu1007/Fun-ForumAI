import { beforeEach, describe, expect, it } from 'vitest'
import { evaluatePersonaRolloutGates, personaObservability } from '../persona-observability.js'

describe('persona observability rollout gates', () => {
  beforeEach(() => {
    personaObservability.reset()
  })

  it('passes healthy context-memory rollout metrics', () => {
    personaObservability.recordPublicIngress('forum')
    personaObservability.recordTypedWrite(true)
    personaObservability.recordIdentityWrite(true)
    personaObservability.recordRetrieval({
      publicObservationSource: 'typed',
      usedLegacyFallback: false,
    })
    personaObservability.recordNightlyCompaction({
      created: true,
      dedupHit: false,
      failed: false,
    })

    const snapshot = personaObservability.snapshot()
    expect(snapshot.rollout_gates.every((gate) => gate.status === 'pass')).toBe(true)
  })

  it('blocks unhealthy rollout metrics', () => {
    const gates = evaluatePersonaRolloutGates({
      public_ingress: {
        forum_total: 4,
        chat_room_total: 2,
      },
      typed_writes: {
        success_total: 9,
        failure_total: 2,
      },
      identity_writes: {
        success_total: 8,
        failure_total: 2,
      },
      retrieval: {
        total: 10,
        public_typed_hits: 5,
        public_legacy_hits: 5,
        legacy_fallback_total: 3,
      },
      migration: {
        public_dedup_legacy_fallbacks: 1,
        public_cooldown_legacy_fallbacks: 1,
        public_dual_write_total: 4,
      },
      nightly_compaction: {
        runs_total: 3,
        created_total: 1,
        dedup_hits_total: 1,
        failure_total: 1,
      },
      updated_at: new Date().toISOString(),
    })

    expect(gates.find((gate) => gate.id === 'typed_write_success')?.status).toBe('block')
    expect(gates.find((gate) => gate.id === 'identity_write_success')?.status).toBe('block')
    expect(gates.find((gate) => gate.id === 'public_typed_read_path')?.status).toBe('block')
    expect(gates.find((gate) => gate.id === 'legacy_dependency')?.status).toBe('block')
    expect(gates.find((gate) => gate.id === 'nightly_compaction')?.status).toBe('block')
  })
})

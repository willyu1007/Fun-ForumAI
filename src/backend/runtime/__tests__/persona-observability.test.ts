import { beforeEach, describe, expect, it } from 'vitest'
import { evaluatePersonaRolloutGates, personaObservability } from '../persona-observability.js'

describe('persona observability rollout gates', () => {
  beforeEach(() => {
    personaObservability.setRepository(null)
    personaObservability.reset()
  })

  it('passes healthy context-memory rollout metrics', () => {
    personaObservability.recordPublicIngress('forum')
    personaObservability.recordTypedWrite(true)
    personaObservability.recordIdentityWrite(true)
    personaObservability.recordRetrieval({
      publicObservationSource: 'typed',
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
      },
      migration: {
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
    expect(gates.find((gate) => gate.id === 'nightly_compaction')?.status).toBe('block')
  })

  it('aggregates rollout metrics from the persistent repository when configured', async () => {
    personaObservability.setRepository({
      async increment() {},
      async snapshot() {
        return {
          public_ingress: {
            forum_total: 2,
            chat_room_total: 0,
          },
          typed_writes: {
            success_total: 2,
            failure_total: 0,
          },
          identity_writes: {
            success_total: 2,
            failure_total: 0,
          },
          retrieval: {
            total: 2,
            public_typed_hits: 2,
          },
          migration: {
            public_dual_write_total: 1,
          },
          nightly_compaction: {
            runs_total: 1,
            created_total: 0,
            dedup_hits_total: 1,
            failure_total: 0,
          },
          updated_at: new Date().toISOString(),
        }
      },
      async reset() {},
    })

    const snapshot = await personaObservability.snapshotAggregated()
    expect(snapshot.context_memory.retrieval.public_typed_hits).toBe(2)
    expect(snapshot.rollout_gates.find((gate) => gate.id === 'public_typed_read_path')?.status).toBe('pass')
  })
})

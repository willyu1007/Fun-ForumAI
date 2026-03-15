import { config } from '../../lib/config.js'
import type { EvidenceRef } from '../../repos/types.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import {
  average,
  buildNightlyCompactionSummary,
  clamp01,
  compactEpisodicCards,
  listAllEpisodicCards,
} from './maintenance.js'
import {
  DECAY_FACTOR_PER_DAY,
  FORGET_THRESHOLD,
  NIGHTLY_COMPACTION_MIN_CARDS,
  NIGHTLY_SHADOW_KEEP,
  NIGHTLY_TENSION_DECAY,
  NIGHTLY_TENSION_FORGET_THRESHOLD,
} from './constants.js'
import type { MemoryServiceDeps } from './types.js'

export async function decayAndForget(
  deps: MemoryServiceDeps,
  agentId: string,
): Promise<{ decayed: number; forgotten: number }> {
  let decayPerDay = DECAY_FACTOR_PER_DAY
  let forgetThreshold = FORGET_THRESHOLD

  if (config.features.agentStatsBehavior && deps.statsService) {
    const knobs = deps.statsService.getDerivedSync(agentId)
    decayPerDay = knobs.memory.decay_per_day
    forgetThreshold = knobs.memory.forget_threshold
  }

  const decayed = await deps.memoryRepo.batchDecay(agentId, decayPerDay)

  const allActive = await deps.memoryRepo.findActiveMemories(agentId, {})
  let forgotten = 0
  for (const memory of allActive) {
    const boost = Math.log2(memory.access_count + 1) * 0.02
    const effective = memory.importance_score + boost
    if (effective < forgetThreshold) {
      await deps.memoryRepo.markForgotten(memory.id)
      forgotten += 1
    }
  }

  if (deps.contextMemory) {
    await runTypedNightlyMaintenance(deps, agentId)
  }

  return { decayed, forgotten }
}

async function runTypedNightlyMaintenance(
  deps: MemoryServiceDeps,
  agentId: string,
): Promise<void> {
  const runtime = deps.contextMemory
  if (!runtime) return

  try {
    const [allCards, shadows, tensions, selfModel] = await Promise.all([
      listAllEpisodicCards({ runtime, agentId }),
      runtime.privateShadowRepo.listByAgent(agentId, 12),
      runtime.activeTensionRepo.listByAgent(agentId, 10),
      runtime.selfModelStateRepo.findByAgent(agentId),
    ])

    const now = new Date()
    const compacted = compactEpisodicCards(allCards, now)
    const nextTensions = tensions
      .map((item) => ({
        id: item.id,
        agent_id: item.agent_id,
        label: item.label,
        description: item.description,
        intensity: clamp01(item.intensity * NIGHTLY_TENSION_DECAY),
        evidence_refs: [...item.evidence_refs],
      }))
      .filter((item) => item.intensity >= NIGHTLY_TENSION_FORGET_THRESHOLD)
      .slice(0, 5)

    await Promise.all(
      compacted.kept.map((card) =>
        runtime.episodicCardRepo.upsert({
          id: card.id,
          agent_id: card.agent_id,
          event_id: card.event_id,
          scene: card.scene,
          title: card.title,
          summary: card.summary,
          topic_tags: card.topic_tags,
          evidence_refs: card.evidence_refs,
          salience: card.salience,
          created_at: card.created_at,
        }),
      ),
    )

    if (compacted.prunedIds.length > 0) {
      await runtime.episodicCardRepo.pruneByIds(agentId, compacted.prunedIds)
    }

    await runtime.activeTensionRepo.replaceForAgent(agentId, nextTensions)

    if (selfModel) {
      await runtime.selfModelStateRepo.upsert({
        id: selfModel.id,
        agent_id: selfModel.agent_id,
        summary: selfModel.summary,
        tensions: nextTensions.map((item) => item.label),
        evidence_refs: selfModel.evidence_refs,
      })
    }

    const shadowPrunedIds = shadows.slice(NIGHTLY_SHADOW_KEEP).map((item) => item.id)
    if (shadowPrunedIds.length > 0) {
      await runtime.privateShadowRepo.pruneByIds(agentId, shadowPrunedIds)
    }

    let compactionCreated = false
    let compactionDedupHit = false
    if (runtime.chronicleRepo && compacted.mergeCandidates.length >= NIGHTLY_COMPACTION_MIN_CARDS) {
      const dedupKey = `context-nightly:${agentId}:${now.toISOString().slice(0, 10)}`
      const existing = await runtime.chronicleRepo.findByDedupKey(agentId, dedupKey)
      if (existing) {
        compactionDedupHit = true
      } else {
        const evidence = compacted.mergeCandidates
          .slice(0, 5)
          .map((card) => ({
            kind: 'context_episode',
            ref_id: card.id,
            summary: card.title,
          } satisfies EvidenceRef))
        await runtime.chronicleRepo.create({
          agent_id: agentId,
          visibility: 'OWNER_ONLY',
          type: 'HIGHLIGHT',
          occurred_at: now,
          title: 'Nightly Context Compaction',
          summary: buildNightlyCompactionSummary(compacted.mergeCandidates),
          importance_score:
            clamp01(average(compacted.mergeCandidates.map((card) => card.salience)) + 0.05),
          evidence,
          tags: [
            'context:nightly',
            'context:compaction',
            ...Array.from(new Set(compacted.mergeCandidates.map((card) => `scene:${card.scene}`))),
          ],
          meta: {
            source: 'context_memory_nightly',
            event_ids: compacted.mergeCandidates
              .map((card) => card.event_id)
              .filter((value): value is string => Boolean(value)),
          },
          dedup_key: dedupKey,
        })
        compactionCreated = true
      }
    }

    personaObservability.recordNightlyCompaction({
      created: compactionCreated,
      dedupHit: compactionDedupHit,
      failed: false,
    })
  } catch (error) {
    personaObservability.recordNightlyCompaction({
      created: false,
      dedupHit: false,
      failed: true,
    })
    throw error
  }
}

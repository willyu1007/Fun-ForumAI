import type { AchievementVisibility, EvidenceRef } from '../../repos/types.js'
import type { AchievementSignalKind } from './definitions.js'

export interface ChronicleSignalDecision {
  visibility: AchievementVisibility
  reason: string
}

export interface ResolveSignalVisibilityInput {
  kind: AchievementSignalKind
  evidence: EvidenceRef[]
  importanceScore: number
}

const ALWAYS_OWNER_ONLY = new Set<AchievementSignalKind>([
  'private_digest',
  'governance',
])

const PUBLIC_EVIDENCE_KINDS = new Set<string>([
  'post',
  'thread',
  'turn',
  'thread_turn',
  'vote',
  'relation',
  'chronicle',
  'cross_scene',
  'activity',
])

const PUBLIC_SIGNAL_THRESHOLD = 0.72

export class ChronicleSignalPolicy {
  resolve(input: ResolveSignalVisibilityInput): ChronicleSignalDecision {
    if (ALWAYS_OWNER_ONLY.has(input.kind)) {
      return {
        visibility: 'OWNER_ONLY',
        reason: 'always_owner_only_kind',
      }
    }

    if (input.importanceScore < PUBLIC_SIGNAL_THRESHOLD) {
      return {
        visibility: 'OWNER_ONLY',
        reason: 'below_public_importance_threshold',
      }
    }

    const hasPublicEvidence = input.evidence.some((item) => PUBLIC_EVIDENCE_KINDS.has(item.kind))
    if (!hasPublicEvidence) {
      return {
        visibility: 'OWNER_ONLY',
        reason: 'missing_public_evidence',
      }
    }

    return {
      visibility: 'PUBLIC',
      reason: 'public_signal_eligible',
    }
  }
}

import type {
  LlmRegistryBundle,
  ModelProfileCandidate,
  ModelProfileEntry,
  ProviderAdmissionCandidateEntry,
  ProviderAdmissionPoolEntry,
} from './registry-loader.js'
import { LLMGatewayContractError } from './gateway-contract.js'

export interface ProviderAdmissionFilterResult {
  admittedCandidates: ModelProfileCandidate[]
  filteredCounts: {
    shadow: number
    blocked: number
  }
}

export interface ProviderAdmissionSummary {
  totals: {
    admitted: number
    shadow: number
    blocked: number
  }
  by_voice_line: Array<{
    voice_line_id: string
    core_family: string
    compare_dimensions: string[]
    admitted: number
    shadow: number
    blocked: number
  }>
}

export function filterVisibleProfileCandidates(
  bundle: LlmRegistryBundle,
  profile: ModelProfileEntry,
): ProviderAdmissionFilterResult {
  const pool = getAdmissionPool(bundle, profile.voice_line_id)
  const filteredCounts = { shadow: 0, blocked: 0 }

  const admittedCandidates = profile.candidates.filter((candidate) => {
    const admission = findAdmissionEntry(pool, candidate.provider_id, candidate.model_id)
    if (!admission) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        'Visible candidate is missing provider admission metadata',
        {
          profile_id: profile.profile_id,
          voice_line_id: profile.voice_line_id,
          provider_id: candidate.provider_id,
          model_id: candidate.model_id,
        },
      )
    }
    if (admission.admission === 'shadow') {
      filteredCounts.shadow += 1
      return false
    }
    if (admission.admission === 'blocked') {
      filteredCounts.blocked += 1
      return false
    }
    return true
  })

  return {
    admittedCandidates,
    filteredCounts,
  }
}

export function summarizeProviderAdmission(bundle: LlmRegistryBundle): ProviderAdmissionSummary {
  const byVoiceLine = bundle.providerAdmission.pools.map((pool) => {
    const admitted = pool.candidates.filter(
      (candidate) => candidate.admission === 'admitted',
    ).length
    const shadow = pool.candidates.filter((candidate) => candidate.admission === 'shadow').length
    const blocked = pool.candidates.filter((candidate) => candidate.admission === 'blocked').length
    return {
      voice_line_id: pool.voice_line_id,
      core_family: pool.core_family,
      compare_dimensions: [...pool.compare_dimensions],
      admitted,
      shadow,
      blocked,
    }
  })

  return {
    totals: {
      admitted: byVoiceLine.reduce((sum, entry) => sum + entry.admitted, 0),
      shadow: byVoiceLine.reduce((sum, entry) => sum + entry.shadow, 0),
      blocked: byVoiceLine.reduce((sum, entry) => sum + entry.blocked, 0),
    },
    by_voice_line: byVoiceLine,
  }
}

function getAdmissionPool(
  bundle: LlmRegistryBundle,
  voiceLineId: string,
): ProviderAdmissionPoolEntry {
  const pool = bundle.providerAdmission.pools.find((entry) => entry.voice_line_id === voiceLineId)
  if (!pool) {
    throw new LLMGatewayContractError(
      'RegistryResolutionError',
      'Visible voice line is missing a provider admission pool',
      { voice_line_id: voiceLineId },
    )
  }
  return pool
}

function findAdmissionEntry(
  pool: ProviderAdmissionPoolEntry,
  providerId: string,
  modelId: string,
): ProviderAdmissionCandidateEntry | null {
  return (
    pool.candidates.find(
      (entry) => entry.provider_id === providerId && entry.model_id === modelId,
    ) ?? null
  )
}

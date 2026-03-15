import { ValidationError } from '../../lib/errors.js'
import type { AgentPrivacySettingsEntity, MemoryServiceDeps } from './types.js'

export async function getPrivacySettings(
  deps: MemoryServiceDeps,
  agentId: string,
): Promise<AgentPrivacySettingsEntity> {
  const settings = await deps.memoryRepo.getPrivacySettings(agentId)
  if (settings) return settings
  return {
    agent_id: agentId,
    disclosure_level: 1,
    public_memory_budget: 1000,
    public_memory_top_k: 4,
    public_disclosure_cap: null,
    updated_at: new Date(),
    updated_by: '',
  }
}

export async function updatePrivacySettings(
  deps: MemoryServiceDeps,
  agentId: string,
  updatedBy: string,
  changes: {
    disclosure_level?: number
    public_memory_budget?: number
    public_memory_top_k?: number
    public_disclosure_cap?: number | null
  },
): Promise<AgentPrivacySettingsEntity> {
  if (changes.disclosure_level !== undefined) {
    if (changes.disclosure_level < 0 || changes.disclosure_level > 3) {
      throw new ValidationError('disclosure_level must be 0-3')
    }
  }
  if (
    changes.public_disclosure_cap !== undefined &&
    changes.public_disclosure_cap !== null &&
    (changes.public_disclosure_cap < 0 || changes.public_disclosure_cap > 3)
  ) {
    throw new ValidationError('public_disclosure_cap must be 0-3 or null')
  }
  return deps.memoryRepo.upsertPrivacySettings({
    agent_id: agentId,
    ...changes,
    updated_by: updatedBy,
  })
}

export function resolveEffectiveDisclosureLevel(settings: AgentPrivacySettingsEntity): {
  requested_disclosure_level: number
  effective_disclosure_level: number
  cap_source: 'owner_setting' | 'server_cap'
  public_disclosure_cap: number | null
  server_cap_sources?: Array<{
    source_type: 'baseline'
    scope_type: 'agent'
    scope_id: string | null
    cap_level: number
    source: 'agent_privacy_settings'
  }>
} {
  const requested = settings.disclosure_level
  const effective =
    settings.public_disclosure_cap === null
      ? requested
      : Math.min(requested, settings.public_disclosure_cap)
  return {
    requested_disclosure_level: requested,
    effective_disclosure_level: effective,
    cap_source: settings.public_disclosure_cap === null ? 'owner_setting' : 'server_cap',
    public_disclosure_cap: settings.public_disclosure_cap,
    ...(settings.public_disclosure_cap !== null
      ? {
          server_cap_sources: [
            {
              source_type: 'baseline' as const,
              scope_type: 'agent' as const,
              scope_id: settings.agent_id,
              cap_level: settings.public_disclosure_cap,
              source: 'agent_privacy_settings' as const,
            },
          ],
        }
      : {}),
  }
}

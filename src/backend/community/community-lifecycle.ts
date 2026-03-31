import type {
  Community,
  CommunityIncubationVisibilityMode,
  CommunityLifecycleState,
} from '../repos/index.js'

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function resolveCommunityLifecycleState(
  rulesJson: Record<string, unknown> | null | undefined,
): CommunityLifecycleState | null {
  const raw = rulesJson?.community_lifecycle_state
  return typeof raw === 'string' ? raw as CommunityLifecycleState : null
}

export function resolveCommunityIncubationVisibilityMode(
  rulesJson: Record<string, unknown> | null | undefined,
): CommunityIncubationVisibilityMode | null {
  const governance = toRecord(rulesJson?.governance_policy)
  const raw = governance?.incubation_visibility_mode
  return typeof raw === 'string' ? raw as CommunityIncubationVisibilityMode : null
}

export function isCommunityVisibleInDirectory(
  community: Pick<Community, 'rules_json'>,
  viewerRole?: 'admin' | 'user' | null,
): boolean {
  const lifecycle = resolveCommunityLifecycleState(community.rules_json)
  if (lifecycle === 'merged' || lifecycle === 'archived' || lifecycle === 'dormant') {
    return false
  }
  if (lifecycle === 'incubating_gray') {
    const mode = resolveCommunityIncubationVisibilityMode(community.rules_json)
    if (mode === 'WHITELIST_ONLY') {
      return viewerRole === 'admin'
    }
  }
  return true
}

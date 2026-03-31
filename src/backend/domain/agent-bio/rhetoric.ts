import type { AgentBioWorldviewModel, BioRhetoricFamily } from './types.js'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function computePreferredRhetoricFamilies(worldview: AgentBioWorldviewModel): {
  preferred_families: BioRhetoricFamily[]
  family_weights: Partial<Record<BioRhetoricFamily, number>>
} {
  const weights: Record<BioRhetoricFamily, number> = {
    stance: 0.58,
    phase_shadow: 0.36,
    side_profile: 0.56,
    contrast: 0.44,
  }

  const persona = worldview.identity.persona_seed_label
  if (/毒舌/u.test(persona)) {
    weights.contrast += 0.42
    weights.stance -= 0.02
  } else if (/段子手/u.test(persona)) {
    weights.side_profile += 0.26
    weights.contrast += 0.12
  } else if (/暖心|和事佬/u.test(persona)) {
    weights.phase_shadow += 0.1
    weights.side_profile += 0.2
  } else if (/哲学|学者/u.test(persona)) {
    weights.phase_shadow += /哲学/u.test(persona) ? 0.32 : 0.08
    weights.stance += /学者/u.test(persona) ? 0.1 : -0.06
    weights.contrast += /哲学/u.test(persona) ? 0.18 : 0.08
  }

  switch (worldview.presence.bucket) {
    case 'quiet':
    case 'reflective':
      weights.phase_shadow += 0.12
      weights.side_profile += 0.06
      break
    case 'warming':
    case 'emerging':
      weights.stance += 0.16
      weights.side_profile += 0.14
      break
    default:
      weights.side_profile += 0.08
      break
  }

  if ((worldview.relations.mutual_effective ?? 0) > 0) {
    weights.side_profile += 0.18
  }
  if ((worldview.persona_state.drift_score ?? 0) >= 0.55) {
    weights.contrast += 0.18
  }
  if ((worldview.persona_state.confidence ?? 0) >= 0.72) {
    weights.stance += 0.12
  }
  if (worldview.owner_history.private_memory_summaries.length > 0) {
    weights.phase_shadow += 0.04
  }

  const systemIdentity = worldview.system_identity
  if (systemIdentity?.agent_kind === 'system') {
    switch (systemIdentity.stance_axis) {
      case 'strong':
        weights.stance += 0.24
        weights.contrast += 0.08
        weights.phase_shadow -= 0.04
        break
      case 'medium':
        weights.stance += 0.12
        break
      case 'low':
        weights.phase_shadow += 0.06
        weights.side_profile += 0.04
        break
    }

    switch (systemIdentity.humor_axis) {
      case 'high':
        weights.side_profile += 0.22
        weights.contrast += 0.12
        break
      case 'medium':
        weights.side_profile += 0.08
        break
      case 'low':
        break
    }

    switch (systemIdentity.empathy_axis) {
      case 'high':
        weights.phase_shadow += 0.18
        weights.side_profile += 0.08
        break
      case 'medium':
        weights.phase_shadow += 0.08
        break
      case 'low':
        weights.stance += 0.05
        weights.contrast += 0.06
        break
    }

    switch (systemIdentity.narrative_axis) {
      case 'high':
        weights.contrast += 0.16
        weights.phase_shadow += 0.1
        break
      case 'medium':
        weights.side_profile += 0.05
        break
      case 'low':
        break
    }
  }

  const ordered = (Object.entries(weights) as Array<[BioRhetoricFamily, number]>)
    .map(([family, weight]) => [family, Number(clamp(weight, 0.1, 1).toFixed(3))] as const)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))

  return {
    preferred_families: ordered.map(([family]) => family),
    family_weights: Object.fromEntries(ordered),
  }
}

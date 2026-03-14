import type { ChatMessage, RoomCastMemberView, RoomMember } from '../repos/types.js'
import type { StageTemplateV2 } from '../stage/index.js'

export interface SceneAwareCastingResult {
  active_agent_ids: string[]
  standby_agent_ids: string[]
  suppressed_agent_ids: string[]
  slot_audit: {
    core_agent_ids: string[]
    contrast_agent_ids: string[]
    wildcard_agent_ids: string[]
    must_have_role_hits: string[]
    target_active_count: number
  }
}

type CastingBucket = 'core' | 'contrast' | 'wildcard'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function countRecentMessages(messages: ChatMessage[], agentId: string): number {
  return messages.slice(-6).reduce((count, message) => count + Number(message.author_id === agentId), 0)
}

function pickBucket(candidate: RoomCastMemberView): CastingBucket {
  const effectiveRole = candidate.role_hint ?? candidate.role
  if (effectiveRole === 'WILDCARD' || candidate.projection?.role_tendency === 'WILDCARD') return 'wildcard'
  if (effectiveRole === 'FOIL' || effectiveRole === 'SKEPTIC') return 'contrast'
  return 'core'
}

export class ChatroomSceneAwareCastingService {
  shape(input: {
    cast: RoomCastMemberView[]
    members: RoomMember[]
    recentMessages: ChatMessage[]
    template: StageTemplateV2
    target_cast_min: number
    target_cast_max: number
  }): SceneAwareCastingResult {
    const now = Date.now()
    const suppressedAgentIds = new Set(
      input.members
        .filter((member) => member.suppressed_until && member.suppressed_until.getTime() > now)
        .map((member) => member.member_id),
    )
    const availableCast = input.cast.filter((candidate) => !suppressedAgentIds.has(candidate.agent_id))
    const targetActiveCount = clamp(
      input.template.director.casting_recipe.quota || input.target_cast_min,
      input.target_cast_min,
      Math.max(input.target_cast_min, Math.min(input.target_cast_max, availableCast.length || input.target_cast_min)),
    )

    const availableSorted = [...availableCast].sort((left, right) => {
      const leftRecent = countRecentMessages(input.recentMessages, left.agent_id)
      const rightRecent = countRecentMessages(input.recentMessages, right.agent_id)
      const leftScore = (left.member_spotlight_weight ?? 1) + left.chemistry_score - leftRecent * 0.2
      const rightScore = (right.member_spotlight_weight ?? 1) + right.chemistry_score - rightRecent * 0.2
      return rightScore - leftScore || left.agent_id.localeCompare(right.agent_id)
    })

    const byBucket = {
      core: [] as RoomCastMemberView[],
      contrast: [] as RoomCastMemberView[],
      wildcard: [] as RoomCastMemberView[],
    }
    for (const candidate of availableSorted) {
      byBucket[pickBucket(candidate)].push(candidate)
    }

    const desiredCore = Math.max(1, Math.round(
      targetActiveCount
      * input.template.director.casting_recipe.ratio.core
      / Math.max(
        1,
        input.template.director.casting_recipe.ratio.core
          + input.template.director.casting_recipe.ratio.contrast
          + input.template.director.casting_recipe.ratio.wildcard,
      ),
    ))
    const desiredContrast = Math.min(
      byBucket.contrast.length,
      Math.round(targetActiveCount * 0.34),
    )
    const desiredWildcard = Math.min(
      input.template.director.casting_recipe.wildcard_cap,
      byBucket.wildcard.length,
      Math.round(targetActiveCount * 0.25),
    )

    const activeAgentIds: string[] = []
    const mustHaveRoleHits: string[] = []
    const mustHaveRoles = new Set(input.template.director.casting_recipe.must_have_roles)
    for (const candidate of availableSorted) {
      const effectiveRole = candidate.role_hint ?? candidate.role
      if (!mustHaveRoles.has(effectiveRole)) continue
      if (activeAgentIds.includes(candidate.agent_id)) continue
      activeAgentIds.push(candidate.agent_id)
      mustHaveRoleHits.push(effectiveRole)
      if (activeAgentIds.length >= targetActiveCount) break
    }

    const fill = (bucket: CastingBucket, desiredCount: number) => {
      for (const candidate of byBucket[bucket]) {
        if (activeAgentIds.length >= targetActiveCount) break
        if (activeAgentIds.includes(candidate.agent_id)) continue
        if (
          bucket === 'core'
          && desiredCount > 0
          && activeAgentIds.filter((agentId) => byBucket.core.some((entry) => entry.agent_id === agentId)).length >= desiredCount
        ) {
          break
        }
        if (
          bucket === 'contrast'
          && desiredCount > 0
          && activeAgentIds.filter((agentId) => byBucket.contrast.some((entry) => entry.agent_id === agentId)).length >= desiredCount
        ) {
          break
        }
        if (
          bucket === 'wildcard'
          && desiredCount > 0
          && activeAgentIds.filter((agentId) => byBucket.wildcard.some((entry) => entry.agent_id === agentId)).length >= desiredCount
        ) {
          break
        }
        activeAgentIds.push(candidate.agent_id)
      }
    }

    fill('core', desiredCore)
    fill('contrast', desiredContrast)
    fill('wildcard', desiredWildcard)

    for (const candidate of availableSorted) {
      if (activeAgentIds.length >= targetActiveCount) break
      if (!activeAgentIds.includes(candidate.agent_id)) {
        activeAgentIds.push(candidate.agent_id)
      }
    }

    const standbyAgentIds = availableSorted
      .map((candidate) => candidate.agent_id)
      .filter((agentId) => !activeAgentIds.includes(agentId))

    return {
      active_agent_ids: activeAgentIds,
      standby_agent_ids: standbyAgentIds,
      suppressed_agent_ids: Array.from(suppressedAgentIds),
      slot_audit: {
        core_agent_ids: byBucket.core.map((candidate) => candidate.agent_id),
        contrast_agent_ids: byBucket.contrast.map((candidate) => candidate.agent_id),
        wildcard_agent_ids: byBucket.wildcard.map((candidate) => candidate.agent_id),
        must_have_role_hits: mustHaveRoleHits,
        target_active_count: targetActiveCount,
      },
    }
  }
}

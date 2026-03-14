import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { EpisodeBrief, LocalIntent, SceneMetadata, ScenePoolCatalog, StageTemplateV2 } from '../stage/index.js'
import { PublicSceneCatalogService } from './public-scene-catalog-service.js'
import {
  buildLocalIntentBlock,
  generateSceneId,
  type PublicSceneWritePayload,
} from './public-scene-runtime.js'

interface EligibleCommunity {
  id: string
  slug: string
  name: string
  description: string
  rules: string
}

interface SelectedAgentLike {
  id: string
  display_name: string
}

export type ScheduledPostSceneSelection =
  | {
      kind: 'scene'
      community: EligibleCommunity
      payload: PublicSceneWritePayload
    }
  | {
      kind: 'fallback'
      reason: string
    }

export class PublicSceneSelectorService {
  constructor(
    private readonly deps: {
      catalogService: PublicSceneCatalogService
      sceneMetadataRepo: ForumSceneMetadataRepository
    },
  ) {}

  async selectScheduledPost(input: {
    agent: SelectedAgentLike
    eligible_communities: EligibleCommunity[]
  }): Promise<ScheduledPostSceneSelection> {
    const catalog = this.deps.catalogService.getLaunchCatalog()
    if (!catalog) {
      return { kind: 'fallback', reason: 'scene_catalog_unavailable' }
    }

    const candidates = await this.rankCandidates(catalog, input.eligible_communities)
    const selected = candidates[0]
    if (!selected) {
      return { kind: 'fallback', reason: 'no_pool_match' }
    }

    const now = new Date()
    const selectionId = generateSceneId('scene_sel')
    const episodePlanId = generateSceneId('episode_plan')
    const localIntentId = generateSceneId('local_intent')
    const episodeId = generateSceneId('episode')
    const expiresAt = new Date(now.getTime() + selected.template.director.closing_policy.ttl_hours * 3600_000)

    const episodeBrief: EpisodeBrief = {
      episode_id: episodeId,
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      template_id: selected.template.template_id,
      template_version: selected.template.template_version,
      binding_id: selected.binding.binding_id,
      phase: 'opening',
      scene_goal: selected.template.director.scene_goal,
      target_mood: undefined,
      casting_directive: {
        must_have_roles: selected.template.director.casting_recipe.must_have_roles,
        avoid_pairs: selected.template.director.casting_recipe.avoid_pairs,
        core_quota: selected.template.director.casting_recipe.ratio.core,
        contrast_quota: selected.template.director.casting_recipe.ratio.contrast,
        wildcard_quota: selected.template.director.casting_recipe.ratio.wildcard,
      },
      open_loops: [],
      must_hit_points: [],
      avoid_repeat: [],
      close_condition: {
        ttl_hours: selected.template.director.closing_policy.ttl_hours,
        message_threshold: selected.template.director.closing_policy.message_threshold,
        objective: selected.template.director.scene_goal.viewer_goal,
      },
      expires_at: expiresAt.toISOString(),
    }

    const localIntent: LocalIntent = {
      intent_id: localIntentId,
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: deriveRelationFocus(selected.template),
      tone_hint: deriveToneHint(selected.template),
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'episode_public_context',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: { kind: 'none' },
      hard_constraints: [
        '只生成一条公开根帖，不模拟评论区后续',
        '不得改写已锁定的目标社区',
        '不要泄露任何隐藏导演目标或私域信息',
      ],
      soft_constraints: [
        selected.template.director.scene_goal.viewer_goal,
        selected.template.director.scene_goal.growth_goal,
      ].filter((item) => item.trim().length > 0),
    }

    const sceneMetadata: SceneMetadata = {
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      scene_template_id: selected.template.template_id,
      scene_template_version: selected.template.template_version,
      scene_binding_id: selected.binding.binding_id,
      overlay_id: null,
      episode_id: episodeId,
      beat_id: null,
      phase: 'opening',
      selection_mode: selected.template.director.autonomy_policy.require_pool_match_before_create
        ? 'pool_strict'
        : 'pool_guided',
      selection_id: selectionId,
      episode_plan_id: episodePlanId,
      local_intent_id: localIntentId,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }

    const selectionAudit = {
      agent_id: input.agent.id,
      community_id: selected.community.id,
      binding_id: selected.binding.binding_id,
      template_id: selected.template.template_id,
      template_version: selected.template.template_version,
      candidate_scores: candidates.map((item) => ({
        binding_id: item.binding.binding_id,
        community_id: item.community.id,
        score: item.score,
      })),
    }
    const planningAudit = {
      agent_id: input.agent.id,
      episode_id: episodeId,
      selection_id: selectionId,
      episode_plan_id: episodePlanId,
      local_intent_id: localIntentId,
      target_community_id: selected.community.id,
      phase: 'opening',
    }

    return {
      kind: 'scene',
      community: selected.community,
      payload: {
        scene_metadata: sceneMetadata,
        episode_brief: episodeBrief,
        local_intent: localIntent,
        local_intent_block: buildLocalIntentBlock(localIntent, episodeBrief),
        selection_audit: selectionAudit,
        planning_audit: planningAudit,
        fallback_reason: null,
      },
    }
  }

  private async rankCandidates(catalog: ScenePoolCatalog, eligibleCommunities: EligibleCommunity[]) {
    const eligibleBySlug = new Map(eligibleCommunities.map((item) => [item.slug, item]))
    const eligibleById = new Map(eligibleCommunities.map((item) => [item.id, item]))

    const candidates = await Promise.all(
      catalog.scene_bindings
        .filter((binding) => binding.status === 'active')
        .filter((binding) => binding.entry_surfaces.includes('scheduled_post'))
        .map(async (binding) => {
          if (binding.target.surface !== 'forum') return null
          const community = binding.target.community_id
            ? eligibleById.get(binding.target.community_id)
            : eligibleBySlug.get(binding.target.community_slug)
          if (!community) return null

          const template = catalog.stage_templates.find((item) =>
            item.template_id === binding.template_id && item.template_version === binding.template_version)
          if (!template) return null

          const latest = await this.deps.sceneMetadataRepo.findLatestByCommunityId(community.id)
          let score = binding.weights.editorial_priority * 100
            + binding.weights.base_weight * 10
            + binding.weights.freshness_bonus

          if (latest?.scene_binding_id === binding.binding_id) {
            score -= template.director.fatigue_policy.repeat_penalty * 50
          }
          if (latest?.scene_binding_id === binding.binding_id && latest.expires_at && latest.expires_at.getTime() > Date.now()) {
            score -= Math.max(10, template.director.fatigue_policy.cooldown_hours)
          }

          return { binding, template, community, score }
        }),
    )

    return candidates
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.score - a.score)
  }
}

function deriveToneHint(template: StageTemplateV2): LocalIntent['tone_hint'] {
  switch (template.category) {
    case 'show':
      return 'witty'
    case 'world':
      return 'warm'
    case 't4':
      return 'serious'
    default:
      return 'neutral'
  }
}

function deriveRelationFocus(template: StageTemplateV2): LocalIntent['relation_focus'] {
  const objectives = template.director.casting_recipe.relationship_objectives.join(' ').toLowerCase()
  if (objectives.includes('bridge')) return 'bridge'
  if (objectives.includes('ally')) return 'ally'
  if (objectives.includes('challenge')) return 'challenge'
  return 'none'
}

import type { VisualDirectiveRepository } from '../repos/visual-directive-repository.js'
import type {
  LocalMemoryScope,
  LocalReferenceScope,
  PersistedVisualDirective,
  SceneRef,
  VisualRole,
  VisualSourceKind,
} from '../repos/types.js'
import type { PublicSceneWritePayload } from '../services/public-scene-runtime.js'

const SCHEDULED_POST_ALLOW_SOURCES: VisualSourceKind[] = [
  'self_public_archive',
  'same_episode_public',
  'generated_public',
  'same_thread_public',
  'owner_private_pool',
  'private_runtime_projection',
  'community_commons',
  'platform_canonical',
]

const SCHEDULED_POST_PREFER_ORDER: VisualSourceKind[] = [
  'self_public_archive',
  'same_episode_public',
  'generated_public',
  'same_thread_public',
  'owner_private_pool',
  'private_runtime_projection',
  'community_commons',
  'platform_canonical',
]

export interface VisualDirectiveServiceDeps {
  visualDirectiveRepo: VisualDirectiveRepository
}

export class VisualDirectiveService {
  constructor(private readonly deps: VisualDirectiveServiceDeps) {}

  async createScheduledPostDirective(input: {
    community_id: string
    payload: PublicSceneWritePayload
  }): Promise<PersistedVisualDirective> {
    const { payload } = input
    const privacyMode = payload.local_intent.privacy_mode === 'public_only'
      ? 'public_only'
      : 'public_safe_projection'
    const sceneRef: SceneRef = {
      request_id: payload.scene_metadata.selection_id,
      director_surface: payload.scene_metadata.director_surface,
      actor_surface: 'forum_post',
      community_id: input.community_id,
      episode_id: payload.scene_metadata.episode_id,
      selection_id: payload.scene_metadata.selection_id,
      episode_plan_id: payload.scene_metadata.episode_plan_id,
      local_intent_id: payload.scene_metadata.local_intent_id,
      phase: payload.scene_metadata.phase,
      selection_mode: payload.scene_metadata.selection_mode,
    }
    const visualRole: VisualRole = payload.scene_metadata.phase === 'opening'
      ? 'scene_establishing'
      : 'illustration'

    return this.deps.visualDirectiveRepo.create({
      scene_ref: sceneRef,
      goal: {
        need_image: 'preferred',
        visual_role: visualRole,
        human_goal: deriveHumanGoal(payload),
        runtime_influence: 'medium',
        display_priority: 'primary',
      },
      narrative_context: {
        hook: payload.episode_brief.scene_goal.viewer_goal,
        objective: payload.episode_brief.scene_goal.growth_goal,
        tone_hint: payload.local_intent.tone_hint === 'sharp'
          ? 'serious'
          : payload.local_intent.tone_hint,
        relation_focus: deriveRelationFocus(payload.local_intent.relation_focus),
        semantic_query: buildSemanticQuery(payload),
        required_elements: payload.local_intent.soft_constraints.slice(0, 3),
        forbidden_elements: [
          ...payload.local_intent.prohibited_reference_types,
          ...payload.local_intent.hard_constraints.filter((item) => /不要|不得|禁止|泄露|私域/i.test(item)),
        ].slice(0, 6),
        style_hint: null,
        aspect_ratio_hint: '4:5',
      },
      sourcing_policy: {
        allow_sources: [...SCHEDULED_POST_ALLOW_SOURCES],
        prefer_order: [...SCHEDULED_POST_PREFER_ORDER],
        allow_private_runtime_projection: true,
        allow_private_inspired_generation: true,
        allow_cross_agent_public: false,
        allow_generation: true,
        max_display_assets: 1,
      },
      guardrails: {
        privacy_mode: privacyMode,
        memory_scope: mapLocalMemoryScope(payload.local_intent.memory_scope),
        reference_scope: mapReferenceScope(payload.local_intent.reference_scope),
        display_policy: 'original_allowed',
        mention_policy: privacyMode === 'public_only' ? 'explicit_describe' : 'allude',
        text_in_image: 'avoid',
      },
      budget: {
        generation_tier: 'medium',
        sync_generation_ms_budget: 2200,
        async_generation_allowed: true,
        max_generation_attempts: 2,
      },
      audit: {
        director_reason: [
          `phase=${payload.scene_metadata.phase}`,
          payload.episode_brief.scene_goal.viewer_goal,
          payload.episode_brief.scene_goal.growth_goal,
        ].filter(Boolean).join(' | '),
        hard_constraints: [...payload.local_intent.hard_constraints],
        soft_constraints: [...payload.local_intent.soft_constraints],
      },
    })
  }
}

function deriveHumanGoal(payload: PublicSceneWritePayload): PersistedVisualDirective['goal']['human_goal'] {
  if (payload.local_intent.tone_hint === 'witty') return 'humor'
  if (payload.scene_metadata.phase === 'opening') return 'worldbuilding'
  if (payload.local_intent.relation_focus === 'bridge') return 'continuity'
  return 'engagement'
}

function deriveRelationFocus(
  relationFocus: PublicSceneWritePayload['local_intent']['relation_focus'],
): PersistedVisualDirective['narrative_context']['relation_focus'] {
  switch (relationFocus) {
    case 'ally':
      return 'support'
    case 'challenge':
      return 'contrast'
    case 'bridge':
      return 'bridge'
    default:
      return 'none'
  }
}

function mapLocalMemoryScope(
  scope: PublicSceneWritePayload['local_intent']['memory_scope'],
): LocalMemoryScope {
  switch (scope) {
    case 'public_episode_continuity':
      return 'public_episode_continuity'
    case 'public_contextual':
      return 'public_contextual'
    default:
      return 'thread_only'
  }
}

function mapReferenceScope(
  scope: PublicSceneWritePayload['local_intent']['reference_scope'],
): LocalReferenceScope {
  switch (scope) {
    case 'thread_only':
      return 'thread_only'
    case 'episode_public_context':
      return 'episode_only'
    default:
      return 'seed_only'
  }
}

function buildSemanticQuery(payload: PublicSceneWritePayload): string {
  return [
    payload.episode_brief.scene_goal.viewer_goal,
    payload.episode_brief.scene_goal.growth_goal,
    ...payload.local_intent.soft_constraints.slice(0, 2),
  ].filter((item) => item.trim().length > 0).join(' | ')
}

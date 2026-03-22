import type { VisualDirectiveRepository } from '../repos/visual-directive-repository.js'
import type {
  CreateVisualDirectiveInput,
  LocalMemoryScope,
  LocalReferenceScope,
  PersistedVisualDirective,
  SceneRef,
  VisualRole,
  VisualSourceKind,
} from '../repos/types.js'
import type { PublicSceneWritePayload } from '../services/public-scene-runtime.js'
import type { ChatMessageKind } from '../repos/types.js'
import type { ProgramMessageMetadata } from '../services/conversation-clock/types.js'

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

const COMMENT_ALLOW_SOURCES: VisualSourceKind[] = [
  'same_thread_public',
  'same_episode_public',
  'self_public_archive',
  'owner_private_pool',
  'private_runtime_projection',
  'community_commons',
  'platform_canonical',
]

const CHAT_ROOM_ALLOW_SOURCES: VisualSourceKind[] = [
  'same_thread_public',
  'same_episode_public',
  'self_public_archive',
  'generated_public',
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

  createDirective(input: CreateVisualDirectiveInput): Promise<PersistedVisualDirective> {
    return this.deps.visualDirectiveRepo.create(input)
  }

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

    return this.createDirective({
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

  async createForumCommentDirective(input: {
    community_id: string
    focus_hint: string
    payload: PublicSceneWritePayload
  }): Promise<PersistedVisualDirective> {
    const { payload } = input
    const visualRole = deriveForumCommentVisualRole(payload)
    const sceneRef: SceneRef = {
      request_id: payload.scene_metadata.selection_id,
      director_surface: payload.scene_metadata.director_surface,
      actor_surface: 'forum_comment',
      community_id: input.community_id,
      episode_id: payload.scene_metadata.episode_id,
      selection_id: payload.scene_metadata.selection_id,
      episode_plan_id: payload.scene_metadata.episode_plan_id,
      local_intent_id: payload.scene_metadata.local_intent_id,
      phase: payload.scene_metadata.phase,
      selection_mode: payload.scene_metadata.selection_mode,
    }

    return this.createDirective({
      scene_ref: sceneRef,
      goal: {
        need_image: 'avoid',
        visual_role: visualRole,
        human_goal: visualRole === 'joke_payload' ? 'humor' : 'continuity',
        runtime_influence: 'light',
        display_priority: 'supporting',
      },
      narrative_context: {
        hook: payload.episode_brief.scene_goal.viewer_goal,
        objective: input.focus_hint.trim().slice(0, 180) || payload.episode_brief.scene_goal.growth_goal,
        tone_hint: payload.local_intent.tone_hint === 'sharp'
          ? 'serious'
          : payload.local_intent.tone_hint,
        relation_focus: deriveRelationFocus(payload.local_intent.relation_focus),
        semantic_query: [
          payload.episode_brief.scene_goal.viewer_goal,
          payload.episode_brief.scene_goal.growth_goal,
          input.focus_hint.trim(),
        ].filter(Boolean).join(' | '),
        required_elements: payload.local_intent.soft_constraints.slice(0, 2),
        forbidden_elements: [
          ...payload.local_intent.prohibited_reference_types,
          ...payload.local_intent.hard_constraints.filter((item) => /不要|不得|禁止|泄露|私域/i.test(item)),
        ].slice(0, 6),
        style_hint: 'supporting_visual_only',
        aspect_ratio_hint: '1:1',
      },
      sourcing_policy: {
        allow_sources: [...COMMENT_ALLOW_SOURCES],
        prefer_order: [...COMMENT_ALLOW_SOURCES],
        allow_private_runtime_projection: true,
        allow_private_inspired_generation: false,
        allow_cross_agent_public: false,
        allow_generation: false,
        max_display_assets: 1,
      },
      guardrails: {
        privacy_mode: 'public_only',
        memory_scope: mapLocalMemoryScope(payload.local_intent.memory_scope),
        reference_scope: mapReferenceScope(payload.local_intent.reference_scope),
        display_policy: 'original_allowed',
        mention_policy: 'allude',
        text_in_image: 'avoid',
      },
      budget: {
        generation_tier: 'none',
        sync_generation_ms_budget: 0,
        async_generation_allowed: false,
        max_generation_attempts: 0,
      },
      audit: {
        director_reason: [
          `forum_comment:${visualRole}`,
          payload.local_intent.initiative,
          payload.episode_brief.scene_goal.viewer_goal,
        ].join(' | '),
        hard_constraints: [...payload.local_intent.hard_constraints],
        soft_constraints: [...payload.local_intent.soft_constraints],
      },
    })
  }

  async createChatRoomMessageDirective(input: {
    room_id: string
    room_name: string
    room_description: string
    community_id?: string | null
    semantic_hint: string
    message_kind?: ChatMessageKind | null
    live_hook?: string | null
    unresolved_question?: string | null
    metadata?: ProgramMessageMetadata | null
  }): Promise<PersistedVisualDirective> {
    const sceneRef: SceneRef = {
      request_id: `${input.room_id}:${input.metadata?.program_event_id ?? 'free-chat'}`,
      director_surface: 'chat_room',
      actor_surface: 'chat_room_message',
      community_id: input.community_id ?? null,
      episode_id: input.metadata?.episode_id ?? null,
      selection_id: `${input.room_id}:${input.metadata?.beat_id ?? 'latest'}`,
      episode_plan_id: input.metadata?.program_event_id ?? null,
      local_intent_id: `${input.room_id}:${input.message_kind ?? 'normal'}`,
      phase: 'opening',
      selection_mode: 'autonomous_anchored',
    }
    const visualRole = deriveChatRoomVisualRole({
      messageKind: input.message_kind ?? null,
      semanticHint: input.semantic_hint,
    })

    return this.createDirective({
      scene_ref: sceneRef,
      goal: {
        need_image: 'preferred',
        visual_role: visualRole,
        human_goal: visualRole === 'joke_payload' ? 'humor' : 'worldbuilding',
        runtime_influence: 'medium',
        display_priority: 'supporting',
      },
      narrative_context: {
        hook: input.live_hook ?? input.room_name,
        objective: input.unresolved_question ?? input.room_description ?? input.semantic_hint.slice(0, 180),
        tone_hint: 'neutral',
        relation_focus: 'bridge',
        semantic_query: [
          input.room_name,
          input.room_description,
          input.live_hook ?? '',
          input.unresolved_question ?? '',
          input.semantic_hint,
        ].filter(Boolean).join(' | '),
        required_elements: [input.live_hook, input.unresolved_question].filter((item): item is string => Boolean(item)).slice(0, 2),
        forbidden_elements: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
        style_hint: 'supporting_room_visual',
        aspect_ratio_hint: '4:5',
      },
      sourcing_policy: {
        allow_sources: [...CHAT_ROOM_ALLOW_SOURCES],
        prefer_order: [...CHAT_ROOM_ALLOW_SOURCES],
        allow_private_runtime_projection: true,
        allow_private_inspired_generation: false,
        allow_cross_agent_public: false,
        allow_generation: false,
        max_display_assets: 1,
      },
      guardrails: {
        privacy_mode: 'public_only',
        memory_scope: 'public_contextual',
        reference_scope: 'thread_only',
        display_policy: 'original_allowed',
        mention_policy: 'allude',
        text_in_image: 'avoid',
      },
      budget: {
        generation_tier: 'none',
        sync_generation_ms_budget: 0,
        async_generation_allowed: false,
        max_generation_attempts: 0,
      },
      audit: {
        director_reason: [
          `chat_room_message:${visualRole}`,
          input.room_name,
          input.message_kind ?? 'normal',
        ].join(' | '),
        hard_constraints: [],
        soft_constraints: [input.live_hook, input.unresolved_question].filter((item): item is string => Boolean(item)),
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

function deriveForumCommentVisualRole(payload: PublicSceneWritePayload): VisualRole {
  if (payload.local_intent.target_ref.kind === 'comment') return 'callback_prop'
  if (payload.local_intent.tone_hint === 'witty') return 'joke_payload'
  return 'reaction_image'
}

function deriveChatRoomVisualRole(input: {
  messageKind: ChatMessageKind | null
  semanticHint: string
}): VisualRole {
  if (input.messageKind === 'ambient') return 'mood_board'
  if (input.messageKind === 'greeting') return 'scene_establishing'
  if (/梗|笑|哈哈|lol|meme/i.test(input.semanticHint)) return 'joke_payload'
  return 'scene_establishing'
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

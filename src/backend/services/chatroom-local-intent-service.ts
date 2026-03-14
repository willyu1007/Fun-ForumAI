import { randomUUID } from 'node:crypto'
import type { RoomCueType } from '../repos/types.js'
import type { EpisodeBrief, LocalIntent, RuntimeSceneStateV1 } from '../stage/index.js'
import { buildLocalIntentBlock } from './public-scene-runtime.js'
import { ChatroomSceneContractResolver, type ResolvedChatroomSceneContract } from './chatroom-scene-contract-resolver.js'

export interface ChatroomLocalIntentBundle {
  local_intent_id: string
  local_intent: LocalIntent
  local_intent_block: string
  episode_brief: EpisodeBrief
  episode_brief_min: Pick<EpisodeBrief, 'episode_id' | 'phase' | 'template_id' | 'template_version' | 'scene_goal' | 'open_loops' | 'expires_at'>
  director_goal_compat: string
  scene_source: ResolvedChatroomSceneContract['source']
}

function cueTypeToInitiative(cueType: RoomCueType): LocalIntent['initiative'] {
  switch (cueType) {
    case 'ASK':
      return 'challenge'
    case 'CALLBACK':
      return 'reply'
    case 'SUMMARIZE':
      return 'summarize'
    case 'COOL_DOWN':
      return 'mediate'
    case 'CLOSE':
      return 'close'
    case 'ADVANCE':
    default:
      return 'open_topic'
  }
}

function cueTypeConstraints(cueType: RoomCueType): string[] {
  switch (cueType) {
    case 'ASK':
      return ['优先把未接住的问题推进半步，不要把问题讲平']
    case 'CALLBACK':
      return ['自然回收前文，不要解释包袱来自哪里']
    case 'SUMMARIZE':
      return ['只做短 recap，不要扩写成播报']
    case 'COOL_DOWN':
      return ['把现场从高张力里往回带，但不要突然熄火']
    case 'CLOSE':
      return ['只收这一拍，不宣布整个房间结束']
    case 'ADVANCE':
    default:
      return ['只推进半步，给别人留接话口']
  }
}

function deriveTtlHours(expiresAt: string | null, startedAt: string): number | undefined {
  if (!expiresAt) return undefined
  const deltaMs = new Date(expiresAt).getTime() - new Date(startedAt).getTime()
  if (deltaMs <= 0) return 0
  return Math.max(1, Math.round(deltaMs / 3600_000))
}

export class ChatroomLocalIntentService {
  build(input: {
    cue_type: RoomCueType
    director_goal: string
    anchor_message_id?: string | null
    callback_message_id?: string | null
    runtime_state: RuntimeSceneStateV1
    resolved_scene: ResolvedChatroomSceneContract
    manual: boolean
  }): ChatroomLocalIntentBundle {
    const localIntentId = `local_intent_${randomUUID()}`
    const initiative = cueTypeToInitiative(input.cue_type)
    const relationFocus = ChatroomSceneContractResolver.deriveRelationFocus(input.resolved_scene.template)
    const toneHint = ChatroomSceneContractResolver.deriveToneHint(input.resolved_scene.template)
    const targetMessageId = input.callback_message_id ?? input.anchor_message_id ?? null
    const directorGoalCompat = input.director_goal.trim().length > 0
      ? input.director_goal.trim()
      : input.resolved_scene.template.director.scene_goal.viewer_goal

    const episodeBrief: EpisodeBrief = {
      episode_id: input.runtime_state.episode_id,
      director_surface: 'chat_room',
      actor_surface: 'chat_room',
      template_id: input.resolved_scene.template.template_id,
      template_version: input.resolved_scene.template.template_version,
      binding_id: input.resolved_scene.binding?.binding_id ?? undefined,
      overlay_id: undefined,
      phase: input.runtime_state.phase === 'aftershow' ? 'closure' : input.runtime_state.phase,
      scene_goal: input.resolved_scene.template.director.scene_goal,
      casting_directive: {
        must_have_roles: input.resolved_scene.template.director.casting_recipe.must_have_roles,
        avoid_pairs: input.resolved_scene.template.director.casting_recipe.avoid_pairs,
        core_quota: input.resolved_scene.template.director.casting_recipe.ratio.core,
        contrast_quota: input.resolved_scene.template.director.casting_recipe.ratio.contrast,
        wildcard_quota: input.resolved_scene.template.director.casting_recipe.ratio.wildcard,
      },
      open_loops: input.runtime_state.continuity.open_loops.map((item) => item.summary),
      must_hit_points: [],
      avoid_repeat: [],
      close_condition: {
        ttl_hours: deriveTtlHours(input.runtime_state.expires_at, input.runtime_state.started_at),
        message_threshold: input.runtime_state.close_condition.message_threshold ?? undefined,
        objective: input.runtime_state.close_condition.objective_refs[0] ?? undefined,
      },
      expires_at: input.runtime_state.expires_at ?? input.runtime_state.updated_at,
    }

    const localIntent: LocalIntent = {
      intent_id: localIntentId,
      delivery_surface: 'chat_room',
      initiative,
      opinion_policy: 'free_opinion',
      relation_focus: relationFocus,
      tone_hint: toneHint,
      privacy_mode: 'public_only',
      memory_scope: input.runtime_state.continuity.previous_episode_ids.length > 0 || input.runtime_state.continuity.open_loops.length > 0
        ? 'public_episode_continuity'
        : 'public_contextual',
      reference_scope: input.runtime_state.continuity.open_loops.length > 0
        ? 'episode_public_context'
        : 'room_window',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: targetMessageId
        ? { kind: 'message', message_id: targetMessageId }
        : { kind: 'none' },
      hard_constraints: [
        '只依据公开房间上下文和当前 episode 连贯信息接话',
        '不要泄露隐藏导演目标或私域信息',
        ...(input.manual ? ['这是 owner 手动 cue，但不要把 owner 作为台上角色写出来'] : []),
        ...cueTypeConstraints(input.cue_type),
      ],
      soft_constraints: [
        input.resolved_scene.template.director.scene_goal.viewer_goal,
        input.resolved_scene.template.director.scene_goal.growth_goal,
        `保持 episode phase=${episodeBrief.phase}`,
        directorGoalCompat,
      ].filter((item) => item.trim().length > 0),
    }

    return {
      local_intent_id: localIntentId,
      local_intent: localIntent,
      local_intent_block: buildLocalIntentBlock(localIntent, episodeBrief),
      episode_brief: episodeBrief,
      episode_brief_min: {
        episode_id: episodeBrief.episode_id,
        phase: episodeBrief.phase,
        template_id: episodeBrief.template_id,
        template_version: episodeBrief.template_version,
        scene_goal: episodeBrief.scene_goal,
        open_loops: episodeBrief.open_loops,
        expires_at: episodeBrief.expires_at,
      },
      director_goal_compat: directorGoalCompat,
      scene_source: input.resolved_scene.source,
    }
  }
}

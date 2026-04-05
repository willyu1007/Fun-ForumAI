import type { RoomSceneType } from '../repos/types.js'
import { DEFAULT_STAGE_SPEC_V1, type SceneBindingV1, type StageTemplateV2 } from '../stage/index.js'
import type { PublicSceneCatalogService } from './public-scene-catalog-service.js'

export interface ResolvedChatroomSceneContract {
  template: StageTemplateV2
  binding: SceneBindingV1 | null
  source: 'binding' | 'room_program'
  selection_mode: 'pool_guided' | 'pool_strict' | 'autonomous_anchored'
}

const ROOM_PROGRAM_SCENE_PRESETS: Record<RoomSceneType, {
  name: string
  category: StageTemplateV2['category']
  viewerGoal: string
  growthGoal: string
  mustHaveRoles: string[]
  relationshipObjectives: string[]
  messageThreshold: number
}> = {
  FREE_CHAT: {
    name: 'Chat Room Free Chat',
    category: 'show',
    viewerGoal: '让房间像自然 live 群聊一样继续往前推。',
    growthGoal: '用轻量互动稳住角色存在感和互相接话习惯。',
    mustHaveRoles: ['HOST'],
    relationshipObjectives: ['bridge'],
    messageThreshold: 10,
  },
  TALK_SHOW: {
    name: 'Chat Room Talk Show',
    category: 'show',
    viewerGoal: '让房间更像带节奏的 talk show，而不是松散闲聊。',
    growthGoal: '放大角色之间的台上化学反应和出场辨识度。',
    mustHaveRoles: ['HOST', 'FOIL'],
    relationshipObjectives: ['challenge', 'bridge'],
    messageThreshold: 12,
  },
  ROUND_TABLE: {
    name: 'Chat Room Round Table',
    category: 'theme',
    viewerGoal: '让多位角色围绕同一议题形成有序接力。',
    growthGoal: '鼓励角色在公开场里建立稳定的协作与分工。',
    mustHaveRoles: ['HOST', 'EXPLAINER'],
    relationshipObjectives: ['ally', 'bridge'],
    messageThreshold: 12,
  },
  ROAST: {
    name: 'Chat Room Roast',
    category: 'show',
    viewerGoal: '让现场保留火花和梗感，但不失控。',
    growthGoal: '放大角色之间的反打与回收能力。',
    mustHaveRoles: ['HOST', 'FOIL', 'WILDCARD'],
    relationshipObjectives: ['challenge'],
    messageThreshold: 9,
  },
  DEBATE: {
    name: 'Chat Room Debate',
    category: 'creator',
    viewerGoal: '让争议被掰开讲清，而不是平铺附和。',
    growthGoal: '训练角色在公开冲突中的立场稳定性与回应能力。',
    mustHaveRoles: ['HOST', 'SKEPTIC'],
    relationshipObjectives: ['challenge'],
    messageThreshold: 12,
  },
  SLICE_OF_LIFE: {
    name: 'Chat Room Slice Of Life',
    category: 'world',
    viewerGoal: '让房间像群像日常一样自然流动。',
    growthGoal: '积累轻量角色关系和连续性小梗。',
    mustHaveRoles: ['HOST'],
    relationshipObjectives: ['ally', 'bridge'],
    messageThreshold: 8,
  },
  STORY_LAB: {
    name: 'Chat Room Story Lab',
    category: 'world',
    viewerGoal: '让房间像共同搭戏一样往前试探和加码。',
    growthGoal: '鼓励角色在公共即兴里形成更鲜明的互补关系。',
    mustHaveRoles: ['HOST', 'WILDCARD'],
    relationshipObjectives: ['bridge', 'challenge'],
    messageThreshold: 11,
  },
}

export class ChatroomSceneContractResolver {
  constructor(
    private readonly deps: {
      catalogService: PublicSceneCatalogService
    },
  ) {}

  resolve(input: {
    roomId: string
    sceneType: RoomSceneType
  }): ResolvedChatroomSceneContract {
    const catalog = this.deps.catalogService.getLaunchCatalog()
    if (catalog) {
      const binding = catalog.scene_bindings
        .filter((item) => item.status === 'active')
        .find((item) =>
          item.target.surface === 'chat_room'
          && item.target.room_id === input.roomId
          && item.entry_surfaces.includes('chat_room'),
        )
      if (binding) {
        const template = catalog.stage_templates.find((item) =>
          item.template_id === binding.template_id
          && item.template_version === binding.template_version)
        if (template) {
          return {
            template,
            binding,
            source: 'binding',
            selection_mode: template.director.autonomy_policy.require_pool_match_before_create
              ? 'pool_strict'
              : 'pool_guided',
          }
        }
      }
    }

    return this.buildRoomProgramContract(input.sceneType)
  }

  static deriveToneHint(template: StageTemplateV2): 'neutral' | 'witty' | 'serious' | 'warm' | 'sharp' {
    switch (template.category) {
      case 'show':
        return 'witty'
      case 'world':
        return 'warm'
      case 'creator':
        return 'serious'
      default:
        return 'neutral'
    }
  }

  static deriveRelationFocus(template: StageTemplateV2): 'challenge' | 'ally' | 'bridge' | 'none' {
    const objectives = template.director.casting_recipe.relationship_objectives.join(' ').toLowerCase()
    if (objectives.includes('bridge')) return 'bridge'
    if (objectives.includes('ally')) return 'ally'
    if (objectives.includes('challenge')) return 'challenge'
    return 'none'
  }

  private buildRoomProgramContract(sceneType: RoomSceneType): ResolvedChatroomSceneContract {
    const preset = ROOM_PROGRAM_SCENE_PRESETS[sceneType]
    return {
      template: {
        template_id: `room-program-${sceneType.toLowerCase()}`,
        template_version: 'runtime-v1',
        name: preset.name,
        category: preset.category,
        lifecycle_status: 'core_active',
        stage_spec: DEFAULT_STAGE_SPEC_V1,
        director: {
          applicable_surfaces: ['chat_room'],
          scene_goal: {
            viewer_goal: preset.viewerGoal,
            growth_goal: preset.growthGoal,
          },
          casting_recipe: {
            quota: 3,
            ratio: {
              core: 2,
              contrast: 1,
              wildcard: 1,
            },
            wildcard_cap: 1,
            must_have_roles: preset.mustHaveRoles,
            avoid_pairs: [],
            relationship_objectives: preset.relationshipObjectives,
          },
          beat_plan: {
            phases: ['opening', 'escalation', 'pivot', 'closure'],
            optional_beats: [],
          },
          fatigue_policy: {
            cooldown_hours: 1,
            repeat_penalty: 0.6,
            max_runs_per_day: 12,
          },
          closing_policy: {
            ttl_hours: 4,
            min_turns: 3,
            message_threshold: preset.messageThreshold,
            aftershow_mode: 'off',
          },
          hot_topic_policy: {
            injection_mode: 'overlay_only',
            sensitive_topic_mode: 'standard',
          },
          autonomy_policy: {
            allow_autonomous_mutation: true,
            require_pool_match_before_create: false,
          },
        },
      },
      binding: null,
      source: 'room_program',
      selection_mode: 'autonomous_anchored',
    }
  }
}

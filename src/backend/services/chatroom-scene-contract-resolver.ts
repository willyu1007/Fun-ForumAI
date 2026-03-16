import type { RoomSceneType } from '../repos/types.js'
import { ValidationError } from '../lib/errors.js'
import type { SceneBindingV1, StageTemplateV2 } from '../stage/index.js'
import type { PublicSceneCatalogService } from './public-scene-catalog-service.js'

export interface ResolvedChatroomSceneContract {
  template: StageTemplateV2
  binding: SceneBindingV1
  source: 'binding'
  selection_mode: 'pool_guided' | 'pool_strict'
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
    if (!catalog) {
      throw new ValidationError(
        `chat room ${input.roomId} is missing launch catalog; cannot resolve scene binding for ${input.sceneType}`,
      )
    }

    const binding = catalog.scene_bindings
      .filter((item) => item.status === 'active')
      .find((item) =>
        item.target.surface === 'chat_room'
        && item.target.room_id === input.roomId
        && item.entry_surfaces.includes('chat_room'),
      )
    if (!binding) {
      throw new ValidationError(
        `chat room ${input.roomId} has no active scene binding for ${input.sceneType}`,
      )
    }

    const template = catalog.stage_templates.find((item) =>
      item.template_id === binding.template_id && item.template_version === binding.template_version)
    if (!template) {
      throw new ValidationError(
        `chat room ${input.roomId} binding ${binding.binding_id} references missing template ${binding.template_id}@${binding.template_version}`,
      )
    }

    return {
      template,
      binding,
      source: 'binding',
      selection_mode: template.director.autonomy_policy.require_pool_match_before_create
        ? 'pool_strict'
        : 'pool_guided',
    }
  }

  static deriveToneHint(template: StageTemplateV2): 'neutral' | 'witty' | 'serious' | 'warm' | 'sharp' {
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

  static deriveRelationFocus(template: StageTemplateV2): 'challenge' | 'ally' | 'bridge' | 'none' {
    const objectives = template.director.casting_recipe.relationship_objectives.join(' ').toLowerCase()
    if (objectives.includes('bridge')) return 'bridge'
    if (objectives.includes('ally')) return 'ally'
    if (objectives.includes('challenge')) return 'challenge'
    return 'none'
  }
}

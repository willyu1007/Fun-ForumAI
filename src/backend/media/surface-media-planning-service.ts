import type { ChatMessageKind } from '../repos/types.js'
import type {
  PersistedVisualDirective,
  VisualRole,
} from '../repos/types.js'
import type { PublicSceneWritePayload } from '../services/public-scene-runtime.js'
import type { CurrentContextSource } from '../runtime/types.js'
import type { ProgramMessageMetadata } from '../services/conversation-clock/types.js'
import type { MediaProjectionService } from './media-projection-service.js'
import type { ImagePlannerService } from './image-planner-service.js'
import type { VisualDirectiveService } from './visual-directive-service.js'

export interface PreparedSurfaceVisualPlan {
  directive_id: string
  image_plan_id: string
  runtime_card_ids: string[]
  current_context_source?: CurrentContextSource
  display_attachment_refs: Array<{
    asset_id: string
    slot: number
    display_variant: 'original' | 'generated_derivative'
  }>
  planning_audit: Record<string, unknown>
}

export interface SurfaceMediaPlanningServiceDeps {
  visualDirectiveService: VisualDirectiveService
  imagePlannerService: ImagePlannerService
  mediaProjectionService: MediaProjectionService
}

export class SurfaceMediaPlanningService {
  constructor(private readonly deps: SurfaceMediaPlanningServiceDeps) {}

  async prepareForumCommentPlan(input: {
    agent_id: string
    community_id: string
    focus_hint: string
    payload: PublicSceneWritePayload
  }): Promise<PreparedSurfaceVisualPlan | null> {
    const directive = await this.deps.visualDirectiveService.createForumCommentDirective({
      community_id: input.community_id,
      focus_hint: input.focus_hint,
      payload: input.payload,
    })
    return this.preparePlan({
      agent_id: input.agent_id,
      directive,
    })
  }

  async prepareChatRoomMessagePlan(input: {
    agent_id: string
    room_id: string
    room_name: string
    room_description: string
    community_id?: string | null
    semantic_hint: string
    message_kind?: ChatMessageKind | null
    live_hook?: string | null
    unresolved_question?: string | null
    metadata?: ProgramMessageMetadata | null
  }): Promise<PreparedSurfaceVisualPlan | null> {
    const directive = await this.deps.visualDirectiveService.createChatRoomMessageDirective({
      room_id: input.room_id,
      room_name: input.room_name,
      room_description: input.room_description,
      community_id: input.community_id ?? null,
      semantic_hint: input.semantic_hint,
      message_kind: input.message_kind ?? null,
      live_hook: input.live_hook ?? null,
      unresolved_question: input.unresolved_question ?? null,
      metadata: input.metadata ?? null,
    })
    return this.preparePlan({
      agent_id: input.agent_id,
      directive,
    })
  }

  private async preparePlan(input: {
    agent_id: string
    directive: PersistedVisualDirective
  }): Promise<PreparedSurfaceVisualPlan | null> {
    const plan = await this.deps.imagePlannerService.planWithDirective({
      agent_id: input.agent_id,
      directive: input.directive,
    })
    const firstCard = plan.runtime.cards[0] ?? null
    const serialized = firstCard
      ? this.deps.mediaProjectionService.serializePublicCardForPrompt({
          card: firstCard,
          max_chars: 900,
        })
      : null
    const promptAudit = serialized?.audit ?? null
    const promptSafe = serialized
      ? !serialized.audit.contains_url
        && !serialized.audit.contains_asset_id
        && !serialized.audit.contains_owner_note
        && !serialized.audit.contains_private_text
      : false

    if (plan.runtime.cards.length === 0 && plan.display.attachments.length === 0) {
      return null
    }

    return {
      directive_id: input.directive.id,
      image_plan_id: plan.id,
      runtime_card_ids: plan.runtime.cards.map((card) => card.card_id),
      ...(firstCard && serialized && promptSafe
        ? {
            current_context_source: {
              kind: 'public_media_card',
              text: serialized.text,
              priority: 'high',
              source_id: firstCard.card_id,
            } satisfies CurrentContextSource,
          }
        : {}),
      display_attachment_refs: plan.display.attachments.map((attachment) => ({
        asset_id: attachment.asset_id,
        slot: attachment.slot,
        display_variant: attachment.display_variant,
      })),
      planning_audit: {
        visual_directive_id: input.directive.id,
        image_plan_id: plan.id,
        planner_status: plan.status,
        planner_decision: plan.decision,
        planner_reason: plan.reason,
        generation_status: plan.generation.status,
        generation_job_id: plan.generation.job_id ?? null,
        runtime_card_ids: plan.runtime.cards.map((card) => card.card_id),
        visual_role: input.directive.goal.visual_role,
        public_media_prompt_audit: promptAudit,
        public_media_prompt_injection_status: firstCard
          ? (promptSafe ? 'accepted' : 'blocked_by_audit')
          : 'not_requested',
      },
    }
  }
}

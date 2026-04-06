import type { ChatMessageKind } from '../repos/types.js'
import type {
  PersistedVisualDirective,
} from '../repos/types.js'
import type { PublicSceneWritePayload } from '../services/public-scene-runtime.js'
import type { CurrentContextSource } from '../runtime/types.js'
import type { ProgramMessageMetadata } from '../services/conversation-clock/types.js'
import type { MediaProjectionService } from './media-projection-service.js'
import type { ImagePlannerService } from './image-planner-service.js'
import type { VisualDirectiveService } from './visual-directive-service.js'
import type { MediaObservabilityService } from './media-observability-service.js'
import type { MediaRolloutControllerService } from './media-rollout-controller-service.js'
import { resolveMediaObservabilitySurface } from './media-observability-service.js'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isImagePlanDirectiveConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? error.code : null
  const message = 'message' in error && typeof error.message === 'string'
    ? error.message
    : ''
  return code === 'P2003' && message.includes('image_plans_directive_id_fkey')
}

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
  mediaObservabilityService?: Pick<MediaObservabilityService, 'record' | 'recordCriticalPrivateLeak'> | null
  mediaRolloutControllerService?: Pick<MediaRolloutControllerService, 'getEffectiveProfile'> | null
}

export class SurfaceMediaPlanningService {
  constructor(private readonly deps: SurfaceMediaPlanningServiceDeps) {}

  async prepareForumThreadPlan(input: {
    agent_id: string
    community_id: string
    post_id: string
    thread_id: string | null
    turn_id?: string | null
    surface: 'forum_thread' | 'forum_turn'
    focus_hint: string
    payload: PublicSceneWritePayload
  }): Promise<PreparedSurfaceVisualPlan | null> {
    const directive = await this.deps.visualDirectiveService.createForumThreadDirective({
      community_id: input.community_id,
      post_id: input.post_id,
      thread_id: input.thread_id,
      turn_id: input.turn_id ?? null,
      surface: input.surface,
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
    parent_message_id?: string | null
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
      parent_message_id: input.parent_message_id ?? null,
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
    const plan = await this.planWithDirectiveRetry(input)
    const surface = resolveMediaObservabilitySurface({
      actor_surface: input.directive.scene_ref.actor_surface,
      director_surface: input.directive.scene_ref.director_surface,
    })
    const hardening = await this.deps.mediaRolloutControllerService?.getEffectiveProfile()
      .then((profile) => profile.effective)
      .catch(() => null)
    const firstCard = plan.runtime.cards[0] ?? null
    const serialized = firstCard
      ? this.deps.mediaProjectionService.serializePublicCardForPrompt({
          card: firstCard,
          max_chars: 900,
          audit_context: {
            surface: 'public_runtime',
            sensitive_terms: [],
            policy_mode: 'strict',
            visibility_scope: 'public',
            actor_role: 'agent',
          },
          enforcement: hardening
            ? {
                semantic_v3_enforced: hardening.semantic_v3_enforced,
                strict_audit_enforced: hardening.strict_audit_enforced,
                lineage_required: hardening.lineage_required,
              }
            : undefined,
        })
      : null
    const promptAudit = serialized?.audit ?? null
    const promptSafe = serialized
      ? serialized.decision.decision !== 'block'
        && !serialized.audit.contains_url
        && !serialized.audit.contains_asset_id
        && !serialized.audit.contains_owner_note
        && !serialized.audit.contains_private_text
      : false
    const selectedSource = plan.selected_sources.find((item) => !item.rejection_reason)
    if (selectedSource?.source_kind) {
      await this.deps.mediaObservabilityService?.record({
        event_type: `source_selected:${selectedSource.source_kind}`,
        surface,
        agent_id: input.agent_id,
        image_plan_id: plan.id,
        asset_id: selectedSource.asset_id ?? null,
        source_kind: selectedSource.source_kind,
      })
    }
    if (plan.runtime.cards.length > 0 && plan.display.attachments.length === 0) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'runtime_only_downgraded',
        surface,
        agent_id: input.agent_id,
        image_plan_id: plan.id,
        payload_json: {
          planner_status: plan.status,
          planner_decision: plan.decision,
        },
      })
    }
    if (firstCard && !promptSafe) {
      const blockedFields = [
        serialized?.audit.contains_owner_note ? 'owner_note' : null,
        serialized?.audit.contains_private_text ? 'private_text' : null,
        serialized?.audit.contains_url ? 'url' : null,
        serialized?.audit.contains_asset_id ? 'asset_id' : null,
      ].filter((item): item is string => Boolean(item))
      await this.deps.mediaObservabilityService?.record({
        event_type: 'public_prompt_audit_blocked',
        surface,
        severity: 'warn',
        agent_id: input.agent_id,
        image_plan_id: plan.id,
        asset_id: firstCard.asset_ref.asset_id,
        source_kind: firstCard.source.kind,
        payload_json: {
          blocked_fields: blockedFields,
          derived_from_private: firstCard.source.derived_from_private,
          reason_codes: serialized?.decision.reason_codes ?? [],
        },
      })
      if (firstCard.source.derived_from_private && blockedFields.length > 0) {
        await this.deps.mediaObservabilityService?.recordCriticalPrivateLeak({
          surface,
          agent_id: input.agent_id,
          community_id: input.directive.scene_ref.community_id ?? null,
          image_plan_id: plan.id,
          asset_id: firstCard.asset_ref.asset_id,
          source_kind: firstCard.source.kind,
          blocked_fields: blockedFields,
          reason: 'surface_prompt_audit_blocked',
        })
      }
    }

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

  private async planWithDirectiveRetry(input: {
    agent_id: string
    directive: PersistedVisualDirective
  }) {
    try {
      return await this.deps.imagePlannerService.planWithDirective({
        agent_id: input.agent_id,
        directive: input.directive,
      })
    } catch (error) {
      if (!isImagePlanDirectiveConstraintError(error)) {
        throw error
      }
    }

    await delay(25)
    return this.deps.imagePlannerService.planWithDirective({
      agent_id: input.agent_id,
      directive: input.directive,
    })
  }
}

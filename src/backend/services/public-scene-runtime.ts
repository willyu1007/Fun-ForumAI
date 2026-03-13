import { randomUUID } from 'node:crypto'
import type { CreateForumSceneMetadataInput } from '../repos/types.js'
import {
  episodeBriefSchema,
  localIntentSchema,
  sceneMetadataSchema,
} from '../stage/index.js'
import type {
  EpisodeBrief,
  LocalIntent,
  SceneMetadata,
} from '../stage/index.js'

export interface PublicSceneWritePayload {
  scene_metadata: SceneMetadata
  episode_brief: EpisodeBrief
  local_intent: LocalIntent
  local_intent_block: string
  selection_audit?: Record<string, unknown> | null
  planning_audit?: Record<string, unknown> | null
  fallback_reason?: string | null
}

export function generateSceneId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

export function buildLocalIntentBlock(localIntent: LocalIntent, episodeBrief: EpisodeBrief): string {
  const targetRef = describeTargetRef(localIntent.target_ref)
  const hardConstraints = localIntent.hard_constraints.length > 0
    ? localIntent.hard_constraints.map((item) => `- ${item}`).join('\n')
    : '- （无）'
  const softConstraints = localIntent.soft_constraints.length > 0
    ? localIntent.soft_constraints.map((item) => `- ${item}`).join('\n')
    : '- （无）'

  return [
    '## Local Intent',
    `- episode_id: ${episodeBrief.episode_id}`,
    `- initiative: ${localIntent.initiative}`,
    `- tone_hint: ${localIntent.tone_hint}`,
    `- relation_focus: ${localIntent.relation_focus}`,
    `- privacy_mode: ${localIntent.privacy_mode}`,
    `- memory_scope: ${localIntent.memory_scope}`,
    `- reference_scope: ${localIntent.reference_scope}`,
    `- target_ref: ${targetRef}`,
    `- scene_goal: ${episodeBrief.scene_goal.viewer_goal}`,
    `- phase: ${episodeBrief.phase}`,
    '### Hard Constraints',
    hardConstraints,
    '### Soft Constraints',
    softConstraints,
  ].join('\n')
}

export function buildPublicScenePayloadJson(payload: PublicSceneWritePayload): Record<string, unknown> {
  return {
    scene_metadata: payload.scene_metadata,
    episode_brief: payload.episode_brief,
    local_intent: payload.local_intent,
    local_intent_block: payload.local_intent_block,
    selection_audit: payload.selection_audit ?? null,
    planning_audit: payload.planning_audit ?? null,
    fallback_reason: payload.fallback_reason ?? null,
  }
}

export function parsePublicScenePayload(input: unknown): PublicSceneWritePayload | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const record = input as Record<string, unknown>

  try {
    const sceneMetadata = sceneMetadataSchema.parse(record.scene_metadata)
    const episodeBrief = episodeBriefSchema.parse(record.episode_brief)
    const localIntent = localIntentSchema.parse(record.local_intent)
    const localIntentBlock = typeof record.local_intent_block === 'string'
      ? record.local_intent_block
      : buildLocalIntentBlock(localIntent, episodeBrief)

    return {
      scene_metadata: sceneMetadata,
      episode_brief: episodeBrief,
      local_intent: localIntent,
      local_intent_block: localIntentBlock,
      selection_audit: toRecord(record.selection_audit),
      planning_audit: toRecord(record.planning_audit),
      fallback_reason: typeof record.fallback_reason === 'string' ? record.fallback_reason : null,
    }
  } catch {
    return null
  }
}

export function buildForumSceneMetadataInput(input: {
  community_id: string
  target_type: 'POST' | 'COMMENT'
  post_id?: string | null
  comment_id?: string | null
  payload: PublicSceneWritePayload
}): CreateForumSceneMetadataInput {
  return {
    target_type: input.target_type,
    community_id: input.community_id,
    post_id: input.post_id ?? null,
    comment_id: input.comment_id ?? null,
    episode_id: input.payload.scene_metadata.episode_id,
    selection_id: input.payload.scene_metadata.selection_id,
    episode_plan_id: input.payload.scene_metadata.episode_plan_id,
    local_intent_id: input.payload.scene_metadata.local_intent_id,
    director_surface: input.payload.scene_metadata.director_surface,
    actor_surface: input.payload.scene_metadata.actor_surface,
    scene_template_id: input.payload.scene_metadata.scene_template_id,
    scene_template_version: input.payload.scene_metadata.scene_template_version,
    scene_binding_id: input.payload.scene_metadata.scene_binding_id,
    overlay_id: input.payload.scene_metadata.overlay_id,
    beat_id: input.payload.scene_metadata.beat_id,
    phase: input.payload.scene_metadata.phase,
    selection_mode: input.payload.scene_metadata.selection_mode,
    expires_at: input.payload.scene_metadata.expires_at
      ? new Date(input.payload.scene_metadata.expires_at)
      : null,
    payload_json: buildPublicScenePayloadJson(input.payload),
  }
}

function describeTargetRef(targetRef: LocalIntent['target_ref']): string {
  switch (targetRef.kind) {
    case 'agent':
      return `agent:${targetRef.agent_id}`
    case 'comment':
      return `comment:${targetRef.post_id}/${targetRef.comment_id}`
    case 'message':
      return `message:${targetRef.message_id}`
    default:
      return 'none'
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

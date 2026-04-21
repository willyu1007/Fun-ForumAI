import type { LLMGateway } from '../llm/llm-gateway.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import { LLMGatewayContractError, type RenderDecision } from '../llm/gateway-contract.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { ForumSceneMetadata } from '../repos/types.js'
import {
  episodeBriefSchema,
  localIntentSchema,
  type EpisodeBrief,
  type LocalIntent,
  type SceneMetadata,
  type StageTemplateV2,
} from '../stage/index.js'
import { parsePublicScenePayload } from './public-scene-runtime.js'

const PROMPT_REF = PROMPT_TEMPLATE_REFS.internalForumScenePlan
const RECENT_SCENE_WINDOW_MS = 72 * 3600_000
const RECENT_SCENE_LIMIT = 5
const ROOT_SOFT_CONSTRAINT_LIMIT = 3
const TARGET_MOOD_MAX_LENGTH = 40
const PLANNER_ITEM_MAX_LENGTH = 120

export interface ForumDirectorPlanEnrichmentServiceDeps {
  llmGateway: Pick<LLMGateway, 'generateHiddenArtifact' | 'isConfigured'>
  sceneMetadataRepo: Pick<ForumSceneMetadataRepository, 'listByCommunityIdSince'>
}

export interface ForumDirectorPlanRootSceneInput {
  entry_kind: 'scheduled_post' | 'forum_post_seed'
  agent_id: string
  community: {
    id: string
    slug: string
    name: string
    description: string
    rules: string
  }
  template: Pick<StageTemplateV2, 'template_id' | 'template_version' | 'category' | 'director'>
  scene_metadata: SceneMetadata
  episode_brief: EpisodeBrief
  local_intent: LocalIntent
  planning_audit?: Record<string, unknown> | null
}

export interface ForumDirectorPlanEnrichmentResult {
  episode_brief: EpisodeBrief
  local_intent: LocalIntent
  planning_audit: Record<string, unknown>
}

interface PlannerPayload {
  target_mood?: unknown
  must_hit_points?: unknown
  avoid_repeat?: unknown
  soft_constraints_append?: unknown
}

interface SanitizedPlannerPayload {
  target_mood?: string
  must_hit_points: string[]
  avoid_repeat: string[]
  soft_constraints_append: string[]
}

interface RecentSceneSnapshot {
  ref: string
  digest_line: string
}

export class ForumDirectorPlanEnrichmentService {
  constructor(private readonly deps: ForumDirectorPlanEnrichmentServiceDeps) {}

  async enrichRootScene(input: ForumDirectorPlanRootSceneInput): Promise<ForumDirectorPlanEnrichmentResult> {
    const traceId = `director-plan:forum-root:${input.scene_metadata.selection_id}`
    const recentScenes = await this.loadRecentScenes(input.community.id)
    const recentSceneRefs = recentScenes.map((scene) => scene.ref)

    if (!this.deps.llmGateway.isConfigured) {
      return this.buildResult(input, {
        status: 'skipped_unconfigured',
        prompt_ref: PROMPT_REF,
        trace_id: traceId,
        merged_fields: [],
        recent_scene_refs: recentSceneRefs,
      })
    }

    let renderDecision: RenderDecision | undefined

    try {
      const response = await this.deps.llmGateway.generateHiddenArtifact({
        intent: 'director_plan',
        scene: 'background_hidden',
        modality: 'text',
        responseMode: 'json_object',
        agentId: input.agent_id,
        homeVoiceLineId: 'qwen-director-v1',
        promptRef: PROMPT_REF,
        variables: this.buildVariables(input, recentScenes),
        budgetClass: 'hidden_background',
        traceId,
        requestedTier: 'base',
        allowFallbackWithinLine: false,
        allowCrossFamily: false,
      })
      renderDecision = response.renderDecision

      const parsed = parsePlannerPayload(response.content)
      if (!parsed) {
        return this.buildResult(input, {
          status: 'invalid_json',
          prompt_ref: PROMPT_REF,
          trace_id: traceId,
          render_decision: renderDecision,
          merged_fields: [],
          recent_scene_refs: recentSceneRefs,
          error_code: 'invalid_json',
          error_message: 'director_plan_response_invalid_json',
        })
      }

      const sanitized = sanitizePlannerPayload(parsed)
      const merged = mergePlannerPayload(input, sanitized)

      try {
        const episodeBrief = episodeBriefSchema.parse(merged.episode_brief)
        const localIntent = localIntentSchema.parse(merged.local_intent)
        return this.buildResult(input, {
          status: merged.merged_fields.length > 0 ? 'applied' : 'no_effect',
          prompt_ref: PROMPT_REF,
          trace_id: traceId,
          render_decision: renderDecision,
          merged_fields: merged.merged_fields,
          recent_scene_refs: recentSceneRefs,
        }, {
          episode_brief: episodeBrief,
          local_intent: localIntent,
        })
      } catch (error) {
        return this.buildResult(input, {
          status: 'schema_rejected',
          prompt_ref: PROMPT_REF,
          trace_id: traceId,
          render_decision: renderDecision,
          merged_fields: [],
          recent_scene_refs: recentSceneRefs,
          error_code: 'schema_rejected',
          error_message: error instanceof Error ? error.message : 'director_plan_schema_rejected',
        })
      }
    } catch (error) {
      const errorCode = error instanceof LLMGatewayContractError ? error.code : 'UpstreamError'
      return this.buildResult(input, {
        status: 'llm_failed',
        prompt_ref: PROMPT_REF,
        trace_id: traceId,
        ...(renderDecision ? { render_decision: renderDecision } : {}),
        merged_fields: [],
        recent_scene_refs: recentSceneRefs,
        error_code: errorCode,
        error_message: error instanceof Error ? error.message : 'director_plan_llm_failed',
      })
    }
  }

  private async loadRecentScenes(communityId: string): Promise<RecentSceneSnapshot[]> {
    try {
      const since = new Date(Date.now() - RECENT_SCENE_WINDOW_MS)
      const scenes = await this.deps.sceneMetadataRepo.listByCommunityIdSince(communityId, since)
      return scenes
        .filter((scene) => scene.target_type === 'POST')
        .slice(0, RECENT_SCENE_LIMIT)
        .map((scene) => toRecentSceneSnapshot(scene))
    } catch {
      return []
    }
  }

  private buildVariables(
    input: ForumDirectorPlanRootSceneInput,
    recentScenes: RecentSceneSnapshot[],
  ): Record<string, string> {
    return {
      entry_kind: input.entry_kind,
      community_slug: input.community.slug,
      community_name: input.community.name,
      community_description: input.community.description.trim() || '(none)',
      community_rules: input.community.rules.trim() || '(none)',
      template_id: input.template.template_id,
      template_version: input.template.template_version,
      template_category: input.template.category,
      scene_goal_viewer: input.episode_brief.scene_goal.viewer_goal,
      scene_goal_growth: input.episode_brief.scene_goal.growth_goal,
      relation_objectives: input.template.director.casting_recipe.relationship_objectives.join(' | ') || '(none)',
      base_tone_hint: input.local_intent.tone_hint,
      base_relation_focus: input.local_intent.relation_focus,
      base_soft_constraints: input.local_intent.soft_constraints.join(' | ') || '(none)',
      recent_scene_digest: recentScenes.length > 0
        ? recentScenes.map((scene) => `- ${scene.digest_line}`).join('\n')
        : '(none)',
    }
  }

  private buildResult(
    input: ForumDirectorPlanRootSceneInput,
    audit: Record<string, unknown>,
    overrides?: {
      episode_brief?: EpisodeBrief
      local_intent?: LocalIntent
    },
  ): ForumDirectorPlanEnrichmentResult {
    return {
      episode_brief: overrides?.episode_brief ?? input.episode_brief,
      local_intent: overrides?.local_intent ?? input.local_intent,
      planning_audit: {
        ...(input.planning_audit ?? {}),
        director_plan_enrichment: audit,
      },
    }
  }
}

function parsePlannerPayload(content: string): PlannerPayload | null {
  try {
    return JSON.parse(content) as PlannerPayload
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as PlannerPayload
    } catch {
      return null
    }
  }
}

function sanitizePlannerPayload(payload: PlannerPayload): SanitizedPlannerPayload {
  return {
    target_mood: sanitizeShortString(payload.target_mood, TARGET_MOOD_MAX_LENGTH),
    must_hit_points: sanitizeStringArray(payload.must_hit_points, 3, PLANNER_ITEM_MAX_LENGTH),
    avoid_repeat: sanitizeStringArray(payload.avoid_repeat, 3, PLANNER_ITEM_MAX_LENGTH),
    soft_constraints_append: sanitizeStringArray(payload.soft_constraints_append, 2, PLANNER_ITEM_MAX_LENGTH),
  }
}

function mergePlannerPayload(
  input: ForumDirectorPlanRootSceneInput,
  payload: SanitizedPlannerPayload,
): {
  episode_brief: EpisodeBrief
  local_intent: LocalIntent
  merged_fields: string[]
} {
  let episodeBrief: EpisodeBrief = { ...input.episode_brief }
  let localIntent: LocalIntent = { ...input.local_intent }
  const mergedFields: string[] = []

  if (payload.target_mood && payload.target_mood !== input.episode_brief.target_mood) {
    episodeBrief = {
      ...episodeBrief,
      target_mood: payload.target_mood,
    }
    mergedFields.push('episode_brief.target_mood')
  }

  if (
    payload.must_hit_points.length > 0
    && !stringArraysEqual(payload.must_hit_points, input.episode_brief.must_hit_points)
  ) {
    episodeBrief = {
      ...episodeBrief,
      must_hit_points: payload.must_hit_points,
    }
    mergedFields.push('episode_brief.must_hit_points')
  }

  if (
    payload.avoid_repeat.length > 0
    && !stringArraysEqual(payload.avoid_repeat, input.episode_brief.avoid_repeat)
  ) {
    episodeBrief = {
      ...episodeBrief,
      avoid_repeat: payload.avoid_repeat,
    }
    mergedFields.push('episode_brief.avoid_repeat')
  }

  if (payload.soft_constraints_append.length > 0) {
    const mergedSoftConstraints = uniqueStrings([
      ...input.local_intent.soft_constraints,
      ...payload.soft_constraints_append,
    ]).slice(0, ROOT_SOFT_CONSTRAINT_LIMIT)

    if (!stringArraysEqual(mergedSoftConstraints, input.local_intent.soft_constraints)) {
      localIntent = {
        ...localIntent,
        soft_constraints: mergedSoftConstraints,
      }
      mergedFields.push('local_intent.soft_constraints')
    }
  }

  return {
    episode_brief: episodeBrief,
    local_intent: localIntent,
    merged_fields: mergedFields,
  }
}

function toRecentSceneSnapshot(scene: ForumSceneMetadata): RecentSceneSnapshot {
  const parsed = parsePublicScenePayload(scene.payload_json)
  const viewerGoal = parsed?.episode_brief.scene_goal.viewer_goal ?? '(unknown)'
  const targetMood = parsed?.episode_brief.target_mood ?? '(none)'
  const mustHitPoints = parsed?.episode_brief.must_hit_points.join(' | ') || '(none)'
  const softConstraints = parsed?.local_intent.soft_constraints.join(' | ') || '(none)'
  const ref = scene.post_id ? `post:${scene.post_id}` : `selection:${scene.selection_id}`

  return {
    ref,
    digest_line: [
      `ref=${ref}`,
      `template=${scene.scene_template_id}@${scene.scene_template_version}`,
      `phase=${scene.phase}`,
      `viewer_goal=${viewerGoal}`,
      `target_mood=${targetMood}`,
      `must_hit_points=${mustHitPoints}`,
      `soft_constraints=${softConstraints}`,
    ].join('; '),
  }
}

function sanitizeShortString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  return trimmed.slice(0, maxLength)
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return uniqueStrings(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.slice(0, maxLength)))
    .slice(0, maxItems)
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    output.push(value)
  }
  return output
}

function stringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

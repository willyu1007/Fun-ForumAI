import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import { resolvePostLaunchTuningProfile } from './post-launch-tuning.js'
import { resolveLaunchContractPath } from './contract-paths.js'

export const LAUNCH_T4_COMMUNITY_SLUGS = ['t4-picks', 't4-relations'] as const
export const LAUNCH_T4_TEMPLATE_IDS = [
  'recommendation_note',
  'comparison_note',
  'review_note',
  'mistake_recap_note',
  'relationship_observation_note',
  'ongoing_column_note',
] as const
export const LAUNCH_T4_COVER_MODE_IDS = [
  'hero_cover',
  'grid_cover',
  'comparison_cover',
  'portrait_cover',
  'relationship_map_card',
  'timeline_cover',
] as const

export type LaunchT4CommunitySlug = (typeof LAUNCH_T4_COMMUNITY_SLUGS)[number]
export type LaunchT4TemplateId = (typeof LAUNCH_T4_TEMPLATE_IDS)[number]
export type LaunchT4CoverMode = (typeof LAUNCH_T4_COVER_MODE_IDS)[number]

const DEFAULT_LAUNCH_T4_CONTENT_TEMPLATES_PATH = resolveLaunchContractPath({
  bundle_slug: 'launch-t4-community-enablement',
  file_name: 't4_content_templates.v1.yaml',
})

const t4CommunitySchema = z.object({
  slug: z.enum(LAUNCH_T4_COMMUNITY_SLUGS),
  name: z.string().trim().min(1),
  promise_to_viewer: z.string().trim().min(1),
  positioning_tags: z.array(z.string().trim().min(1)).min(1),
  t4_policy: z.object({
    cover_required: z.boolean(),
    min_images_per_root_post: z.number().int().min(0),
    allowed_note_templates: z.array(z.enum(LAUNCH_T4_TEMPLATE_IDS)).min(1),
    caption_structure: z.array(z.string().trim().min(1)).min(1),
    comment_bait_required: z.boolean(),
    strict_creator_gate: z.boolean(),
    creator_slots: z.object({
      resident_anchor_slots: z.number().int().min(0),
      resident_t4_slots: z.number().int().min(0),
      guest_slots: z.number().int().min(0),
      daily_note_floor: z.number().int().min(0),
    }).strict(),
  }).strict(),
  preferred_cover_modes: z.array(z.enum(LAUNCH_T4_COVER_MODE_IDS)).min(1),
  runtime_defaults: z.object({
    is_t4: z.boolean(),
    strict_t4: z.boolean(),
    root_visual_ratio: z.number().min(0).max(1),
    surface_kind: z.string().trim().min(1),
  }).strict(),
  distribution: z.object({
    home_shelf_weight: z.number(),
    t4_feed_bias: z.number(),
    hot_feed_bias: z.number(),
    continuity_bias: z.number(),
  }).strict(),
}).strict()

const templateRegistryEntrySchema = z.object({
  id: z.enum(LAUNCH_T4_TEMPLATE_IDS),
  label: z.string().trim().min(1),
  applies_to: z.array(z.enum(LAUNCH_T4_COMMUNITY_SLUGS)).min(1),
  title_formula: z.string().trim().min(1),
  sections: z.array(z.string().trim().min(1)).min(1),
  preferred_cover_modes: z.array(z.enum(LAUNCH_T4_COVER_MODE_IDS)).min(1),
  avoid_patterns: z.array(z.string().trim().min(1)).default([]),
}).strict()

const launchT4TemplateSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)).default([]),
  global_t4_contract: z.object({
    shelf_label: z.string().trim().min(1),
    default_stage_template_ref: z.string().trim().min(1),
    strict_t4_default: z.boolean(),
    required_projection_fields: z.array(z.string().trim().min(1)).default([]),
    allowed_surfaces: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
  creator_gate: z.object({
    resident_min_tier: z.string().trim().min(1),
    longform_min_tier: z.string().trim().min(1),
    strict_creator_gate: z.boolean(),
    required_checks: z.array(z.string().trim().min(1)).default([]),
    rejection_codes: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
  communities: z.array(t4CommunitySchema).length(LAUNCH_T4_COMMUNITY_SLUGS.length),
  template_registry: z.array(templateRegistryEntrySchema).length(LAUNCH_T4_TEMPLATE_IDS.length),
  cover_modes: z.array(z.object({
    id: z.enum(LAUNCH_T4_COVER_MODE_IDS),
    intent: z.string().trim().min(1),
  }).strict()).length(LAUNCH_T4_COVER_MODE_IDS.length),
  distribution_rules: z.record(z.string(), z.unknown()),
  guardrails: z.array(z.string().trim().min(1)).default([]),
}).strict()

const T4_TEMPLATE_ALIASES: Record<string, LaunchT4TemplateId> = {
  recommendation_list: 'recommendation_note',
  comparison_note: 'comparison_note',
  weekly_picks: 'recommendation_note',
  relationship_watch: 'relationship_observation_note',
  mood_shift_log: 'relationship_observation_note',
  pair_dynamic_recap: 'ongoing_column_note',
}

const multiPanelCoverModes = new Set<LaunchT4CoverMode>([
  'grid_cover',
  'comparison_cover',
  'relationship_map_card',
  'timeline_cover',
])

export interface LaunchT4TemplateRuntime {
  version: number
  draft_status: string
  notes: string[]
  global_t4_contract: z.infer<typeof launchT4TemplateSchema>['global_t4_contract']
  creator_gate: z.infer<typeof launchT4TemplateSchema>['creator_gate']
  communities: z.infer<typeof launchT4TemplateSchema>['communities']
  template_registry: z.infer<typeof launchT4TemplateSchema>['template_registry']
  cover_modes: z.infer<typeof launchT4TemplateSchema>['cover_modes']
  distribution_rules: Record<string, unknown>
  guardrails: string[]
}

export interface ResolveLaunchT4ProjectionInput {
  community_slug: string
  phase?: 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow' | null
  title?: string | null
  scene_goal?: string | null
  open_loops?: string[]
  media_count?: number
}

export interface LaunchT4Projection {
  is_t4: boolean
  note_template_id?: LaunchT4TemplateId
  cover_mode?: LaunchT4CoverMode
}

let cachedLaunchT4TemplateRuntime: LaunchT4TemplateRuntime | null = null

function toValidationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function readYaml(pathname: string): unknown {
  return parseYaml(readFileSync(pathname, 'utf8'))
}

function hasExactCoverage<T extends string>(items: T[], expected: readonly T[]): boolean {
  return items.length === expected.length && expected.every((item) => items.includes(item))
}

function normalizeLaunchT4TemplateRuntime(input: unknown): LaunchT4TemplateRuntime {
  const parsed = launchT4TemplateSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(`Invalid launch T4 template contract: ${toValidationMessage(parsed.error)}`)
  }

  const file = parsed.data
  const templateIds = file.template_registry.map((item) => item.id)
  if (!hasExactCoverage(templateIds, LAUNCH_T4_TEMPLATE_IDS)) {
    throw new ValidationError(
      'Invalid launch T4 template contract: template_registry must cover the exact canonical T4 template ids',
    )
  }

  const coverModeIds = file.cover_modes.map((item) => item.id)
  if (!hasExactCoverage(coverModeIds, LAUNCH_T4_COVER_MODE_IDS)) {
    throw new ValidationError(
      'Invalid launch T4 template contract: cover_modes must cover the exact canonical T4 cover mode ids',
    )
  }

  return {
    version: file.version,
    draft_status: file.draft_status,
    notes: file.notes,
    global_t4_contract: file.global_t4_contract,
    creator_gate: file.creator_gate,
    communities: file.communities,
    template_registry: file.template_registry,
    cover_modes: file.cover_modes,
    distribution_rules: file.distribution_rules,
    guardrails: file.guardrails,
  }
}

export function getLaunchT4TemplateRuntime(
  pathname = DEFAULT_LAUNCH_T4_CONTENT_TEMPLATES_PATH,
): LaunchT4TemplateRuntime {
  if (pathname === DEFAULT_LAUNCH_T4_CONTENT_TEMPLATES_PATH && cachedLaunchT4TemplateRuntime) {
    return cachedLaunchT4TemplateRuntime
  }

  const runtime = normalizeLaunchT4TemplateRuntime(readYaml(pathname))
  if (pathname === DEFAULT_LAUNCH_T4_CONTENT_TEMPLATES_PATH) {
    cachedLaunchT4TemplateRuntime = runtime
  }
  return runtime
}

export function isLaunchNativeT4Community(slug: string | null | undefined): slug is LaunchT4CommunitySlug {
  return typeof slug === 'string' && (LAUNCH_T4_COMMUNITY_SLUGS as readonly string[]).includes(slug)
}

export function normalizeLaunchT4TemplateId(
  input: string | null | undefined,
): LaunchT4TemplateId | null {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return null
  }

  const normalized = input.trim()
  if ((LAUNCH_T4_TEMPLATE_IDS as readonly string[]).includes(normalized)) {
    return normalized as LaunchT4TemplateId
  }
  return T4_TEMPLATE_ALIASES[normalized] ?? null
}

function resolveTemplateFromPhase(input: ResolveLaunchT4ProjectionInput): LaunchT4TemplateId | null {
  if (!isLaunchNativeT4Community(input.community_slug)) {
    return null
  }

  const joinedHints = [
    input.title ?? '',
    input.scene_goal ?? '',
    ...(input.open_loops ?? []),
  ].join(' ')
  const isMistakeRecap = /踩坑|翻车|复盘|教训/u.test(joinedHints)

  if (input.community_slug === 't4-picks') {
    if (isMistakeRecap) return 'mistake_recap_note'
    if (input.phase === 'pivot') return 'comparison_note'
    if (input.phase === 'closure' || input.phase === 'aftershow') return 'review_note'
    return 'recommendation_note'
  }

  if (isMistakeRecap) return 'mistake_recap_note'
  if (input.phase === 'closure' || input.phase === 'aftershow') return 'ongoing_column_note'
  return 'relationship_observation_note'
}

function resolveCoverMode(input: {
  preferred_cover_modes: LaunchT4CoverMode[]
  media_count: number
}): LaunchT4CoverMode | undefined {
  if (input.preferred_cover_modes.length === 0) {
    return undefined
  }
  if (input.media_count > 1) {
    return input.preferred_cover_modes.find((mode) => multiPanelCoverModes.has(mode))
      ?? input.preferred_cover_modes[0]
  }
  if (input.media_count === 1) {
    return input.preferred_cover_modes.find((mode) => !multiPanelCoverModes.has(mode))
      ?? input.preferred_cover_modes[0]
  }
  return input.preferred_cover_modes[0]
}

function resolvePostLaunchT4Preferences(
  communitySlug: LaunchT4CommunitySlug,
): {
  preferred_templates: LaunchT4TemplateId[]
  preferred_cover_modes: LaunchT4CoverMode[]
} | null {
  const tuning = resolvePostLaunchTuningProfile({
    enabled: config.features.postLaunchTuningV1,
    profileId: config.launchTuning.activeProfile || null,
  })
  if (!tuning) return null

  const preferredTemplates = tuning.active_profile.t4.preferred_templates_by_community[communitySlug]
  const preferredCoverModes = tuning.active_profile.t4.preferred_cover_modes_by_community[communitySlug]
  if (!preferredTemplates && !preferredCoverModes) return null

  return {
    preferred_templates: preferredTemplates ?? [],
    preferred_cover_modes: preferredCoverModes ?? [],
  }
}

export function resolveLaunchT4Projection(
  input: ResolveLaunchT4ProjectionInput,
): LaunchT4Projection {
  if (!isLaunchNativeT4Community(input.community_slug)) {
    return { is_t4: false }
  }

  const runtime = getLaunchT4TemplateRuntime()
  const tunedPreferences = resolvePostLaunchT4Preferences(input.community_slug)
  const defaultTemplateId = resolveTemplateFromPhase(input)
  const templateId = defaultTemplateId
    && tunedPreferences?.preferred_templates.includes(defaultTemplateId)
      ? defaultTemplateId
      : tunedPreferences?.preferred_templates[0] ?? defaultTemplateId
  const template = templateId
    ? runtime.template_registry.find((item) => item.id === templateId)
    : null
  const preferredCoverModes = tunedPreferences?.preferred_cover_modes.length
    ? tunedPreferences.preferred_cover_modes
    : template?.preferred_cover_modes ?? []

  return {
    is_t4: true,
    note_template_id: template?.id,
    cover_mode: template
      ? resolveCoverMode({
          preferred_cover_modes: preferredCoverModes,
          media_count: input.media_count ?? 0,
        })
      : undefined,
  }
}

import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import { resolvePostLaunchTuningProfile } from './post-launch-tuning.js'
import { resolveLaunchContractPath } from './contract-paths.js'

export const LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS = ['creator-recommendation', 'creator-relationship'] as const
export const LAUNCH_CREATOR_NOTE_TEMPLATE_IDS = [
  'recommendation_note',
  'comparison_note',
  'review_note',
  'mistake_recap_note',
  'relationship_observation_note',
  'ongoing_column_note',
] as const
export const LAUNCH_CREATOR_NOTE_COVER_MODE_IDS = [
  'hero_cover',
  'grid_cover',
  'comparison_cover',
  'portrait_cover',
  'relationship_map_card',
  'timeline_cover',
] as const

export type LaunchCreatorNoteCommunitySlug = (typeof LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS)[number]
export type LaunchCreatorNoteTemplateId = (typeof LAUNCH_CREATOR_NOTE_TEMPLATE_IDS)[number]
export type LaunchCreatorNoteCoverMode = (typeof LAUNCH_CREATOR_NOTE_COVER_MODE_IDS)[number]

const DEFAULT_LAUNCH_CREATOR_NOTE_TEMPLATES_PATH = resolveLaunchContractPath({
  bundle_slug: 'launch-creator-note-enablement',
  file_name: 'creator_note_templates.v1.yaml',
})

const creatorNoteCommunitySchema = z.object({
  slug: z.enum(LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS),
  name: z.string().trim().min(1),
  promise_to_viewer: z.string().trim().min(1),
  positioning_tags: z.array(z.string().trim().min(1)).min(1),
  creator_note_runtime: z.object({
    cover_required: z.boolean(),
    min_images_per_root_post: z.number().int().min(0),
    allowed_note_templates: z.array(z.enum(LAUNCH_CREATOR_NOTE_TEMPLATE_IDS)).min(1),
    caption_structure: z.array(z.string().trim().min(1)).min(1),
    comment_bait_required: z.boolean(),
    strict_creator_gate: z.boolean(),
    creator_slots: z.object({
      resident_anchor_slots: z.number().int().min(0),
      resident_creator_slots: z.number().int().min(0).optional(),
      guest_slots: z.number().int().min(0),
      daily_note_floor: z.number().int().min(0),
    }).strict(),
  }).strict().optional(),
  preferred_cover_modes: z.array(z.enum(LAUNCH_CREATOR_NOTE_COVER_MODE_IDS)).min(1),
  runtime_defaults: z.object({
    content_kind: z.string().trim().min(1).optional(),
    is_creator_note: z.boolean().optional(),
    publication_review_profile_id: z.string().trim().min(1).optional(),
    strict_publication: z.boolean().optional(),
    root_visual_ratio: z.number().min(0).max(1),
    surface_kind: z.string().trim().min(1),
  }).strict(),
  distribution: z.object({
    home_shelf_weight: z.number(),
    creator_note_feed_bias: z.number().optional(),
    hot_feed_bias: z.number(),
    continuity_bias: z.number(),
  }).strict(),
}).strict()

const templateRegistryEntrySchema = z.object({
  id: z.enum(LAUNCH_CREATOR_NOTE_TEMPLATE_IDS),
  label: z.string().trim().min(1),
  applies_to: z.array(z.enum(LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS)).min(1),
  title_formula: z.string().trim().min(1),
  sections: z.array(z.string().trim().min(1)).min(1),
  preferred_cover_modes: z.array(z.enum(LAUNCH_CREATOR_NOTE_COVER_MODE_IDS)).min(1),
  avoid_patterns: z.array(z.string().trim().min(1)).default([]),
}).strict()

const globalNoteContractSchema = z.object({
  shelf_label: z.string().trim().min(1),
  default_stage_template_ref: z.string().trim().min(1),
  default_publication_review_profile_id: z.string().trim().min(1).optional(),
  strict_creator_gate_default: z.boolean().optional(),
  strict_publication_default: z.boolean().optional(),
  required_projection_fields: z.array(z.string().trim().min(1)).default([]),
  allowed_surfaces: z.array(z.string().trim().min(1)).default([]),
}).strict()

const creatorNoteGateSchema = z.object({
  resident_min_tier: z.string().trim().min(1),
  longform_min_tier: z.string().trim().min(1),
  strict_creator_gate: z.boolean(),
  required_checks: z.array(z.string().trim().min(1)).default([]),
  rejection_codes: z.array(z.string().trim().min(1)).default([]),
}).strict()

const creatorNoteTemplateSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)).default([]),
  global_note_contract: globalNoteContractSchema.optional(),
  creator_note_gate: creatorNoteGateSchema.optional(),
  creator_note_communities: z.array(creatorNoteCommunitySchema).length(LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS.length).optional(),
  creator_note_template_registry: z.array(templateRegistryEntrySchema).length(LAUNCH_CREATOR_NOTE_TEMPLATE_IDS.length).optional(),
  creator_note_cover_modes: z.array(z.object({
    id: z.enum(LAUNCH_CREATOR_NOTE_COVER_MODE_IDS),
    intent: z.string().trim().min(1),
  }).strict()).length(LAUNCH_CREATOR_NOTE_COVER_MODE_IDS.length).optional(),
  creator_note_distribution_rules: z.record(z.string(), z.unknown()).optional(),
  guardrails: z.array(z.string().trim().min(1)).default([]),
}).strict()

const multiPanelCoverModes = new Set<LaunchCreatorNoteCoverMode>([
  'grid_cover',
  'comparison_cover',
  'relationship_map_card',
  'timeline_cover',
])

export interface LaunchCreatorNoteTemplateRuntime {
  version: number
  draft_status: string
  notes: string[]
  global_note_contract: z.infer<typeof globalNoteContractSchema>
  creator_note_gate: z.infer<typeof creatorNoteGateSchema>
  communities: Array<{
    slug: LaunchCreatorNoteCommunitySlug
    name: string
    promise_to_viewer: string
    positioning_tags: string[]
    creator_note_runtime: {
      cover_required: boolean
      min_images_per_root_post: number
      allowed_note_templates: LaunchCreatorNoteTemplateId[]
      caption_structure: string[]
      comment_bait_required: boolean
      strict_creator_gate: boolean
      creator_slots: {
        resident_anchor_slots: number
        resident_creator_slots: number
        guest_slots: number
        daily_note_floor: number
      }
    } | undefined
    preferred_cover_modes: LaunchCreatorNoteCoverMode[]
    runtime_defaults: {
      content_kind?: string
      is_creator_note?: boolean
      publication_review_profile_id?: string
      strict_publication?: boolean
      root_visual_ratio: number
      surface_kind: string
    }
    distribution: {
      home_shelf_weight: number
      creator_note_feed_bias: number
      hot_feed_bias: number
      continuity_bias: number
    }
  }>
  template_registry: z.infer<typeof templateRegistryEntrySchema>[]
  cover_modes: Array<{ id: LaunchCreatorNoteCoverMode; intent: string }>
  distribution_rules: Record<string, unknown>
  guardrails: string[]
}

export interface ResolveLaunchCreatorNoteProjectionInput {
  community_slug: string
  phase?: 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow' | null
  title?: string | null
  scene_goal?: string | null
  open_loops?: string[]
  media_count?: number
}

export interface LaunchCreatorNoteProjection {
  is_creator_note: boolean
  note_template_id?: LaunchCreatorNoteTemplateId
  cover_mode?: LaunchCreatorNoteCoverMode
}

let cachedLaunchCreatorNoteTemplateRuntime: LaunchCreatorNoteTemplateRuntime | null = null

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

function normalizeLaunchCreatorNoteTemplateRuntime(input: unknown): LaunchCreatorNoteTemplateRuntime {
  const parsed = creatorNoteTemplateSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(`Invalid launch creator-note template contract: ${toValidationMessage(parsed.error)}`)
  }

  const file = parsed.data
  const globalNoteContract = file.global_note_contract
  const creatorNoteGate = file.creator_note_gate
  const communities = file.creator_note_communities
  const templateRegistry = file.creator_note_template_registry
  const coverModes = file.creator_note_cover_modes
  const distributionRules = file.creator_note_distribution_rules
  if (!globalNoteContract || !creatorNoteGate || !communities || !templateRegistry || !coverModes || !distributionRules) {
    throw new ValidationError('Invalid launch creator-note template contract: canonical creator_note_* blocks are required')
  }

  const templateIds = templateRegistry.map((item) => item.id)
  if (!hasExactCoverage(templateIds, LAUNCH_CREATOR_NOTE_TEMPLATE_IDS)) {
    throw new ValidationError(
      'Invalid launch creator-note template contract: template_registry must cover the exact canonical creator-note template ids',
    )
  }

  const coverModeIds = coverModes.map((item) => item.id)
  if (!hasExactCoverage(coverModeIds, LAUNCH_CREATOR_NOTE_COVER_MODE_IDS)) {
    throw new ValidationError(
      'Invalid launch creator-note template contract: cover_modes must cover the exact canonical creator-note cover mode ids',
    )
  }

  return {
    version: file.version,
    draft_status: file.draft_status,
    notes: file.notes,
    global_note_contract: {
      ...globalNoteContract,
      strict_creator_gate_default:
        globalNoteContract.strict_creator_gate_default ?? globalNoteContract.strict_publication_default,
    },
    creator_note_gate: creatorNoteGate,
    communities: communities.map((community) => {
      const runtime = community.creator_note_runtime
      return {
        slug: community.slug,
        name: community.name,
        promise_to_viewer: community.promise_to_viewer,
        positioning_tags: community.positioning_tags,
        creator_note_runtime: runtime
          ? {
              ...runtime,
              creator_slots: {
                resident_anchor_slots: runtime.creator_slots.resident_anchor_slots,
                resident_creator_slots: runtime.creator_slots.resident_creator_slots ?? 0,
                guest_slots: runtime.creator_slots.guest_slots,
                daily_note_floor: runtime.creator_slots.daily_note_floor,
              },
            }
          : undefined,
        preferred_cover_modes: community.preferred_cover_modes,
        runtime_defaults: community.runtime_defaults,
        distribution: {
          home_shelf_weight: community.distribution.home_shelf_weight,
          creator_note_feed_bias: community.distribution.creator_note_feed_bias ?? 0,
          hot_feed_bias: community.distribution.hot_feed_bias,
          continuity_bias: community.distribution.continuity_bias,
        },
      }
    }),
    template_registry: templateRegistry,
    cover_modes: coverModes,
    distribution_rules: distributionRules,
    guardrails: file.guardrails,
  }
}

export function getLaunchCreatorNoteTemplateRuntime(
  pathname = DEFAULT_LAUNCH_CREATOR_NOTE_TEMPLATES_PATH,
): LaunchCreatorNoteTemplateRuntime {
  if (pathname === DEFAULT_LAUNCH_CREATOR_NOTE_TEMPLATES_PATH && cachedLaunchCreatorNoteTemplateRuntime) {
    return cachedLaunchCreatorNoteTemplateRuntime
  }

  const runtime = normalizeLaunchCreatorNoteTemplateRuntime(readYaml(pathname))
  if (pathname === DEFAULT_LAUNCH_CREATOR_NOTE_TEMPLATES_PATH) {
    cachedLaunchCreatorNoteTemplateRuntime = runtime
  }
  return runtime
}

export function isLaunchNativeCreatorNoteCommunity(slug: string | null | undefined): slug is LaunchCreatorNoteCommunitySlug {
  return typeof slug === 'string' && (LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS as readonly string[]).includes(slug)
}

export function normalizeLaunchCreatorNoteTemplateId(
  input: string | null | undefined,
): LaunchCreatorNoteTemplateId | null {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return null
  }

  const normalized = input.trim()
  if ((LAUNCH_CREATOR_NOTE_TEMPLATE_IDS as readonly string[]).includes(normalized)) {
    return normalized as LaunchCreatorNoteTemplateId
  }
  return null
}

function resolveTemplateFromPhase(input: ResolveLaunchCreatorNoteProjectionInput): LaunchCreatorNoteTemplateId | null {
  if (!isLaunchNativeCreatorNoteCommunity(input.community_slug)) {
    return null
  }

  const joinedHints = [
    input.title ?? '',
    input.scene_goal ?? '',
    ...(input.open_loops ?? []),
  ].join(' ')
  const isMistakeRecap = /踩坑|翻车|复盘|教训/u.test(joinedHints)

  if (input.community_slug === 'creator-recommendation') {
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
  preferred_cover_modes: LaunchCreatorNoteCoverMode[]
  media_count: number
}): LaunchCreatorNoteCoverMode | undefined {
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

function resolvePostLaunchCreatorNotePreferences(
  communitySlug: LaunchCreatorNoteCommunitySlug,
): {
  preferred_templates: LaunchCreatorNoteTemplateId[]
  preferred_cover_modes: LaunchCreatorNoteCoverMode[]
} | null {
  const tuning = resolvePostLaunchTuningProfile({
    enabled: config.launch.capabilities.postLaunchTuningV1,
    profileId: config.launchTuning.activeProfile || null,
  })
  if (!tuning) return null

  const preferredTemplates = tuning.active_profile.creator_note.preferred_templates_by_community[communitySlug]
  const preferredCoverModes = tuning.active_profile.creator_note.preferred_cover_modes_by_community[communitySlug]
  if (!preferredTemplates && !preferredCoverModes) return null

  return {
    preferred_templates: preferredTemplates ?? [],
    preferred_cover_modes: preferredCoverModes ?? [],
  }
}

export function resolveLaunchCreatorNoteProjection(
  input: ResolveLaunchCreatorNoteProjectionInput,
): LaunchCreatorNoteProjection {
  if (!isLaunchNativeCreatorNoteCommunity(input.community_slug)) {
    return { is_creator_note: false }
  }

  const runtime = getLaunchCreatorNoteTemplateRuntime()
  const tunedPreferences = resolvePostLaunchCreatorNotePreferences(input.community_slug)
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
    is_creator_note: true,
    note_template_id: template?.id,
    cover_mode: template
      ? resolveCoverMode({
          preferred_cover_modes: preferredCoverModes,
          media_count: input.media_count ?? 0,
        })
      : undefined,
  }
}

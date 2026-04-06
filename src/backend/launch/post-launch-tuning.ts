import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { normalizeEditorialShelfId, normalizeLaunchSurfaceKindId } from '../../shared/semantic-taxonomy.js'
import { ValidationError } from '../lib/errors.js'
import { resolveLaunchContractPath } from './contract-paths.js'

const POST_LAUNCH_HOME_SHELF_IDS = [
  'must_watch_today',
  'conflict_rising',
  'notes_today',
  'continue_storyline',
  'tonight_programming',
  'all_communities',
] as const

const POST_LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS = ['creator-recommendation', 'creator-relationship'] as const
const POST_LAUNCH_CREATOR_NOTE_TEMPLATE_IDS = [
  'recommendation_note',
  'comparison_note',
  'review_note',
  'mistake_recap_note',
  'relationship_observation_note',
  'ongoing_column_note',
] as const
const POST_LAUNCH_CREATOR_NOTE_COVER_MODE_IDS = [
  'hero_cover',
  'grid_cover',
  'comparison_cover',
  'portrait_cover',
  'relationship_map_card',
  'timeline_cover',
] as const
const POST_LAUNCH_VISUAL_SURFACES = [
  'home_root_card',
  'note_root_card',
  'thread_turn',
  'highlight_card',
  'aftershow_card',
] as const
const POST_LAUNCH_CARD_MODES = [
  'single_cover',
  'multi_panel_cover',
  'quote_card',
  'strip_card',
  'comparison_cover',
  'recap_card',
  'timeline_cover',
  'portrait_cover',
  'relationship_map_card',
  'program_card',
] as const

const DEFAULT_POST_LAUNCH_TUNING_PATH = resolveLaunchContractPath({
  bundle_slug: 'p1-shelf-template-optimization-and-incubation',
  file_name: 'post_launch_optimization_and_tuning.v1.yaml',
})

const postLaunchShelfIdSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  return normalizeEditorialShelfId(value) ?? value.trim()
}, z.enum(POST_LAUNCH_HOME_SHELF_IDS))

const postLaunchSurfaceSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  return normalizeLaunchSurfaceKindId(value) ?? value.trim()
}, z.enum(POST_LAUNCH_VISUAL_SURFACES))

const postLaunchCreatorNoteSchema = z.object({
  preferred_templates_by_community: z.record(
    z.enum(POST_LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS),
    z.array(z.enum(POST_LAUNCH_CREATOR_NOTE_TEMPLATE_IDS)).min(1),
  ),
  preferred_cover_modes_by_community: z.record(
    z.enum(POST_LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS),
    z.array(z.enum(POST_LAUNCH_CREATOR_NOTE_COVER_MODE_IDS)).min(1),
  ),
  caption_structure_variant: z.string().trim().min(1),
}).strict()

const postLaunchTuningProfileSchema = z.object({
  description: z.string().trim().min(1),
  home: z.object({
    shelf_order: z.array(postLaunchShelfIdSchema).length(POST_LAUNCH_HOME_SHELF_IDS.length),
    default_mode: z.string().trim().min(1),
    hero_slot_copy: z.record(z.string(), z.string().trim().min(1)).default({}),
  }).strict(),
  creator_note: postLaunchCreatorNoteSchema.optional(),
  visual: z.object({
    surface_ratio: z.partialRecord(
      postLaunchSurfaceSchema,
      z.number().min(0).max(1),
    ),
    preferred_card_modes: z.partialRecord(
      postLaunchSurfaceSchema,
      z.array(z.enum(POST_LAUNCH_CARD_MODES)).min(1),
    ),
    budget_threshold: z.object({
      max_generated_images_per_community_day: z.number().int().min(0),
      max_generated_images_per_agent_day: z.number().int().min(0),
    }).strict(),
  }).strict(),
  incubation: z.object({
    incubation_duration_days: z.number().int().positive(),
    resident_floor: z.number().int().positive(),
    merge_threshold: z.number().min(0),
    lane_threshold: z.number().min(0),
    gray_visibility_threshold: z.number().min(0),
  }).strict(),
}).strict()

const postLaunchTuningSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)).default([]),
  activation: z.object({
    default_profile: z.string().trim().min(1),
    config_env: z.string().trim().min(1),
    rollback_profile: z.string().trim().min(1),
  }).strict(),
  profiles: z.record(z.string().trim().min(1), postLaunchTuningProfileSchema),
  config_writeback_targets: z.array(z.string().trim().min(1)).min(1),
  metrics: z.object({
    primary: z.array(z.string().trim().min(1)).min(1),
    secondary: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
}).strict()

export interface PostLaunchTuningProfile extends z.infer<typeof postLaunchTuningProfileSchema> {
  creator_note: z.infer<typeof postLaunchCreatorNoteSchema>
}

export interface PostLaunchTuningRuntime extends Omit<z.infer<typeof postLaunchTuningSchema>, 'profiles'> {
  profiles: Record<string, PostLaunchTuningProfile>
}

let cachedRuntime: PostLaunchTuningRuntime | null = null

function readYaml(pathname: string): unknown {
  return parseYaml(readFileSync(pathname, 'utf8'))
}

function toValidationMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ')
}

export function getPostLaunchTuningRuntime(
  pathname = DEFAULT_POST_LAUNCH_TUNING_PATH,
): PostLaunchTuningRuntime {
  if (pathname === DEFAULT_POST_LAUNCH_TUNING_PATH && cachedRuntime) {
    return cachedRuntime
  }
  const parsed = postLaunchTuningSchema.safeParse(readYaml(pathname))
  if (!parsed.success) {
    throw new ValidationError(`Invalid post-launch tuning contract: ${toValidationMessage(parsed.error)}`)
  }
  const runtime: PostLaunchTuningRuntime = {
    ...parsed.data,
    profiles: Object.fromEntries(
      Object.entries(parsed.data.profiles).map(([profileId, profile]) => {
        const creatorNoteProfile = profile.creator_note
        if (!creatorNoteProfile) {
          throw new ValidationError(
            `Invalid post-launch tuning contract: profile "${profileId}" must define creator_note preferences`,
          )
        }
        return [
          profileId,
          {
            ...profile,
            creator_note: creatorNoteProfile,
          },
        ]
      }),
    ),
  }
  if (pathname === DEFAULT_POST_LAUNCH_TUNING_PATH) {
    cachedRuntime = runtime
  }
  return runtime
}

export function resolvePostLaunchTuningProfile(input?: {
  enabled?: boolean
  profileId?: string | null
}): {
  runtime: PostLaunchTuningRuntime
  active_profile_id: string
  active_profile: PostLaunchTuningProfile
} | null {
  if (!input?.enabled) return null
  const runtime = getPostLaunchTuningRuntime()
  const requestedProfileId = input.profileId?.trim() || runtime.activation.default_profile
  const activeProfile = runtime.profiles[requestedProfileId] ?? runtime.profiles[runtime.activation.default_profile]
  const activeProfileId = runtime.profiles[requestedProfileId]
    ? requestedProfileId
    : runtime.activation.default_profile
  if (!activeProfile) {
    throw new ValidationError('Invalid post-launch tuning contract: no usable active profile was resolved')
  }
  return {
    runtime,
    active_profile_id: activeProfileId,
    active_profile: activeProfile,
  }
}

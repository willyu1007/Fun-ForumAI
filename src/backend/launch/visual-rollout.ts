import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { normalizeLaunchSurfaceKindId } from '../../shared/semantic-taxonomy.js'
import type { MediaRolloutControllerProfile } from '../media/media-rollout-controller-service.js'
import { ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import { getLaunchCommunityBySlug } from './community-rules.js'
import { resolvePostLaunchTuningProfile } from './post-launch-tuning.js'
import { resolveLaunchContractPath } from './contract-paths.js'

const DEFAULT_LAUNCH_VISUAL_ROLLOUT_PATH = resolveLaunchContractPath({
  bundle_slug: 'launch-visual-rollout-and-packaging',
  file_name: 'visual_surface_rollout.v1.yaml',
})

export const LAUNCH_VISUAL_SURFACES = [
  'home_root_card',
  'note_root_card',
  'thread_turn',
  'highlight_card',
  'aftershow_card',
] as const

export const LAUNCH_CARD_MODES = [
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

export const LAUNCH_THUMBNAIL_POLICIES = [
  'required',
  'required_if_available',
  'optional',
  'forbidden',
] as const

export const LAUNCH_THREAD_TURN_KINDS = [
  'turn_peak',
  'quoteable',
  'callback',
] as const

export type LaunchSurfaceKind = (typeof LAUNCH_VISUAL_SURFACES)[number]
export type LaunchCardMode = (typeof LAUNCH_CARD_MODES)[number]
export type LaunchThumbnailPolicy = (typeof LAUNCH_THUMBNAIL_POLICIES)[number]
export type LaunchThreadTurnKind = (typeof LAUNCH_THREAD_TURN_KINDS)[number]

export interface LaunchVisualPackagingMetadata {
  surface_kind: LaunchSurfaceKind
  card_mode: LaunchCardMode
  thumbnail_policy: LaunchThumbnailPolicy
  hero_eligible: boolean
}

export interface LaunchVisualCommunityConfig {
  community_visual_policy: Record<string, unknown> | null
  is_creator_note: boolean
}

export interface NormalizedLaunchCardMode {
  input_mode: string
  card_mode: LaunchCardMode
  hero_eligible: boolean
  visual_tone: 'conflict' | null
}

export interface LaunchSurfaceRolloutRule {
  target_ratio: number
  prefer_modes: LaunchCardMode[]
  only_for: LaunchThreadTurnKind[]
}

export interface LaunchBudgetGuardrail {
  max_generated_images_per_community_day: number
  max_generated_images_per_agent_day: number
  degrade_to_text_only_when_budget_exhausted: boolean
  degrade_priority: LaunchSurfaceKind[]
}

export interface LaunchHeroRule {
  hero_required: boolean
  requires_hero_eligible: boolean
}

export interface LaunchVisualRolloutRuntime {
  version: number
  draft_status: string
  notes: string[]
  surface_rollout: Record<LaunchSurfaceKind, LaunchSurfaceRolloutRule>
  budget_guardrail: LaunchBudgetGuardrail
  card_modes: Array<{ id: LaunchCardMode; intent: string }>
  hero_rules: Record<LaunchSurfaceKind, LaunchHeroRule>
  thumbnail_policy: { default: LaunchThumbnailPolicy } & Record<LaunchSurfaceKind, LaunchThumbnailPolicy>
}

export interface ResolveLaunchVisualPackagingInput {
  surface: LaunchSurfaceKind
  community_visual_policy?: Record<string, unknown> | null
  has_thumbnail: boolean
  rollout_profile?: Pick<MediaRolloutControllerProfile, 'mode' | 'profile'> | null
  content_context?: {
    is_creator_note?: boolean
    is_aftershow?: boolean
    is_highlight_candidate?: boolean
    thread_turn_kind?: LaunchThreadTurnKind | null
  }
}

const launchSurfaceSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  return normalizeLaunchSurfaceKindId(value) ?? value.trim()
}, z.enum(LAUNCH_VISUAL_SURFACES))
const launchCardModeSchema = z.enum(LAUNCH_CARD_MODES)
const launchThumbnailPolicySchema = z.enum(LAUNCH_THUMBNAIL_POLICIES)
const launchThreadTurnKindSchema = z.enum(LAUNCH_THREAD_TURN_KINDS)

const surfaceRolloutRuleSchema = z.object({
  target_ratio: z.number().min(0).max(1),
  prefer_modes: z.array(launchCardModeSchema).min(1),
  only_for: z.array(launchThreadTurnKindSchema).default([]),
}).strict()

const heroRuleSchema = z.object({
  hero_required: z.boolean(),
  requires_hero_eligible: z.boolean(),
}).strict()

const cardModeDefinitionSchema = z.object({
  id: launchCardModeSchema,
  intent: z.string().trim().min(1),
}).strict()

const visualRolloutFileSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)).default([]),
  surface_rollout: z.object({
    home_root_card: surfaceRolloutRuleSchema,
    note_root_card: surfaceRolloutRuleSchema,
    thread_turn: surfaceRolloutRuleSchema,
    highlight_card: surfaceRolloutRuleSchema,
    aftershow_card: surfaceRolloutRuleSchema,
  }).strict(),
  budget_guardrail: z.object({
    max_generated_images_per_community_day: z.number().int().min(0),
    max_generated_images_per_agent_day: z.number().int().min(0),
    degrade_to_text_only_when_budget_exhausted: z.boolean(),
    degrade_priority: z.array(launchSurfaceSchema).min(1),
  }).strict(),
  card_modes: z.array(cardModeDefinitionSchema).min(1),
  hero_rules: z.object({
    home_root_card: heroRuleSchema,
    note_root_card: heroRuleSchema,
    thread_turn: heroRuleSchema,
    highlight_card: heroRuleSchema,
    aftershow_card: heroRuleSchema,
  }).strict(),
  thumbnail_policy: z.object({
    default: launchThumbnailPolicySchema,
    home_root_card: launchThumbnailPolicySchema,
    note_root_card: launchThumbnailPolicySchema,
    thread_turn: launchThumbnailPolicySchema,
    highlight_card: launchThumbnailPolicySchema,
    aftershow_card: launchThumbnailPolicySchema,
  }).strict(),
  integration_notes: z.object({
    community_policy_fields: z.array(z.string().trim().min(1)).default([]),
    read_model_fields: z.array(z.string().trim().min(1)).default([]),
  }).optional(),
}).strict()

let cachedLaunchVisualRollout: LaunchVisualRolloutRuntime | null = null

function toValidationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readYaml(pathname: string): unknown {
  return parseYaml(readFileSync(pathname, 'utf8'))
}

function hasExactCoverage<T extends string>(items: T[], expected: readonly T[]): boolean {
  return items.length === expected.length && expected.every((item) => items.includes(item))
}

function normalizeLaunchVisualRolloutRuntime(input: unknown): LaunchVisualRolloutRuntime {
  const parsed = visualRolloutFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(`Invalid launch visual rollout: ${toValidationMessage(parsed.error)}`)
  }

  const file = parsed.data
  const cardModeIds = file.card_modes.map((item) => item.id)
  if (!hasExactCoverage(cardModeIds, LAUNCH_CARD_MODES)) {
    throw new ValidationError(
      'Invalid launch visual rollout: card_modes must cover the exact canonical launch card mode set',
    )
  }

  if (!hasExactCoverage(file.budget_guardrail.degrade_priority, LAUNCH_VISUAL_SURFACES)) {
    throw new ValidationError(
      'Invalid launch visual rollout: degrade_priority must cover the exact launch surface set',
    )
  }

  return {
    version: file.version,
    draft_status: file.draft_status,
    notes: file.notes,
    surface_rollout: {
      home_root_card: file.surface_rollout.home_root_card,
      note_root_card: file.surface_rollout.note_root_card,
      thread_turn: file.surface_rollout.thread_turn,
      highlight_card: file.surface_rollout.highlight_card,
      aftershow_card: file.surface_rollout.aftershow_card,
    },
    budget_guardrail: file.budget_guardrail,
    card_modes: file.card_modes,
    hero_rules: {
      home_root_card: file.hero_rules.home_root_card,
      note_root_card: file.hero_rules.note_root_card,
      thread_turn: file.hero_rules.thread_turn,
      highlight_card: file.hero_rules.highlight_card,
      aftershow_card: file.hero_rules.aftershow_card,
    },
    thumbnail_policy: {
      default: file.thumbnail_policy.default,
      home_root_card: file.thumbnail_policy.home_root_card,
      note_root_card: file.thumbnail_policy.note_root_card,
      thread_turn: file.thumbnail_policy.thread_turn,
      highlight_card: file.thumbnail_policy.highlight_card,
      aftershow_card: file.thumbnail_policy.aftershow_card,
    },
  }
}

export function getLaunchVisualRollout(
  pathname = DEFAULT_LAUNCH_VISUAL_ROLLOUT_PATH,
): LaunchVisualRolloutRuntime {
  if (pathname === DEFAULT_LAUNCH_VISUAL_ROLLOUT_PATH && cachedLaunchVisualRollout) {
    return cachedLaunchVisualRollout
  }

  const runtime = normalizeLaunchVisualRolloutRuntime(readYaml(pathname))
  if (pathname === DEFAULT_LAUNCH_VISUAL_ROLLOUT_PATH) {
    cachedLaunchVisualRollout = runtime
  }
  return runtime
}

export function resolveEffectiveLaunchVisualRollout(): LaunchVisualRolloutRuntime {
  const runtime = getLaunchVisualRollout()
  const tuning = resolvePostLaunchTuningProfile({
    enabled: config.launch.capabilities.postLaunchTuningV1,
    profileId: config.launchTuning.activeProfile || null,
  })
  if (!tuning) {
    return runtime
  }

  const activeVisual = tuning.active_profile.visual
  return {
    ...runtime,
    surface_rollout: {
      ...runtime.surface_rollout,
      ...Object.fromEntries(
        Object.entries(activeVisual.surface_ratio).map(([surface, target_ratio]) => [
          surface,
          {
            ...runtime.surface_rollout[surface as LaunchSurfaceKind],
            target_ratio,
          },
        ]),
      ) as Record<LaunchSurfaceKind, LaunchSurfaceRolloutRule>,
    },
    budget_guardrail: {
      ...runtime.budget_guardrail,
      ...activeVisual.budget_threshold,
    },
  }
}

export function normalizeLaunchCardMode(inputMode: string | null | undefined): NormalizedLaunchCardMode | null {
  if (typeof inputMode !== 'string') return null
  const normalized = inputMode.trim()
  if (!(LAUNCH_CARD_MODES as readonly string[]).includes(normalized)) return null
  return {
    input_mode: normalized,
    card_mode: normalized as LaunchCardMode,
    hero_eligible: false,
    visual_tone: null,
  }
}

function readPreferredCommunityModes(
  visualPolicy: Record<string, unknown> | null | undefined,
): string[] {
  if (!visualPolicy) return []
  if (Object.prototype.hasOwnProperty.call(visualPolicy, 'preferred_cover_modes')) {
    throw new ValidationError(
      'Invalid community visual policy: preferred_cover_modes is no longer accepted; use preferred_card_modes',
    )
  }
  const preferredCardModes = visualPolicy.preferred_card_modes
  if (preferredCardModes === undefined) return []
  if (!Array.isArray(preferredCardModes)) {
    throw new ValidationError(
      'Invalid community visual policy: preferred_card_modes must be an array of canonical card modes',
    )
  }
  return preferredCardModes.map((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new ValidationError(
        `Invalid community visual policy: preferred_card_modes[${index}] must be a canonical card mode`,
      )
    }
    return item.trim()
  })
}

function readBooleanField(value: unknown): boolean {
  return value === true
}

function isConservativeLaunchFallback(
  runtime: LaunchVisualRolloutRuntime,
  surface: LaunchSurfaceKind,
  rolloutProfile: Pick<MediaRolloutControllerProfile, 'mode' | 'profile'> | null | undefined,
): boolean {
  if (!rolloutProfile) return false
  if (rolloutProfile.mode === 'OFF' || rolloutProfile.profile === 'off') return true
  if (rolloutProfile.profile === 'safe_mode') return true
  if (rolloutProfile.profile !== 'conserve') return false
  const index = runtime.budget_guardrail.degrade_priority.indexOf(surface)
  return index >= 0 && index < 2
}

export function resolveLaunchCommunityVisualConfig(input: {
  community_rules_json?: Record<string, unknown> | null
  launch_community_slug?: string | null
}): LaunchVisualCommunityConfig {
  const rules = isRecord(input.community_rules_json) ? input.community_rules_json : null
  const launchCommunity = input.launch_community_slug
    ? getLaunchCommunityBySlug(input.launch_community_slug)
    : null
  const launchRules = launchCommunity?.rules_json

  const repoVisualPolicy = rules && isRecord(rules.visual_policy) ? rules.visual_policy : null
  const launchVisualPolicy = launchRules && isRecord(launchRules.visual_policy)
    ? launchRules.visual_policy
    : null

  const repoCreatorNoteRuntime = rules && isRecord(rules.creator_note_runtime) ? rules.creator_note_runtime : null
  const launchCreatorNoteRuntime = launchRules && isRecord(launchRules.creator_note_runtime)
    ? launchRules.creator_note_runtime
    : null

  return {
    community_visual_policy: repoVisualPolicy ?? launchVisualPolicy,
    is_creator_note:
      readBooleanField(repoCreatorNoteRuntime?.enabled)
      || readBooleanField(launchCreatorNoteRuntime?.enabled),
  }
}

export function resolveLaunchVisualPackaging(
  input: ResolveLaunchVisualPackagingInput,
): LaunchVisualPackagingMetadata | null {
  const runtime = resolveEffectiveLaunchVisualRollout()
  const surfaceRule = runtime.surface_rollout[input.surface]
  if (!surfaceRule) return null

  if (input.surface === 'thread_turn') {
    const turnKind = input.content_context?.thread_turn_kind ?? null
    if (!turnKind || !surfaceRule.only_for.includes(turnKind)) {
      return null
    }
  }

  const isCreatorNote = input.content_context?.is_creator_note

  if (input.surface === 'note_root_card' && isCreatorNote === false) {
    return null
  }

  if (input.surface === 'aftershow_card' && input.content_context?.is_aftershow === false) {
    return null
  }

  if (input.surface === 'highlight_card' && input.content_context?.is_highlight_candidate === false) {
    return null
  }

  if (isConservativeLaunchFallback(runtime, input.surface, input.rollout_profile)) {
    return null
  }

  const thumbnailPolicy = runtime.thumbnail_policy[input.surface] ?? runtime.thumbnail_policy.default
  if (thumbnailPolicy === 'required' && !input.has_thumbnail) {
    return null
  }

  const communityVisualPolicy = input.community_visual_policy ?? null
  const normalizedModes = readPreferredCommunityModes(communityVisualPolicy)
    .map((mode) => normalizeLaunchCardMode(mode))
    .filter((item): item is NormalizedLaunchCardMode => item !== null)

  const normalizedByMode = new Map<LaunchCardMode, NormalizedLaunchCardMode[]>()
  for (const item of normalizedModes) {
    const current = normalizedByMode.get(item.card_mode) ?? []
    current.push(item)
    normalizedByMode.set(item.card_mode, current)
  }

  const tuning = resolvePostLaunchTuningProfile({
    enabled: config.launch.capabilities.postLaunchTuningV1,
    profileId: config.launchTuning.activeProfile || null,
  })
  const preferredModes = tuning?.active_profile.visual.preferred_card_modes[input.surface]
    ?? surfaceRule.prefer_modes
  const chosenMode = preferredModes.find((mode) => normalizedByMode.has(mode))
    ?? preferredModes[0]
  const matchedModes = normalizedByMode.get(chosenMode) ?? []

  let heroEligible = matchedModes.some((item) => item.hero_eligible)
  if (!heroEligible && input.surface === 'highlight_card') {
    heroEligible = readBooleanField(communityVisualPolicy?.highlight_hero_required)
  }

  const heroRule = runtime.hero_rules[input.surface]
  if (heroRule.hero_required && heroRule.requires_hero_eligible && !heroEligible) {
    return null
  }

  return {
    surface_kind: input.surface,
    card_mode: chosenMode,
    thumbnail_policy: thumbnailPolicy,
    hero_eligible: heroEligible,
  }
}

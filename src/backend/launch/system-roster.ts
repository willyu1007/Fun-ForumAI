import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import {
  type PersonaHabit,
  type PersonaMood,
  type PersonaSeedCode,
} from '../../shared/agent-persona-catalog.js'
import {
  normalizeIdentityRoleId,
  normalizeIdentityVisibilityRoleId,
  type AgentPublicIdentity,
  type FormatCapabilityId,
  type IdentityRoleId,
  type IdentityVisibilityRoleId,
} from '../../shared/semantic-taxonomy.js'
import {
  normalizeSystemDisplayBadgeLabel,
  type CanonicalSystemBadgeLabel,
} from '../../shared/badges/catalog.js'
import { resolvePublicIdentityBadges } from '../identity/public-display-badges.js'
import { ValidationError } from '../lib/errors.js'
import { resolveLaunchContractPath } from './contract-paths.js'

const DEFAULT_LAUNCH_SYSTEM_ROSTER_PATH = resolveLaunchContractPath({
  bundle_slug: 'launch-system-roster-and-identity-packaging',
  file_name: 'system_roster.launch.v1.yaml',
})

export const LAUNCH_SYSTEM_IDENTITY_KEY = 'launch_system_identity'
const CANONICAL_BADGE_LABELS = ['节目位', '常驻席', '主持席'] as const

const launchBadgeLabelSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  return normalizeSystemDisplayBadgeLabel(value) ?? value.trim()
}, z.enum(CANONICAL_BADGE_LABELS))
const surfaceDisplayModeSchema = z.literal('program_seat_only')
const canonicalProgramRoleSchema = z.enum([
  'anchor',
  'challenger',
  'wildcard',
  'mc',
  'creator',
  'showrunner',
  'editor',
])
const programRoleSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  return normalizeIdentityRoleId(value) ?? value.trim()
}, canonicalProgramRoleSchema)
const canonicalVisibilityRoleSchema = z.enum(['resident', 'host', 'crossover', 'editorial'])
const visibilityRoleSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  return normalizeIdentityVisibilityRoleId(value) ?? value.trim()
}, canonicalVisibilityRoleSchema)
const imageAffinitySchema = z.enum(['low', 'medium', 'high'])
const stanceAxisSchema = z.enum(['low', 'medium', 'strong'])
const generalAxisSchema = z.enum(['low', 'medium', 'high'])
const privateLanePolicySchema = z.enum(['public_only'])

const identityScaffoldSchema = z.object({
  role_promise: z.string().trim().min(1),
  viewer_hook_style: z.string().trim().min(1),
  stance_axis: stanceAxisSchema,
  humor_axis: generalAxisSchema,
  empathy_axis: generalAxisSchema,
  narrative_axis: generalAxisSchema,
  forbidden_tones: z.array(z.string().trim().min(1)).min(1),
  signature_topics: z.array(z.string().trim().min(1)).min(1),
  signature_relationships: z.array(z.string().trim().min(1)).default([]),
  private_lane_policy: privateLanePolicySchema,
})

const launchSystemRosterEntrySchema = z.object({
  id: z.string().trim().min(1),
  display_name: z.string().trim().min(1),
  program_role: programRoleSchema,
  visibility_role: visibilityRoleSchema,
  identity_role_id: canonicalProgramRoleSchema.optional(),
  identity_visibility_role_id: canonicalVisibilityRoleSchema.optional(),
  home_community: z.string().trim().min(1),
  secondary_communities: z.array(z.string().trim().min(1)).default([]),
  resident_memberships: z.array(z.string().trim().min(1)).default([]),
  guest_memberships: z.array(z.string().trim().min(1)).default([]),
  pairing_preferences: z.object({
    prefers: z.array(z.string().trim().min(1)).default([]),
    avoids: z.array(z.string().trim().min(1)).default([]),
  }),
  image_affinity: imageAffinitySchema,
  format_capabilities: z.array(z.enum(['note'])).default([]),
  daily_budget: z.object({
    root_posts: z.number().int().min(0),
    replies: z.number().int().min(0),
    image_posts: z.number().int().min(0),
  }),
  cross_route_budget: z.number().int().min(0),
  identity_scaffold: identityScaffoldSchema,
})

const launchSystemOwnerModelSchema = z.object({
  platform_owner_key: z.string().trim().min(1),
  owner_id: z.string().trim().min(1),
  owner_type: z.literal('PLATFORM_MANAGED'),
  visible_in_owner_surfaces: z.boolean(),
  allows_private_sessions: z.boolean(),
  participates_in_owner_leaderboards: z.boolean(),
  public_identity_mode: surfaceDisplayModeSchema,
  allowed_badge_labels: z.array(launchBadgeLabelSchema).min(1),
})

const launchSystemSurfaceDisplayPolicySchema = z.object({
  display_mode: surfaceDisplayModeSchema,
  owner_profile_visible: z.boolean(),
  private_chat_enabled: z.boolean(),
  follow_enabled: z.boolean(),
  allowed_public_labels: z.array(launchBadgeLabelSchema).min(1),
  forbidden_public_labels: z.array(z.string().trim().min(1)).default([]),
  badge_by_visibility_role: z.object({
    resident: launchBadgeLabelSchema,
    host: launchBadgeLabelSchema,
    crossover: launchBadgeLabelSchema,
    editorial: launchBadgeLabelSchema,
  }),
})

const launchSystemRoleMixSchema = z.object({
  anchor: z.number().int().min(0),
  challenger: z.number().int().min(0),
  wildcard: z.number().int().min(0),
  mc: z.number().int().min(0),
  creator: z.number().int().min(0),
  showrunner_editor: z.number().int().min(0),
})

const launchSystemRosterFileSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)).default([]),
  owner_model: launchSystemOwnerModelSchema,
  surface_display_policy: launchSystemSurfaceDisplayPolicySchema,
  role_mix: launchSystemRoleMixSchema,
  roster: z.array(launchSystemRosterEntrySchema),
})

const launchSystemIdentityConfigSchema = z.object({
  contract: z.literal('launch_system_roster_v1'),
  version: z.literal(1),
  platform_managed: z.literal(true),
  platform_owner_key: z.string().trim().min(1),
  program_role: programRoleSchema,
  visibility_role: visibilityRoleSchema,
  identity_role_id: canonicalProgramRoleSchema.optional(),
  identity_visibility_role_id: canonicalVisibilityRoleSchema.optional(),
  home_community: z.string().trim().min(1),
  secondary_communities: z.array(z.string().trim().min(1)),
  resident_memberships: z.array(z.string().trim().min(1)),
  guest_memberships: z.array(z.string().trim().min(1)),
  pairing_preferences: z.object({
    prefers: z.array(z.string().trim().min(1)),
    avoids: z.array(z.string().trim().min(1)),
  }),
  image_affinity: imageAffinitySchema,
  format_capabilities: z.array(z.enum(['note'])).default([]),
  daily_budget: z.object({
    root_posts: z.number().int().min(0),
    replies: z.number().int().min(0),
    image_posts: z.number().int().min(0),
  }),
  cross_route_budget: z.number().int().min(0),
  identity_scaffold: identityScaffoldSchema,
})

export type LaunchBadgeLabel = CanonicalSystemBadgeLabel
export type LaunchProgramRole = z.infer<typeof programRoleSchema>
export type LaunchVisibilityRole = z.infer<typeof visibilityRoleSchema>
export type LaunchImageAffinity = z.infer<typeof imageAffinitySchema>
export type LaunchIdentityScaffold = z.infer<typeof identityScaffoldSchema>
export type LaunchSystemRosterEntry = z.infer<typeof launchSystemRosterEntrySchema>
export type LaunchSystemOwnerModel = z.infer<typeof launchSystemOwnerModelSchema>
export type LaunchSystemSurfaceDisplayPolicy = z.infer<typeof launchSystemSurfaceDisplayPolicySchema>
export type LaunchSystemRoleMix = z.infer<typeof launchSystemRoleMixSchema>
export interface LaunchSystemIdentityConfig extends z.infer<typeof launchSystemIdentityConfigSchema> {
  identity_role_id: IdentityRoleId
  identity_visibility_role_id: IdentityVisibilityRoleId
  format_capabilities: FormatCapabilityId[]
}

export interface LaunchSystemRosterRuntime {
  version: number
  draft_status: string
  notes: string[]
  owner_model: LaunchSystemOwnerModel
  surface_display_policy: LaunchSystemSurfaceDisplayPolicy
  role_mix: LaunchSystemRoleMix
  roster: LaunchSystemRosterEntry[]
}

export interface AgentSystemIdentitySummary {
  platform_managed: boolean
  identity_role_id: IdentityRoleId
  identity_visibility_role_id: IdentityVisibilityRoleId
  program_role: LaunchProgramRole
  visibility_role: LaunchVisibilityRole
  display_mode: LaunchSystemSurfaceDisplayPolicy['display_mode']
  home_community: string
  secondary_communities: string[]
  format_capabilities: FormatCapabilityId[]
}

export interface AgentSurfaceAccess {
  owner_profile_visible: boolean
  private_chat_enabled: boolean
  follow_enabled: boolean
}

export interface AgentSystemDisplayFields {
  agent_kind: 'owner' | 'system'
  public_identity: AgentPublicIdentity | null
  system_identity: AgentSystemIdentitySummary | null
  surface_access: AgentSurfaceAccess
}

export interface LaunchSeedIdentity {
  persona_seed_code: PersonaSeedCode
  owner_style_pins: {
    formality: number
    verbosity: number
    mood: PersonaMood
    habits: PersonaHabit[]
    forum_activity: number
    interests: string[]
  }
}

let cachedLaunchSystemRoster: LaunchSystemRosterRuntime | null = null

function toValidationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function countProgramRoles(roster: LaunchSystemRosterEntry[]): LaunchSystemRoleMix {
  return {
    anchor: roster.filter((entry) => entry.program_role === 'anchor').length,
    challenger: roster.filter((entry) => entry.program_role === 'challenger').length,
    wildcard: roster.filter((entry) => entry.program_role === 'wildcard').length,
    mc: roster.filter((entry) => entry.program_role === 'mc').length,
    creator: roster.filter((entry) => entry.program_role === 'creator').length,
    showrunner_editor: roster.filter(
      (entry) => entry.program_role === 'showrunner' || entry.program_role === 'editor',
    ).length,
  }
}

function deriveFormatCapabilities(input: {
  format_capabilities?: FormatCapabilityId[]
}): FormatCapabilityId[] {
  if (input.format_capabilities && input.format_capabilities.length > 0) {
    return [...new Set(input.format_capabilities)]
  }
  return []
}

function resolveCanonicalIdentityRoleId(programRole: LaunchProgramRole): IdentityRoleId {
  const canonical = normalizeIdentityRoleId(programRole)
  if (!canonical) {
    throw new ValidationError(`Invalid launch system roster: unsupported identity role mapping for "${programRole}"`)
  }
  return canonical
}

function resolveCanonicalVisibilityRoleId(visibilityRole: LaunchVisibilityRole): IdentityVisibilityRoleId {
  const canonical = normalizeIdentityVisibilityRoleId(visibilityRole)
  if (!canonical) {
    throw new ValidationError(
      `Invalid launch system roster: unsupported visibility role mapping for "${visibilityRole}"`,
    )
  }
  return canonical
}

function normalizeLaunchSystemRosterRuntime(input: unknown): LaunchSystemRosterRuntime {
  const parsed = launchSystemRosterFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(`Invalid launch system roster: ${toValidationMessage(parsed.error)}`)
  }

  const file = parsed.data
  const ids = new Set<string>()
  const displayNames = new Set<string>()
  for (const entry of file.roster) {
    if (ids.has(entry.id)) {
      throw new ValidationError(`Invalid launch system roster: duplicate roster id "${entry.id}"`)
    }
    if (displayNames.has(entry.display_name)) {
      throw new ValidationError(
        `Invalid launch system roster: duplicate display_name "${entry.display_name}"`,
      )
    }
    ids.add(entry.id)
    displayNames.add(entry.display_name)
  }

  const uniqueBadgeLabels = new Set(file.owner_model.allowed_badge_labels)
  if (uniqueBadgeLabels.size !== file.owner_model.allowed_badge_labels.length) {
    throw new ValidationError('Invalid launch system roster: duplicate allowed_badge_labels entry')
  }

  const uniquePublicLabels = new Set(file.surface_display_policy.allowed_public_labels)
  if (uniquePublicLabels.size !== file.surface_display_policy.allowed_public_labels.length) {
    throw new ValidationError(
      'Invalid launch system roster: duplicate surface_display_policy.allowed_public_labels entry',
    )
  }

  if (file.surface_display_policy.display_mode !== file.owner_model.public_identity_mode) {
    throw new ValidationError(
      'Invalid launch system roster: surface_display_policy.display_mode must match owner_model.public_identity_mode',
    )
  }

  if (
    file.surface_display_policy.owner_profile_visible !== file.owner_model.visible_in_owner_surfaces
  ) {
    throw new ValidationError(
      'Invalid launch system roster: surface_display_policy.owner_profile_visible must match owner_model.visible_in_owner_surfaces',
    )
  }

  if (
    file.surface_display_policy.private_chat_enabled !== file.owner_model.allows_private_sessions
  ) {
    throw new ValidationError(
      'Invalid launch system roster: surface_display_policy.private_chat_enabled must match owner_model.allows_private_sessions',
    )
  }

  const ownerLabels = [...file.owner_model.allowed_badge_labels].sort()
  const publicLabels = [...file.surface_display_policy.allowed_public_labels].sort()
  if (JSON.stringify(ownerLabels) !== JSON.stringify(publicLabels)) {
    throw new ValidationError(
      'Invalid launch system roster: surface_display_policy.allowed_public_labels must match owner_model.allowed_badge_labels',
    )
  }

  for (const badge of Object.values(file.surface_display_policy.badge_by_visibility_role)) {
    if (!uniquePublicLabels.has(badge)) {
      throw new ValidationError(
        `Invalid launch system roster: badge "${badge}" must appear in surface_display_policy.allowed_public_labels`,
      )
    }
  }

  const actualRoleMix = countProgramRoles(file.roster)
  const expectedRoleMix: LaunchSystemRoleMix = {
    anchor: file.role_mix.anchor,
    challenger: file.role_mix.challenger,
    wildcard: file.role_mix.wildcard,
    mc: file.role_mix.mc,
    creator: file.role_mix.creator,
    showrunner_editor: file.role_mix.showrunner_editor,
  }
  if (
    actualRoleMix.anchor !== expectedRoleMix.anchor
    || actualRoleMix.challenger !== expectedRoleMix.challenger
    || actualRoleMix.wildcard !== expectedRoleMix.wildcard
    || actualRoleMix.mc !== expectedRoleMix.mc
    || actualRoleMix.creator !== expectedRoleMix.creator
    || actualRoleMix.showrunner_editor !== expectedRoleMix.showrunner_editor
  ) {
    throw new ValidationError(
      `Invalid launch system roster: role_mix does not match roster counts (expected ${JSON.stringify(expectedRoleMix)}, got ${JSON.stringify(actualRoleMix)})`,
    )
  }

  return {
    version: file.version,
    draft_status: file.draft_status,
    notes: [...file.notes],
    owner_model: {
      ...file.owner_model,
      allowed_badge_labels: [...file.owner_model.allowed_badge_labels],
    },
    surface_display_policy: {
      ...file.surface_display_policy,
      allowed_public_labels: [...file.surface_display_policy.allowed_public_labels],
      forbidden_public_labels: [...file.surface_display_policy.forbidden_public_labels],
      badge_by_visibility_role: { ...file.surface_display_policy.badge_by_visibility_role },
    },
    role_mix: expectedRoleMix,
    roster: file.roster.map((entry) => ({
      ...entry,
      identity_role_id: entry.identity_role_id ?? resolveCanonicalIdentityRoleId(entry.program_role),
      identity_visibility_role_id:
        entry.identity_visibility_role_id ?? resolveCanonicalVisibilityRoleId(entry.visibility_role),
      secondary_communities: [...entry.secondary_communities],
      resident_memberships: [...entry.resident_memberships],
      guest_memberships: [...entry.guest_memberships],
      pairing_preferences: {
        prefers: [...entry.pairing_preferences.prefers],
        avoids: [...entry.pairing_preferences.avoids],
      },
      format_capabilities: deriveFormatCapabilities({
        format_capabilities: entry.format_capabilities,
      }),
      daily_budget: { ...entry.daily_budget },
      identity_scaffold: {
        ...entry.identity_scaffold,
        forbidden_tones: [...entry.identity_scaffold.forbidden_tones],
        signature_topics: [...entry.identity_scaffold.signature_topics],
        signature_relationships: [...entry.identity_scaffold.signature_relationships],
      },
    })),
  }
}

export function loadLaunchSystemRoster(input: {
  roster_path?: string
  fresh?: boolean
} = {}): LaunchSystemRosterRuntime {
  if (!input.fresh && !input.roster_path && cachedLaunchSystemRoster) {
    return cachedLaunchSystemRoster
  }

  const rosterPath = input.roster_path ?? DEFAULT_LAUNCH_SYSTEM_ROSTER_PATH
  let parsedYaml: unknown
  try {
    parsedYaml = parseYaml(readFileSync(rosterPath, 'utf8'))
  } catch (error) {
    throw new ValidationError(
      `Unable to load launch system roster from ${rosterPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const runtime = normalizeLaunchSystemRosterRuntime(parsedYaml)
  if (!input.roster_path) {
    cachedLaunchSystemRoster = runtime
  }
  return runtime
}

export function getLaunchSystemRoster(): LaunchSystemRosterRuntime {
  return loadLaunchSystemRoster()
}

export function findLaunchSystemRosterEntryById(rosterEntryId: string): LaunchSystemRosterEntry | null {
  return getLaunchSystemRoster().roster.find((entry) => entry.id === rosterEntryId) ?? null
}

export function buildLaunchSystemConfigSlice(entry: LaunchSystemRosterEntry): Record<string, unknown> {
  const roster = getLaunchSystemRoster()
  return {
    [LAUNCH_SYSTEM_IDENTITY_KEY]: {
      contract: 'launch_system_roster_v1',
      version: 1,
      platform_managed: true,
      platform_owner_key: roster.owner_model.platform_owner_key,
      program_role: entry.program_role,
      visibility_role: entry.visibility_role,
      identity_role_id: entry.identity_role_id ?? resolveCanonicalIdentityRoleId(entry.program_role),
      identity_visibility_role_id:
        entry.identity_visibility_role_id ?? resolveCanonicalVisibilityRoleId(entry.visibility_role),
      home_community: entry.home_community,
      secondary_communities: [...entry.secondary_communities],
      resident_memberships: [...entry.resident_memberships],
      guest_memberships: [...entry.guest_memberships],
      pairing_preferences: {
        prefers: [...entry.pairing_preferences.prefers],
        avoids: [...entry.pairing_preferences.avoids],
      },
      image_affinity: entry.image_affinity,
      format_capabilities: deriveFormatCapabilities({
        format_capabilities: entry.format_capabilities,
      }),
      daily_budget: { ...entry.daily_budget },
      cross_route_budget: entry.cross_route_budget,
      identity_scaffold: {
        ...entry.identity_scaffold,
        forbidden_tones: [...entry.identity_scaffold.forbidden_tones],
        signature_topics: [...entry.identity_scaffold.signature_topics],
        signature_relationships: [...entry.identity_scaffold.signature_relationships],
      },
    } satisfies LaunchSystemIdentityConfig,
  }
}

export function readLaunchSystemIdentityConfig(
  configJson: Record<string, unknown> | null | undefined,
): LaunchSystemIdentityConfig | null {
  const raw = configJson?.[LAUNCH_SYSTEM_IDENTITY_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const parsed = launchSystemIdentityConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid ${LAUNCH_SYSTEM_IDENTITY_KEY} config: ${toValidationMessage(parsed.error)}`,
    )
  }
  const identityRoleId = parsed.data.identity_role_id
    ? normalizeIdentityRoleId(parsed.data.identity_role_id)
    : normalizeIdentityRoleId(parsed.data.program_role)
  const identityVisibilityRoleId = parsed.data.identity_visibility_role_id
    ? normalizeIdentityVisibilityRoleId(parsed.data.identity_visibility_role_id)
    : normalizeIdentityVisibilityRoleId(parsed.data.visibility_role)
  if (!identityRoleId || !identityVisibilityRoleId) {
    throw new ValidationError(
      `Invalid ${LAUNCH_SYSTEM_IDENTITY_KEY} config: canonical identity roles could not be resolved`,
    )
  }

  return {
    ...parsed.data,
    identity_role_id: identityRoleId,
    identity_visibility_role_id: identityVisibilityRoleId,
    format_capabilities: deriveFormatCapabilities({
      format_capabilities: parsed.data.format_capabilities,
    }),
  }
}

export function isLaunchSystemAgentConfig(configJson: Record<string, unknown> | null | undefined): boolean {
  return readLaunchSystemIdentityConfig(configJson) !== null
}

export function buildAgentSystemDisplayFields(
  configJson: Record<string, unknown> | null | undefined,
): AgentSystemDisplayFields {
  const systemIdentity = readLaunchSystemIdentityConfig(configJson)
  if (!systemIdentity) {
    return {
      agent_kind: 'owner',
      public_identity: { agent_kind: 'owner' },
      system_identity: null,
      surface_access: {
        owner_profile_visible: true,
        private_chat_enabled: true,
        follow_enabled: true,
      },
    }
  }

  const roster = getLaunchSystemRoster()
  const displayBadge = roster.surface_display_policy.badge_by_visibility_role[systemIdentity.visibility_role]
  const privateChatEnabled =
    roster.surface_display_policy.private_chat_enabled
    && systemIdentity.identity_scaffold.private_lane_policy !== 'public_only'

  return {
    agent_kind: 'system',
    public_identity: {
      agent_kind: 'system',
      identity_badges: resolvePublicIdentityBadges({
        agentKind: 'system',
        explicitDisplayBadges: [displayBadge],
      }),
      identity_role_id: systemIdentity.identity_role_id,
      identity_visibility_role_id: systemIdentity.identity_visibility_role_id,
      display_mode: roster.surface_display_policy.display_mode,
      home_community: systemIdentity.home_community,
      secondary_communities: [...systemIdentity.secondary_communities],
      format_capabilities: [...systemIdentity.format_capabilities],
    },
    system_identity: {
      platform_managed: true,
      identity_role_id: systemIdentity.identity_role_id,
      identity_visibility_role_id: systemIdentity.identity_visibility_role_id,
      program_role: systemIdentity.program_role,
      visibility_role: systemIdentity.visibility_role,
      display_mode: roster.surface_display_policy.display_mode,
      home_community: systemIdentity.home_community,
      secondary_communities: [...systemIdentity.secondary_communities],
      format_capabilities: [...systemIdentity.format_capabilities],
    },
    surface_access: {
      owner_profile_visible: roster.surface_display_policy.owner_profile_visible,
      private_chat_enabled: privateChatEnabled,
      follow_enabled: roster.surface_display_policy.follow_enabled,
    },
  }
}

export function redactOwnerIdForPublicRead(
  ownerId: string,
  displayFields: AgentSystemDisplayFields,
): string | null {
  return displayFields.agent_kind === 'system' ? null : ownerId
}

function axisToScale(value: z.infer<typeof generalAxisSchema>): number {
  switch (value) {
    case 'low':
      return 2
    case 'medium':
      return 3
    case 'high':
      return 4
  }
}

function stanceToScale(value: z.infer<typeof stanceAxisSchema>): number {
  switch (value) {
    case 'low':
      return 2
    case 'medium':
      return 3
    case 'strong':
      return 4
  }
}

function derivePersonaSeedCode(entry: LaunchSystemRosterEntry): PersonaSeedCode {
  if (entry.program_role === 'showrunner' || entry.program_role === 'editor') {
    return 'scholar'
  }
  if (entry.program_role === 'mc') {
    return entry.identity_scaffold.humor_axis === 'high' ? 'comedian' : 'mediator'
  }
  if (entry.identity_scaffold.humor_axis === 'high') {
    return 'comedian'
  }
  if (
    entry.identity_scaffold.stance_axis === 'strong'
    && entry.identity_scaffold.empathy_axis === 'low'
  ) {
    return 'sharp-tongue'
  }
  if (
    entry.identity_scaffold.empathy_axis === 'high'
    && entry.identity_scaffold.stance_axis !== 'strong'
  ) {
    return 'warmhearted'
  }
  if (entry.identity_scaffold.narrative_axis === 'high') {
    return 'philosopher'
  }
  if (entry.program_role === 'creator') {
    return entry.identity_scaffold.empathy_axis === 'high' ? 'warmhearted' : 'scholar'
  }
  if (entry.identity_scaffold.stance_axis === 'strong') {
    return 'sharp-tongue'
  }
  return 'scholar'
}

function deriveMood(entry: LaunchSystemRosterEntry): PersonaMood {
  if (entry.identity_scaffold.humor_axis === 'high') return 'random'
  if (entry.identity_scaffold.empathy_axis === 'high') return 'optimistic'
  if (entry.identity_scaffold.stance_axis === 'strong') return 'critical'
  return 'neutral'
}

function deriveHabits(entry: LaunchSystemRosterEntry): PersonaHabit[] {
  const habits = new Set<PersonaHabit>()
  if (entry.program_role === 'showrunner' || entry.program_role === 'editor') {
    habits.add('summarizes')
  }
  if (entry.program_role === 'mc') {
    habits.add('asks_questions')
  }
  if (entry.identity_scaffold.narrative_axis === 'high') {
    habits.add('tells_stories')
  }
  if (entry.identity_scaffold.humor_axis === 'high') {
    habits.add('uses_analogies')
  }
  if (entry.identity_scaffold.stance_axis === 'strong') {
    habits.add('asks_questions')
  }
  if (entry.identity_scaffold.empathy_axis === 'high' && habits.size === 0) {
    habits.add('tells_stories')
  }
  if (habits.size === 0) {
    habits.add('summarizes')
  }
  return [...habits]
}

function deriveForumActivity(entry: LaunchSystemRosterEntry): number {
  const totalActivity = entry.daily_budget.root_posts + entry.daily_budget.replies + entry.daily_budget.image_posts
  if (totalActivity >= 10) return 5
  if (totalActivity >= 8) return 4
  if (totalActivity >= 5) return 3
  if (totalActivity >= 3) return 2
  return 1
}

export function deriveLaunchSeedIdentity(entry: LaunchSystemRosterEntry): LaunchSeedIdentity {
  const personaSeedCode = derivePersonaSeedCode(entry)
  const formalityBase =
    entry.program_role === 'showrunner' || entry.program_role === 'editor'
      ? 4
      : stanceToScale(entry.identity_scaffold.stance_axis)
  const verbosityBase =
    entry.program_role === 'mc'
      ? 3
      : Math.min(5, axisToScale(entry.identity_scaffold.narrative_axis) + 1)

  return {
    persona_seed_code: personaSeedCode,
    owner_style_pins: {
      formality: entry.identity_scaffold.humor_axis === 'high' ? Math.max(1, formalityBase - 1) : formalityBase,
      verbosity: verbosityBase,
      mood: deriveMood(entry),
      habits: deriveHabits(entry),
      forum_activity: deriveForumActivity(entry),
      interests: entry.identity_scaffold.signature_topics.slice(0, 4),
    },
  }
}

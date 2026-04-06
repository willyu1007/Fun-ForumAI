import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import {
  normalizeEditorialShelfId,
  normalizeIdentityRoleId,
  normalizeLaunchSurfaceKindId,
} from '../../shared/semantic-taxonomy.js'
import { ValidationError } from '../lib/errors.js'
import { listLaunchCommunitySeeds } from './community-rules.js'
import { resolveLaunchContractPath } from './contract-paths.js'
import { LAUNCH_HOME_SHELF_IDS, type LaunchHomeShelfId } from './home-programming.js'
import { getLaunchSystemRoster, type LaunchProgramRole } from './system-roster.js'
import { LAUNCH_VISUAL_SURFACES, type LaunchSurfaceKind } from './visual-rollout.js'

const DEFAULT_LAUNCH_PROGRAMMING_SCHEDULE_PATH = resolveLaunchContractPath({
  bundle_slug: 'launch-programming-ops-and-rollout',
  file_name: 'launch_programming_schedule.v1.yaml',
})

const DEFAULT_LAUNCH_GOVERNANCE_CONTRACT_PATH = resolveLaunchContractPath({
  bundle_slug: 'launch-community-governance-and-incubation',
  file_name: 'community_governance_and_incubation.v1.yaml',
})

export const LAUNCH_PROGRAMMING_DAYPART_IDS = [
  'morning_warmup',
  'afternoon_handoff',
  'evening_prime',
  'late_night_callback',
] as const

export type LaunchProgrammingDaypartId = (typeof LAUNCH_PROGRAMMING_DAYPART_IDS)[number]

const CANONICAL_GOVERNANCE_REFERENCE_FIELDS = [
  'community_name',
  'community_lifecycle_state',
  'launch_wave',
  'headline_priority',
  'incubation_status',
  'merge_recommendation',
  'last_admin_action',
] as const

const daypartIdSchema = z.enum(LAUNCH_PROGRAMMING_DAYPART_IDS)
const launchSurfaceKindSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  return normalizeLaunchSurfaceKindId(value) ?? value.trim()
}, z.enum(LAUNCH_VISUAL_SURFACES))

const launchWindowSchema = z.object({
  release_phase: z.string().trim().min(1),
  schedule_timezone: z.string().trim().min(1),
  cadence: z.string().trim().min(1),
}).strict()

const featureFlagsSchema = z.object({
  existing: z.array(z.string().trim().min(1)).default([]),
  planned: z.array(z.string().trim().min(1)).default([]),
}).strict()

const dependencyContractsSchema = z.object({
  roster_source: z.string().trim().min(1),
  community_rules_source: z.string().trim().min(1),
  home_surface_source: z.string().trim().min(1),
  creator_note_source: z.string().trim().min(1).optional(),
  visual_rollout_source: z.string().trim().min(1),
  governance_source: z.string().trim().min(1),
}).strict()

const supplyFloorSchema = z.record(z.string().trim().min(1), z.number().int().min(0))

const daypartSchema = z.object({
  id: daypartIdSchema,
  label: z.string().trim().min(1),
  time_range: z.string().trim().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  objective: z.string().trim().min(1),
  target_communities: z.array(z.string().trim().min(1)).min(1),
  supply_floor: supplyFloorSchema,
  preferred_roles: z.array(z.string().trim().min(1)).min(1),
  metrics_focus: z.array(z.string().trim().min(1)).min(1),
}).strict()

const expectedOutputsSchema = z.object({
  root_posts: z.number().int().min(0).optional(),
  creator_note_entries: z.number().int().min(0).optional(),
  priority_threads: z.number().int().min(0).optional(),
  highlight_candidate: z.boolean().optional(),
  programming_entry: z.boolean().optional(),
  shelf_eligible: z.boolean().optional(),
  continuity_entry: z.boolean().optional(),
  aftershow_candidate: z.boolean().optional(),
  editorial_shelf_id: z.string().trim().min(1).optional(),
  surface_kind: z.string().trim().min(1).optional(),
}).strict()

const slotTemplateSchema = z.object({
  slot_name: z.string().trim().min(1),
  daypart: daypartIdSchema,
  community: z.string().trim().min(1),
  scene_types: z.array(z.string().trim().min(1)).min(1),
  required_roles: z.array(z.string().trim().min(1)).min(1),
  optional_roles: z.array(z.string().trim().min(1)).default([]),
  fallback_roles: z.array(z.string().trim().min(1)).default([]),
  expected_outputs: expectedOutputsSchema,
  cross_handoff: z.object({
    next_communities: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
}).strict()

const opsSurfaceLayerSchema = z.record(
  z.string().trim().min(1),
  z.object({
    required_fields: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
)

const launchProgrammingScheduleSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)).default([]),
  launch_window: launchWindowSchema,
  feature_flags: featureFlagsSchema,
  dependency_contracts: dependencyContractsSchema,
  dayparts: z.array(daypartSchema).length(LAUNCH_PROGRAMMING_DAYPART_IDS.length),
  slot_templates: z.array(slotTemplateSchema).min(1),
  ops_surfaces: z.object({
    programming_layer: opsSurfaceLayerSchema,
    governance_reference_layer: opsSurfaceLayerSchema,
  }).strict(),
  health_thresholds: z.object({
    required_daily_outcomes: z.object({
      mainline_roots_min: z.number().int().min(0),
      highlight_candidates_min: z.number().int().min(0),
      creator_note_entries_min: z.number().int().min(0).optional(),
      continuity_callbacks_min: z.number().int().min(0),
    }).strict(),
    warnings: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
  rollback_order: z.array(z.string().trim().min(1)).min(1),
  drill_checklist: z.array(z.string().trim().min(1)).min(1),
}).strict()

const governanceContractSchema = z.object({
  system_merge_recommendation: z.object({
    required_fields: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
  admin_decision_actions: z.array(z.string().trim().min(1)).min(1),
  community_lifecycle_state: z.array(z.string().trim().min(1)).min(1),
  incubation_profile: z.object({
    incubation_visibility_mode: z.string().trim().min(1).optional(),
    default_visibility: z.string().trim().min(1).optional(),
    outcomes: z.array(z.string().trim().min(1)).min(1),
  }).passthrough(),
  control_plane_surfaces: z.array(z.string().trim().min(1)).min(1),
}).passthrough()

export interface LaunchProgrammingDaypartRuntime {
  id: LaunchProgrammingDaypartId
  label: string
  time_range: string
  objective: string
  target_communities: string[]
  target_community_slugs: string[]
  supply_floor: Record<string, number>
  preferred_roles: LaunchProgramRole[]
  metrics_focus: string[]
}

export interface LaunchProgrammingExpectedOutputs {
  root_posts?: number
  creator_note_entries?: number
  priority_threads?: number
  highlight_candidate?: boolean
  programming_entry?: boolean
  shelf_eligible?: boolean
  continuity_entry?: boolean
  aftershow_candidate?: boolean
  editorial_shelf_id?: LaunchHomeShelfId
  surface_kind?: LaunchSurfaceKind
}

export interface LaunchProgrammingDependencyContracts {
  roster_source: string
  community_rules_source: string
  home_surface_source: string
  creator_note_source: string
  visual_rollout_source: string
  governance_source: string
}

export interface LaunchProgrammingRequiredDailyOutcomes {
  mainline_roots_min: number
  highlight_candidates_min: number
  creator_note_entries_min?: number
  continuity_callbacks_min: number
}

export interface LaunchProgrammingHealthThresholds {
  required_daily_outcomes: LaunchProgrammingRequiredDailyOutcomes
  warnings: string[]
}

export interface LaunchProgrammingSlotTemplateRuntime {
  slot_name: string
  daypart: LaunchProgrammingDaypartId
  daypart_order: number
  community: string
  community_slug: string
  scene_types: string[]
  required_roles: LaunchProgramRole[]
  optional_roles: LaunchProgramRole[]
  fallback_roles: LaunchProgramRole[]
  expected_outputs: LaunchProgrammingExpectedOutputs
  cross_handoff: {
    next_communities: string[]
    next_community_slugs: string[]
  }
}

export interface LaunchProgrammingScheduleRuntime {
  version: number
  draft_status: string
  notes: string[]
  launch_window: z.infer<typeof launchWindowSchema>
  feature_flags: z.infer<typeof featureFlagsSchema>
  dependency_contracts: LaunchProgrammingDependencyContracts
  dayparts: LaunchProgrammingDaypartRuntime[]
  slot_templates: LaunchProgrammingSlotTemplateRuntime[]
  ops_surfaces: z.infer<typeof launchProgrammingScheduleSchema>['ops_surfaces']
  health_thresholds: LaunchProgrammingHealthThresholds
  rollback_order: string[]
  drill_checklist: string[]
}

let cachedLaunchProgrammingSchedule: LaunchProgrammingScheduleRuntime | null = null

function toValidationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function readYaml(pathname: string): unknown {
  return parseYaml(readFileSync(pathname, 'utf8'))
}

function normalizeCommunityAlias(
  input: string,
  communityByAlias: Map<string, { slug: string; name: string }>,
  pathLabel: string,
): { slug: string; name: string } {
  const candidate = communityByAlias.get(input.trim())
  if (!candidate) {
    throw new ValidationError(
      `Invalid launch programming schedule: ${pathLabel} must reference one of the 12 launch communities`,
    )
  }
  return candidate
}

function loadGovernanceReferences(pathname = DEFAULT_LAUNCH_GOVERNANCE_CONTRACT_PATH) {
  const parsed = governanceContractSchema.safeParse(readYaml(pathname))
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid launch governance contract reference: ${toValidationMessage(parsed.error)}`,
    )
  }
  return parsed.data
}

function normalizeGovernanceReferenceFields(requiredFields: string[]): string[] {
  return requiredFields
}

function validateGovernanceReferenceLayer(input: {
  required_fields: string[]
  governance_contract: ReturnType<typeof loadGovernanceReferences>
}): void {
  const allowedFields = new Set<string>(CANONICAL_GOVERNANCE_REFERENCE_FIELDS)
  normalizeGovernanceReferenceFields(input.required_fields).forEach((field) => {
    if (!allowedFields.has(field)) {
      throw new ValidationError(
        `Invalid launch programming schedule: governance reference field "${field}" is not part of the canonical T-141 read model`,
      )
    }
  })

  if (!input.governance_contract.control_plane_surfaces.includes('lifecycle_panel')) {
    throw new ValidationError(
      'Invalid launch programming schedule: T-141 governance contract must expose lifecycle_panel',
    )
  }
  if (!input.governance_contract.control_plane_surfaces.includes('incubation_panel')) {
    throw new ValidationError(
      'Invalid launch programming schedule: T-141 governance contract must expose incubation_panel',
    )
  }
  if (
    input.required_fields.includes('community_lifecycle_state')
    && input.governance_contract.community_lifecycle_state.length === 0
  ) {
    throw new ValidationError(
      'Invalid launch programming schedule: governance reference layer requires T-141 community_lifecycle_state coverage',
    )
  }
  if (
    input.required_fields.includes('merge_recommendation')
    && input.governance_contract.system_merge_recommendation.required_fields.length === 0
  ) {
    throw new ValidationError(
      'Invalid launch programming schedule: governance reference layer requires T-141 system_merge_recommendation fields',
    )
  }
  if (
    input.required_fields.includes('last_admin_action')
    && input.governance_contract.admin_decision_actions.length === 0
  ) {
    throw new ValidationError(
      'Invalid launch programming schedule: governance reference layer requires T-141 admin_decision_actions',
    )
  }
}

function normalizeLaunchProgrammingScheduleRuntime(input: unknown): LaunchProgrammingScheduleRuntime {
  const parsed = launchProgrammingScheduleSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(`Invalid launch programming schedule: ${toValidationMessage(parsed.error)}`)
  }

  const file = parsed.data
  const actualDaypartOrder = file.dayparts.map((item) => item.id)
  const expectedDaypartOrder = [...LAUNCH_PROGRAMMING_DAYPART_IDS]
  if (
    actualDaypartOrder.length !== expectedDaypartOrder.length
    || actualDaypartOrder.some((id, index) => id !== expectedDaypartOrder[index])
  ) {
    throw new ValidationError(
      'Invalid launch programming schedule: dayparts must follow the canonical launch order',
    )
  }

  const launchCommunities = listLaunchCommunitySeeds()
  const communityByAlias = new Map<string, { slug: string; name: string }>()
  launchCommunities.forEach((community) => {
    communityByAlias.set(community.slug, { slug: community.slug, name: community.name })
    communityByAlias.set(community.name, { slug: community.slug, name: community.name })
  })

  const allowedRoles = new Set<LaunchProgramRole>(
    getLaunchSystemRoster().roster.map((entry) => entry.program_role),
  )

  const normalizedDayparts = file.dayparts.map((daypart, index) => {
    const normalizedPreferredRoles = daypart.preferred_roles.map((role) => {
      const canonicalRole = normalizeIdentityRoleId(role)
      if (!canonicalRole || !allowedRoles.has(canonicalRole as LaunchProgramRole)) {
        throw new ValidationError(
          `Invalid launch programming schedule: ${daypart.id}.preferred_roles contains unsupported role "${role}"`,
        )
      }
      return canonicalRole as LaunchProgramRole
    })

    const resolvedTargets = daypart.target_communities.map((communityName, targetIndex) => {
      const resolved = normalizeCommunityAlias(
        communityName,
        communityByAlias,
        `${daypart.id}.target_communities[${targetIndex}]`,
      )
      return resolved
    })

    return {
      id: daypart.id,
      label: daypart.label,
      time_range: daypart.time_range,
      objective: daypart.objective,
      target_communities: resolvedTargets.map((item) => item.name),
      target_community_slugs: resolvedTargets.map((item) => item.slug),
      supply_floor: daypart.supply_floor,
      preferred_roles: normalizedPreferredRoles,
      metrics_focus: daypart.metrics_focus,
      position: index,
    }
  })

  const daypartIndex = new Map(
    normalizedDayparts.map((daypart, index) => [daypart.id, index] as const),
  )
  let previousSlotDaypartIndex = -1
  const seenSlotNames = new Set<string>()

  const normalizedSlots = file.slot_templates.map((slot) => {
    if (seenSlotNames.has(slot.slot_name)) {
      throw new ValidationError(
        `Invalid launch programming schedule: duplicate slot_name "${slot.slot_name}"`,
      )
    }
    seenSlotNames.add(slot.slot_name)

    const currentDaypartIndex = daypartIndex.get(slot.daypart)
    if (currentDaypartIndex === undefined) {
      throw new ValidationError(
        `Invalid launch programming schedule: slot ${slot.slot_name} must reference a canonical daypart`,
      )
    }
    if (currentDaypartIndex < previousSlotDaypartIndex) {
      throw new ValidationError(
        'Invalid launch programming schedule: slot_templates must remain sorted by canonical daypart order',
      )
    }
    previousSlotDaypartIndex = currentDaypartIndex

    const resolvedCommunity = normalizeCommunityAlias(
      slot.community,
      communityByAlias,
      `${slot.slot_name}.community`,
    )
    const resolvedHandoffs = slot.cross_handoff.next_communities.map((communityName, index) =>
      normalizeCommunityAlias(
        communityName,
        communityByAlias,
        `${slot.slot_name}.cross_handoff.next_communities[${index}]`,
      ),
    )

    const normalizeRoleList = (
      roles: string[],
      field: 'required_roles' | 'optional_roles' | 'fallback_roles',
    ): LaunchProgramRole[] => {
      return roles.map((role) => {
        const canonicalRole = normalizeIdentityRoleId(role)
        if (!canonicalRole || !allowedRoles.has(canonicalRole as LaunchProgramRole)) {
          throw new ValidationError(
            `Invalid launch programming schedule: ${slot.slot_name}.${field} contains unsupported role "${role}"`,
          )
        }
        return canonicalRole as LaunchProgramRole
      })
    }

    const requiredRoles = normalizeRoleList(slot.required_roles, 'required_roles')
    const optionalRoles = normalizeRoleList(slot.optional_roles, 'optional_roles')
    const fallbackRoles = normalizeRoleList(slot.fallback_roles, 'fallback_roles')

    let editorialShelfId: LaunchHomeShelfId | undefined
    if (slot.expected_outputs.editorial_shelf_id) {
      const normalizedShelf = normalizeEditorialShelfId(slot.expected_outputs.editorial_shelf_id)
      if (!normalizedShelf || !(LAUNCH_HOME_SHELF_IDS as readonly string[]).includes(normalizedShelf)) {
        throw new ValidationError(
          `Invalid launch programming schedule: ${slot.slot_name}.expected_outputs.editorial_shelf_id must align with T-135 shelf ids`,
        )
      }
      editorialShelfId = normalizedShelf as LaunchHomeShelfId
    }

    let surfaceKind: LaunchSurfaceKind | undefined
    if (slot.expected_outputs.surface_kind) {
      const parsedSurfaceKind = launchSurfaceKindSchema.safeParse(slot.expected_outputs.surface_kind)
      if (!parsedSurfaceKind.success) {
        throw new ValidationError(
          `Invalid launch programming schedule: ${slot.slot_name}.expected_outputs.surface_kind must align with T-140 surface kinds`,
        )
      }
      surfaceKind = parsedSurfaceKind.data
    }

    const expectedOutputs: LaunchProgrammingExpectedOutputs = {
      root_posts: slot.expected_outputs.root_posts,
      creator_note_entries: slot.expected_outputs.creator_note_entries,
      priority_threads: slot.expected_outputs.priority_threads,
      highlight_candidate: slot.expected_outputs.highlight_candidate,
      programming_entry: slot.expected_outputs.programming_entry,
      shelf_eligible: slot.expected_outputs.shelf_eligible,
      continuity_entry: slot.expected_outputs.continuity_entry,
      aftershow_candidate: slot.expected_outputs.aftershow_candidate,
      editorial_shelf_id: editorialShelfId,
      surface_kind: surfaceKind,
    }

    return {
      slot_name: slot.slot_name,
      daypart: slot.daypart,
      daypart_order: currentDaypartIndex,
      community: resolvedCommunity.name,
      community_slug: resolvedCommunity.slug,
      scene_types: slot.scene_types,
      required_roles: requiredRoles,
      optional_roles: optionalRoles,
      fallback_roles: fallbackRoles,
      expected_outputs: expectedOutputs,
      cross_handoff: {
        next_communities: resolvedHandoffs.map((item) => item.name),
        next_community_slugs: resolvedHandoffs.map((item) => item.slug),
      },
    } satisfies LaunchProgrammingSlotTemplateRuntime
  })

  const governanceContract = loadGovernanceReferences()
  Object.values(file.ops_surfaces.governance_reference_layer).forEach((panel) => {
    validateGovernanceReferenceLayer({
      required_fields: panel.required_fields,
      governance_contract: governanceContract,
    })
  })

  return {
    version: file.version,
    draft_status: file.draft_status,
    notes: file.notes,
    launch_window: file.launch_window,
    feature_flags: file.feature_flags,
    dependency_contracts: {
      roster_source: file.dependency_contracts.roster_source,
      community_rules_source: file.dependency_contracts.community_rules_source,
      home_surface_source: file.dependency_contracts.home_surface_source,
      creator_note_source: file.dependency_contracts.creator_note_source ?? '',
      visual_rollout_source: file.dependency_contracts.visual_rollout_source,
      governance_source: file.dependency_contracts.governance_source,
    },
    dayparts: normalizedDayparts.map(({ position: _position, ...daypart }) => daypart),
    slot_templates: normalizedSlots,
    ops_surfaces: {
      programming_layer: file.ops_surfaces.programming_layer,
      governance_reference_layer: Object.fromEntries(
        Object.entries(file.ops_surfaces.governance_reference_layer).map(([panelId, panel]) => [
          panelId,
          {
            required_fields: normalizeGovernanceReferenceFields(panel.required_fields),
          },
        ]),
      ),
    },
    health_thresholds: {
      required_daily_outcomes: {
        mainline_roots_min: file.health_thresholds.required_daily_outcomes.mainline_roots_min,
        highlight_candidates_min: file.health_thresholds.required_daily_outcomes.highlight_candidates_min,
        creator_note_entries_min: file.health_thresholds.required_daily_outcomes.creator_note_entries_min,
        continuity_callbacks_min: file.health_thresholds.required_daily_outcomes.continuity_callbacks_min,
      },
      warnings: file.health_thresholds.warnings,
    },
    rollback_order: file.rollback_order,
    drill_checklist: file.drill_checklist,
  }
}

export function getLaunchProgrammingSchedule(
  pathname = DEFAULT_LAUNCH_PROGRAMMING_SCHEDULE_PATH,
): LaunchProgrammingScheduleRuntime {
  if (pathname === DEFAULT_LAUNCH_PROGRAMMING_SCHEDULE_PATH && cachedLaunchProgrammingSchedule) {
    return cachedLaunchProgrammingSchedule
  }

  const runtime = normalizeLaunchProgrammingScheduleRuntime(readYaml(pathname))
  if (pathname === DEFAULT_LAUNCH_PROGRAMMING_SCHEDULE_PATH) {
    cachedLaunchProgrammingSchedule = runtime
  }
  return runtime
}

export function listLaunchProgrammingDayparts(): LaunchProgrammingDaypartRuntime[] {
  return getLaunchProgrammingSchedule().dayparts
}

export function listLaunchProgrammingSlots(): LaunchProgrammingSlotTemplateRuntime[] {
  return getLaunchProgrammingSchedule().slot_templates
}

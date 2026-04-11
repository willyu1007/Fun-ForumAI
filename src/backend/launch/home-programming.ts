import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import {
  EDITORIAL_SHELF_LABELS,
  normalizeContentKind,
  normalizeEditorialShelfId,
  normalizeLaunchSurfaceKindId,
  type ContentKind,
  type EditorialShelfId,
  type LaunchSurfaceKindId,
} from '../../shared/semantic-taxonomy.js'
import { ValidationError } from '../lib/errors.js'
import { resolveLaunchContractPath } from './contract-paths.js'

export const LAUNCH_HOME_SHELF_IDS = [
  'must_watch_today',
  'conflict_rising',
  'notes_today',
  'continue_storyline',
  'tonight_programming',
  'all_communities',
] as const

export type LaunchHomeShelfId = (typeof LAUNCH_HOME_SHELF_IDS)[number]

const DEFAULT_LAUNCH_HOME_PROGRAMMING_PATH = resolveLaunchContractPath({
  bundle_slug: 'launch-home-ia-storyline-highlights',
  file_name: 'home_ia_and_shelves.v1.yaml',
})

const shelfSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  position: z.number().int().positive(),
  max_items: z.number().int().positive(),
  intent: z.string().trim().min(1),
  accepts_content_kinds: z.array(z.string().trim().min(1)).min(1),
  preferred_surface_kinds: z.array(z.string().trim().min(1)).optional(),
  source_priority: z.array(z.string().trim().min(1)).min(1),
  empty_policy: z.string().trim().min(1),
}).strict()

const launchHomeProgrammingSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)).default([]),
  home_surface: z.object({
    default_mode: z.string().trim().min(1),
    fallback_mode: z.string().trim().min(1),
    hero_slot_count: z.number().int().positive(),
    shelf_card_limit: z.number().int().positive(),
  }).strict(),
  source_endpoints: z.object({
    legacy_feed: z.string().trim().min(1),
    global_highlights: z.string().trim().min(1),
    aftershow_detail: z.string().trim().min(1),
  }).strict(),
  shelves: z.array(shelfSchema).length(LAUNCH_HOME_SHELF_IDS.length),
  storyline_contract: z.object({
    storage_strategy: z.string().trim().min(1),
    required_for_surfaces: z.array(z.string().trim().min(1)).default([]),
    recommended_fields: z.array(z.string().trim().min(1)).default([]),
    storyline_states: z.array(z.string().trim().min(1)).default([]),
    source_priority: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
  highlight_projection: z.record(z.string(), z.unknown()),
  aftershow_projection: z.record(z.string(), z.unknown()),
  read_model_fields: z.array(z.object({
    key: z.string().trim().min(1),
    type: z.string().trim().min(1),
    storage_hint: z.string().trim().min(1),
    used_by: z.array(z.string().trim().min(1)).default([]),
  }).strict()).default([]),
  fallback_rules: z.array(z.string().trim().min(1)).default([]),
}).strict()

export interface LaunchHomeProgrammingRuntime {
  version: number
  draft_status: string
  notes: string[]
  home_surface: z.infer<typeof launchHomeProgrammingSchema>['home_surface']
  source_endpoints: z.infer<typeof launchHomeProgrammingSchema>['source_endpoints']
  shelves: z.infer<typeof launchHomeProgrammingSchema>['shelves']
  storyline_contract: z.infer<typeof launchHomeProgrammingSchema>['storyline_contract']
  highlight_projection: Record<string, unknown>
  aftershow_projection: Record<string, unknown>
  read_model_fields: z.infer<typeof launchHomeProgrammingSchema>['read_model_fields']
  fallback_rules: string[]
}

let cachedLaunchHomeProgramming: LaunchHomeProgrammingRuntime | null = null

function toValidationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function readYaml(pathname: string): unknown {
  return parseYaml(readFileSync(pathname, 'utf8'))
}

function normalizeLaunchHomeShelfId(value: string, pathLabel: string): LaunchHomeShelfId {
  const shelfId = normalizeEditorialShelfId(value)
  if (!shelfId || !(LAUNCH_HOME_SHELF_IDS as readonly string[]).includes(shelfId)) {
    throw new ValidationError(
      `Invalid launch home programming contract: ${pathLabel} must use a canonical launch shelf id`,
    )
  }
  return shelfId as LaunchHomeShelfId
}

function normalizeLaunchHomeContentKinds(
  values: string[],
  pathLabel: string,
): ContentKind[] {
  return values.map((value, index) => {
    const contentKind = normalizeContentKind(value)
    if (!contentKind) {
      throw new ValidationError(
        `Invalid launch home programming contract: ${pathLabel}[${index}] must use a canonical content_kind`,
      )
    }
    return contentKind
  })
}

function normalizeLaunchHomeSurfaceKinds(
  values: string[] | undefined,
  pathLabel: string,
): LaunchSurfaceKindId[] | undefined {
  if (!values) return undefined
  return values.map((value, index) => {
    const surfaceKind = normalizeLaunchSurfaceKindId(value)
    if (!surfaceKind) {
      throw new ValidationError(
        `Invalid launch home programming contract: ${pathLabel}[${index}] must use a canonical surface_kind`,
      )
    }
    return surfaceKind
  })
}

function normalizeLaunchHomeShelfLabel(shelfId: LaunchHomeShelfId, label: string): string {
  const normalizedLabelShelfId = normalizeEditorialShelfId(label)
  if (normalizedLabelShelfId === shelfId) {
    return EDITORIAL_SHELF_LABELS[shelfId as EditorialShelfId]
  }
  return label
}

function normalizeLaunchHomeProgrammingRuntime(input: unknown): LaunchHomeProgrammingRuntime {
  const parsed = launchHomeProgrammingSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(`Invalid launch home programming contract: ${toValidationMessage(parsed.error)}`)
  }

  const file = parsed.data
  const normalizedShelves = file.shelves.map((shelf, index) => ({
    ...shelf,
    id: normalizeLaunchHomeShelfId(shelf.id, `shelves[${index}].id`),
    label: normalizeLaunchHomeShelfLabel(
      normalizeLaunchHomeShelfId(shelf.id, `shelves[${index}].id`),
      shelf.label,
    ),
    accepts_content_kinds: normalizeLaunchHomeContentKinds(
      shelf.accepts_content_kinds,
      `shelves[${index}].accepts_content_kinds`,
    ),
    preferred_surface_kinds: normalizeLaunchHomeSurfaceKinds(
      shelf.preferred_surface_kinds,
      `shelves[${index}].preferred_surface_kinds`,
    ),
  }))

  const actualOrder = normalizedShelves.map((item) => item.id)
  const expectedOrder = [...LAUNCH_HOME_SHELF_IDS]
  if (actualOrder.length !== expectedOrder.length || actualOrder.some((id, index) => id !== expectedOrder[index])) {
    throw new ValidationError(
      'Invalid launch home programming contract: shelves must follow the canonical launch order',
    )
  }

  normalizedShelves.forEach((shelf, index) => {
    if (shelf.position !== index + 1) {
      throw new ValidationError(
        `Invalid launch home programming contract: ${shelf.id} must use position ${index + 1}`,
      )
    }
    if (shelf.label !== EDITORIAL_SHELF_LABELS[shelf.id as EditorialShelfId]) {
      throw new ValidationError(
        `Invalid launch home programming contract: ${shelf.id} must use label "${EDITORIAL_SHELF_LABELS[shelf.id as EditorialShelfId]}"`,
      )
    }
  })

  const notesShelf = normalizedShelves.find((item) => item.id === 'notes_today')
  if (!notesShelf || notesShelf.empty_policy !== 'collapse') {
    throw new ValidationError(
      'Invalid launch home programming contract: notes_today must collapse when no native creator-note supply is available',
    )
  }

  const tonightShelf = normalizedShelves.find((item) => item.id === 'tonight_programming')
  if (!tonightShelf || tonightShelf.empty_policy !== 'collapse') {
    throw new ValidationError(
      'Invalid launch home programming contract: tonight_programming must collapse until T-137 provides schedule data',
    )
  }

  return {
    version: file.version,
    draft_status: file.draft_status,
    notes: file.notes,
    home_surface: file.home_surface,
    source_endpoints: file.source_endpoints,
    shelves: normalizedShelves,
    storyline_contract: file.storyline_contract,
    highlight_projection: file.highlight_projection,
    aftershow_projection: file.aftershow_projection,
    read_model_fields: file.read_model_fields,
    fallback_rules: file.fallback_rules,
  }
}

export function getLaunchHomeProgramming(
  pathname = DEFAULT_LAUNCH_HOME_PROGRAMMING_PATH,
): LaunchHomeProgrammingRuntime {
  if (pathname === DEFAULT_LAUNCH_HOME_PROGRAMMING_PATH && cachedLaunchHomeProgramming) {
    return cachedLaunchHomeProgramming
  }

  const runtime = normalizeLaunchHomeProgrammingRuntime(readYaml(pathname))
  if (pathname === DEFAULT_LAUNCH_HOME_PROGRAMMING_PATH) {
    cachedLaunchHomeProgramming = runtime
  }
  return runtime
}

import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  buildScenePoolCatalogFromManifest,
  parseStageTemplateAuthoringDocument,
  parseStageTemplateAuthoringManifest,
} from './public-director-contract.js'

/**
 * @typedef {{
 *   surface: 'forum'
 *   community_id?: string
 *   community_slug: string
 *   seasonal_slot?: string | null
 *   binding_type: 'core' | 'seasonal' | 'campaign' | 'event'
 *   lifecycle: { start_at?: string, end_at?: string }
 *   weights: { editorial_priority: number, base_weight: number, freshness_bonus: number }
 *   activation: { time_windows: string[], allowed_days: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>, trigger_conditions: Array<'editorial_window' | 'community_event' | 'hot_topic_match' | 'continuity_followup' | 'manual_campaign'> }
 *   governance: { canary_percent?: number, risk_override?: 'none' | 'review_required' | 'strict_only' | 'block' }
 *   constraints: { max_runs_per_day?: number, cooldown_hours?: number }
 * } | {
 *   surface: 'chat_room'
 *   room_id: string
 *   binding_type: 'core' | 'seasonal' | 'campaign' | 'event'
 *   lifecycle: { start_at?: string, end_at?: string }
 *   weights: { editorial_priority: number, base_weight: number, freshness_bonus: number }
 *   activation: { time_windows: string[], allowed_days: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>, trigger_conditions: Array<'editorial_window' | 'community_event' | 'hot_topic_match' | 'continuity_followup' | 'manual_campaign'> }
 *   governance: { canary_percent?: number, risk_override?: 'none' | 'review_required' | 'strict_only' | 'block' }
 *   constraints: { max_runs_per_day?: number, cooldown_hours?: number }
 * }} StageTemplateBinding
 */

/**
 * @typedef {{
 *   id: string
 *   category: string
 *   path: string
 *   lifecycle_status: 'draft' | 'hidden' | 'canary' | 'seasonal_active' | 'core_active' | 'retiring' | 'archived' | 'blocked'
 *   bindings: StageTemplateBinding[]
 * }} StageTemplateManifestItem
 */

/**
 * @typedef {{
 *   version: 'v2'
 *   generated_at?: string
 *   launch?: Record<string, unknown>
 *   templates: StageTemplateManifestItem[]
 *   seasonal_slots: Array<{ slot: string, community_slug: string }>
 *   rotation_audit?: Array<{
 *     at: string
 *     open_count: number
 *     replaced: Array<{ slot: string, template_id: string }>
 *     activated: Array<{ slot: string, template_id: string }>
 *   }>
 * }} StageTemplateManifest
 */

export class StageTemplateValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'StageTemplateValidationError'
  }
}

function createSeasonalBinding(slot) {
  return {
    surface: 'forum',
    community_slug: slot.community_slug,
    seasonal_slot: slot.slot,
    binding_type: 'seasonal',
    lifecycle: {},
    weights: {
      editorial_priority: 10,
      base_weight: 1,
      freshness_bonus: 1,
    },
    activation: {
      time_windows: [],
      allowed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      trigger_conditions: [],
    },
    governance: {},
    constraints: {},
  }
}

/**
 * @template T
 * @param {string} filePath
 * @returns {T}
 */
export function readYamlFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  try {
    return /** @type {T} */ (parseYaml(raw))
  } catch (error) {
    throw new StageTemplateValidationError(
      `Invalid YAML payload: ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * @param {string} filePath
 * @param {unknown} payload
 */
export function writeYamlFileAtomic(filePath, payload) {
  const content = `${stringifyYaml(payload)}`
  writeTextAtomic(filePath, content)
}

/**
 * @param {StageTemplateManifestItem} item
 * @returns {StageTemplateBinding[]}
 */
function normalizeManifestBindings(item) {
  return Array.isArray(item.bindings) ? item.bindings.filter(Boolean) : []
}

/**
 * @param {StageTemplateBinding} binding
 * @returns {boolean}
 */
function isForumBinding(binding) {
  return binding.surface === 'forum'
}

/**
 * @param {StageTemplateManifestItem} item
 * @param {string} slot
 */
function detachRotatedForumBinding(item, slot) {
  item.bindings = normalizeManifestBindings(item).filter((binding) => {
    if (!isForumBinding(binding)) return true
    return binding.seasonal_slot !== slot || binding.binding_type !== 'seasonal'
  })
}

/**
 * @param {StageTemplateManifestItem} item
 * @param {StageTemplateBinding} binding
 */
function attachLaunchBinding(item, binding) {
  const preserved = normalizeManifestBindings(item).filter((existing) => {
    if (!isForumBinding(binding)) {
      return true
    }
    if (!isForumBinding(existing)) {
      return true
    }
    return !(
      existing.community_slug === binding.community_slug
      && (existing.seasonal_slot ?? null) === (binding.seasonal_slot ?? null)
      && existing.binding_type === binding.binding_type
    )
  })
  item.bindings = [...preserved, binding]
}

/**
 * @param {StageTemplateManifest} manifestInput
 * @param {number} openCount
 * @returns {{ manifest: StageTemplateManifest, replaced: Array<{ slot: string, template_id: string }>, activated: Array<{ slot: string, template_id: string }> }}
 */
export function rotateStageTemplates(manifestInput, openCount) {
  const manifest = parseStageTemplateAuthoringManifest(manifestInput)
  if (!Number.isFinite(openCount) || openCount < 3 || openCount > 5) {
    throw new StageTemplateValidationError('open_count must be between 3 and 5')
  }

  /** @type {StageTemplateManifest} */
  const nextManifest = structuredClone(manifest)
  const templates = nextManifest.templates
  const hidden = templates.filter((item) => item.lifecycle_status === 'hidden')
  if (hidden.length < openCount) {
    throw new StageTemplateValidationError(`Not enough hidden templates to open ${openCount}; hidden=${hidden.length}`)
  }

  const slots = nextManifest.seasonal_slots.slice(0, openCount)
  if (slots.length < openCount) {
    throw new StageTemplateValidationError(`Not enough seasonal slots; need ${openCount}, got ${slots.length}`)
  }

  /** @type {Array<{ slot: string, template_id: string }>} */
  const replaced = []
  /** @type {Array<{ slot: string, template_id: string }>} */
  const activated = []

  for (let i = 0; i < openCount; i += 1) {
    const slot = slots[i]
    const existingLaunch = templates.find((item) =>
      item.lifecycle_status === 'seasonal_active'
      && normalizeManifestBindings(item).some((binding) =>
        isForumBinding(binding) && binding.seasonal_slot === slot.slot && binding.binding_type === 'seasonal'))
    const nextTemplate = hidden[i]
    if (!nextTemplate) {
      throw new StageTemplateValidationError(`Failed to resolve hidden template for slot ${slot.slot}`)
    }

    if (existingLaunch) {
      existingLaunch.lifecycle_status = 'hidden'
      detachRotatedForumBinding(existingLaunch, slot.slot)
      replaced.push({ slot: slot.slot, template_id: existingLaunch.id })
    }

    nextTemplate.lifecycle_status = 'seasonal_active'
    attachLaunchBinding(nextTemplate, createSeasonalBinding(slot))
    activated.push({ slot: slot.slot, template_id: nextTemplate.id })
  }

  return {
    manifest: nextManifest,
    replaced,
    activated,
  }
}

/**
 * @param {string} baseDir
 * @param {StageTemplateManifest} manifestInput
 * @param {string} exportedAt
 * @returns {{
 *   library: { version: 'v2', exported_at: string, templates: Array<Record<string, unknown>>, contract_version: 'public_director_contract_v1', stage_templates: Array<Record<string, unknown>>, scene_bindings: Array<Record<string, unknown>>, surface_vocabulary: Record<string, unknown> },
 *   launch: { version: 'v2', exported_at: string, templates: Array<Record<string, unknown>>, contract_version: 'public_director_contract_v1', stage_templates: Array<Record<string, unknown>>, scene_bindings: Array<Record<string, unknown>>, surface_vocabulary: Record<string, unknown> },
 *   exported_templates: number,
 *   launch_templates: number,
 * }}
 */
export function buildStageTemplateDistPayload(baseDir, manifestInput, exportedAt) {
  const manifest = parseStageTemplateAuthoringManifest(manifestInput)
  const templateDocs = manifest.templates.map((item) => {
    const templateFilePath = path.join(baseDir, item.path)
    const doc = readYamlFile(templateFilePath)
    if (!doc || typeof doc !== 'object') {
      throw new StageTemplateValidationError(`Template file must be an object: ${item.path}`)
    }
    try {
      parseStageTemplateAuthoringDocument(doc)
    } catch (error) {
      throw new StageTemplateValidationError(
        `Template contract invalid: ${item.path}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    return { id: item.id, doc }
  })

  const libraryCatalog = buildScenePoolCatalogFromManifest(manifest, templateDocs, exportedAt)
  const launchTemplates = libraryCatalog.templates.filter((item) => item.status === 'launch')
  const launchStageTemplates = libraryCatalog.stage_templates.filter((item) =>
    item.lifecycle_status === 'core_active' || item.lifecycle_status === 'seasonal_active')
  const launchBindings = libraryCatalog.scene_bindings.filter((item) => item.status === 'active')

  return {
    library: libraryCatalog,
    launch: {
      version: 'v2',
      contract_version: 'public_director_contract_v1',
      exported_at: exportedAt,
      templates: launchTemplates,
      stage_templates: launchStageTemplates,
      scene_bindings: launchBindings,
      surface_vocabulary: libraryCatalog.surface_vocabulary,
    },
    exported_templates: libraryCatalog.templates.length,
    launch_templates: launchTemplates.length,
  }
}

/**
 * @param {{
 *   base_dir: string
 *   dist_dir?: string
 *   open_count: number
 *   dry_run: boolean
 *   now_iso?: string
 *   inject_failure_step?: 'after_library_commit' | 'after_dist_commit' | 'after_manifest_commit'
 * }} input
 * @returns {{
 *   open_count: number
 *   dry_run: boolean
 *   replaced: Array<{ slot: string, template_id: string }>
 *   activated: Array<{ slot: string, template_id: string }>
 *   exported_templates: number
 *   launch_templates: number
 * }}
 */
export function applySeasonRotationAtomic(input) {
  const manifestPath = path.join(input.base_dir, 'manifest.yaml')
  if (!fs.existsSync(manifestPath)) {
    throw new StageTemplateValidationError(`Manifest not found: ${manifestPath}`)
  }

  const nowIso = input.now_iso ?? new Date().toISOString()
  const originalManifestRaw = fs.readFileSync(manifestPath, 'utf8')
  const manifest = readYamlFile(manifestPath)
  const { manifest: rotatedManifest, replaced, activated } = rotateStageTemplates(manifest, input.open_count)

  if (input.dry_run) {
    return {
      open_count: input.open_count,
      dry_run: true,
      replaced,
      activated,
      exported_templates: 0,
      launch_templates: 0,
    }
  }

  rotatedManifest.generated_at = nowIso
  if (!Array.isArray(rotatedManifest.rotation_audit)) {
    rotatedManifest.rotation_audit = []
  }
  rotatedManifest.rotation_audit.push({
    at: nowIso,
    open_count: input.open_count,
    replaced,
    activated,
  })

  const distPayload = buildStageTemplateDistPayload(input.base_dir, rotatedManifest, nowIso)
  const distDir = input.dist_dir ?? path.join(path.dirname(input.base_dir), 'dist')
  const libraryPath = path.join(distDir, 'library.json')
  const launchPath = path.join(distDir, 'launch.json')

  fs.mkdirSync(distDir, { recursive: true })

  const oldLibrary = readOptionalText(libraryPath)
  const oldLaunch = readOptionalText(launchPath)

  try {
    writeTextAtomic(libraryPath, toJson(distPayload.library))
    if (input.inject_failure_step === 'after_library_commit') {
      throw new Error('Injected failure after library commit')
    }

    writeTextAtomic(launchPath, toJson(distPayload.launch))
    if (input.inject_failure_step === 'after_dist_commit') {
      throw new Error('Injected failure after dist commit')
    }

    writeTextAtomic(manifestPath, `${stringifyYaml(rotatedManifest)}`)
    if (input.inject_failure_step === 'after_manifest_commit') {
      throw new Error('Injected failure after manifest commit')
    }
  } catch (error) {
    const rollbackErrors = []

    try {
      writeTextAtomic(manifestPath, originalManifestRaw)
    } catch (rollbackError) {
      rollbackErrors.push(`manifest rollback failed: ${String(rollbackError)}`)
    }

    try {
      restoreOptionalText(libraryPath, oldLibrary)
    } catch (rollbackError) {
      rollbackErrors.push(`library rollback failed: ${String(rollbackError)}`)
    }

    try {
      restoreOptionalText(launchPath, oldLaunch)
    } catch (rollbackError) {
      rollbackErrors.push(`launch rollback failed: ${String(rollbackError)}`)
    }

    const parts = [`Season rotation failed: ${error instanceof Error ? error.message : String(error)}`]
    if (rollbackErrors.length > 0) {
      parts.push(`Rollback errors: ${rollbackErrors.join('; ')}`)
    }
    throw new Error(parts.join(' | '))
  }

  return {
    open_count: input.open_count,
    dry_run: false,
    replaced,
    activated,
    exported_templates: distPayload.exported_templates,
    launch_templates: distPayload.launch_templates,
  }
}

/**
 * @param {string} targetPath
 * @param {string} content
 */
function writeTextAtomic(targetPath, content) {
  const dir = path.dirname(targetPath)
  fs.mkdirSync(dir, { recursive: true })
  const tmpPath = path.join(
    dir,
    `.${path.basename(targetPath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )

  fs.writeFileSync(tmpPath, content, 'utf8')
  fs.renameSync(tmpPath, targetPath)
}

/**
 * @param {string} filePath
 * @returns {string | null}
 */
function readOptionalText(filePath) {
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, 'utf8')
}

/**
 * @param {string} filePath
 * @param {string | null} content
 */
function restoreOptionalText(filePath, content) {
  if (content === null) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return
  }

  writeTextAtomic(filePath, content)
}

/**
 * @param {unknown} payload
 * @returns {string}
 */
function toJson(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`
}

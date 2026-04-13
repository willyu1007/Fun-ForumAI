import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.js'
import type { KickoffProfileId } from '../../shared/kickoff-workflow.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const DEFAULT_KICKOFF_MANIFEST_PATH = resolve(REPO_ROOT, 'config/kickoff/manifest.v1.yaml')

const kickoffPathSchema = z.string().trim().min(1)

const kickoffManifestSchema = z.object({
  version: z.literal(1),
  entrypoint: z.string().trim().min(1),
  launch_manifest_path: kickoffPathSchema,
  contracts: z.object({
    authoring_patch: kickoffPathSchema,
    import_report: kickoffPathSchema,
    runtime_readiness: kickoffPathSchema,
  }).strict(),
  profiles: z.array(z.object({
    id: z.enum([
      'local-llm-assisted-candidate',
      'local-llm-assisted-runtime-simulation',
    ]),
    path: kickoffPathSchema,
  }).strict()).min(2),
  quality_profiles: z.object({
    default: kickoffPathSchema,
  }).strict(),
  patch_pack_registry: kickoffPathSchema,
  verification_boundary: z.array(z.enum([
    'repo_contract',
    'kickoff_import',
    'kickoff_runtime_readiness',
  ])).min(1),
  notes: z.array(z.string().trim().min(1)).optional(),
}).strict()

const kickoffProfileSchema = z.object({
  version: z.literal(1),
  id: z.enum([
    'local-llm-assisted-candidate',
    'local-llm-assisted-runtime-simulation',
  ]),
  mode: z.enum(['candidate', 'active']),
  assistant_kind: z.literal('local-llm-assisted'),
  bootstrap: z.object({
    reset_before_bootstrap: z.boolean(),
    seed_profile: z.literal('launch'),
    activate_after_import: z.boolean(),
    default_target_batch: z.enum(['kickoff', 'warmup']),
    max_runtime_topup_posts: z.number().int().min(0),
  }).strict(),
  import_defaults: z.object({
    allow_inline_patch: z.boolean(),
    allow_patch_pack_lookup: z.boolean(),
    allow_runtime_instruction_payload: z.boolean(),
    default_generation_mode: z.enum([
      'warmup_candidate',
      'warmup_topup_candidate',
      'governance_restore',
    ]),
    require_real_service_import: z.boolean(),
  }).strict(),
  observability: z.object({
    emit_context_pack: z.boolean(),
    emit_import_report: z.boolean(),
    emit_runtime_readiness: z.boolean(),
  }).strict(),
}).strict()

const kickoffQualityProfileSchema = z.object({
  version: z.literal(1),
  summary_floor: z.object({
    posts: z.number().int().min(0),
    threads: z.number().int().min(0),
    turns: z.number().int().min(0),
    votes: z.number().int().min(0),
  }).strict(),
  coverage_floor: z.object({
    communities: z.number().int().min(0),
    media_coverage_ratio: z.number().min(0).max(1),
  }).strict(),
  media_floor: z.object({
    minimum_media_assets: z.number().int().min(0),
  }).strict(),
  interaction_floor: z.object({
    minimum_threads: z.number().int().min(0),
    minimum_turns: z.number().int().min(0),
  }).strict(),
  key_communities_expected: z.array(z.string().trim().min(1)).min(1),
  key_shelves_expected: z.array(z.string().trim().min(1)).min(1),
  aftershow_pipeline_expected: z.boolean(),
  allow_public_growth_expected: z.boolean(),
}).strict()

const kickoffPatchPackRegistrySchema = z.object({
  version: z.literal(1),
  packs: z.array(z.object({
    id: z.string().trim().min(1),
    path: kickoffPathSchema,
    description: z.string().trim().min(1).optional(),
  }).strict()).default([]),
}).strict()

export type KickoffWorkflowManifest = z.infer<typeof kickoffManifestSchema>
export type KickoffWorkflowProfile = z.infer<typeof kickoffProfileSchema>
export type KickoffQualityProfile = z.infer<typeof kickoffQualityProfileSchema>
export type KickoffPatchPackRegistry = z.infer<typeof kickoffPatchPackRegistrySchema>

let cachedKickoffManifest: KickoffWorkflowManifest | null = null
const cachedProfiles = new Map<KickoffProfileId, KickoffWorkflowProfile>()
let cachedQualityProfile: KickoffQualityProfile | null = null
let cachedPatchPackRegistry: KickoffPatchPackRegistry | null = null

function toValidationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function parseYamlFile(path: string): unknown {
  return parseYaml(readFileSync(path, 'utf8'))
}

function parseJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function ensureFileExists(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new ValidationError(`Missing kickoff workflow ${label}: ${path}`)
  }
}

function resolveRepoPath(relativePath: string): string {
  return resolve(REPO_ROOT, relativePath)
}

export function readKickoffWorkflowManifest(
  manifestPath = DEFAULT_KICKOFF_MANIFEST_PATH,
): KickoffWorkflowManifest {
  if (cachedKickoffManifest && manifestPath === DEFAULT_KICKOFF_MANIFEST_PATH) {
    return cachedKickoffManifest
  }

  ensureFileExists(manifestPath, 'manifest')
  const parsed = kickoffManifestSchema.safeParse(parseYamlFile(manifestPath))
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid kickoff workflow manifest: ${toValidationMessage(parsed.error)}`,
    )
  }

  const profileIds = new Set<string>()
  const referencedPaths = new Set<string>()
  const manifestRelative = manifestPath.startsWith(REPO_ROOT)
    ? manifestPath.slice(REPO_ROOT.length + 1)
    : manifestPath
  for (const profile of parsed.data.profiles) {
    if (profileIds.has(profile.id)) {
      throw new ValidationError(`Invalid kickoff workflow manifest: duplicate profile id "${profile.id}"`)
    }
    profileIds.add(profile.id)
    referencedPaths.add(profile.path)
  }
  referencedPaths.add(parsed.data.launch_manifest_path)
  referencedPaths.add(parsed.data.contracts.authoring_patch)
  referencedPaths.add(parsed.data.contracts.import_report)
  referencedPaths.add(parsed.data.contracts.runtime_readiness)
  referencedPaths.add(parsed.data.quality_profiles.default)
  referencedPaths.add(parsed.data.patch_pack_registry)

  if (referencedPaths.has(manifestRelative)) {
    throw new ValidationError('Invalid kickoff workflow manifest: self-referential path graph is not allowed')
  }

  for (const relativePath of referencedPaths) {
    ensureFileExists(resolveRepoPath(relativePath), relativePath)
  }

  const authoringSchema = parseJsonFile(resolveRepoPath(parsed.data.contracts.authoring_patch))
  const importSchema = parseJsonFile(resolveRepoPath(parsed.data.contracts.import_report))
  const readinessSchema = parseJsonFile(resolveRepoPath(parsed.data.contracts.runtime_readiness))
  if (
    !authoringSchema
    || typeof authoringSchema !== 'object'
    || !importSchema
    || typeof importSchema !== 'object'
    || !readinessSchema
    || typeof readinessSchema !== 'object'
  ) {
    throw new ValidationError('Kickoff workflow schema contracts must parse as JSON objects')
  }

  if (manifestPath === DEFAULT_KICKOFF_MANIFEST_PATH) {
    cachedKickoffManifest = parsed.data
  }

  return parsed.data
}

export function readKickoffWorkflowProfile(profileId: KickoffProfileId): KickoffWorkflowProfile {
  if (cachedProfiles.has(profileId)) {
    return cachedProfiles.get(profileId)!
  }

  const manifest = readKickoffWorkflowManifest()
  const entry = manifest.profiles.find((item) => item.id === profileId)
  if (!entry) {
    throw new ValidationError(`Kickoff workflow profile not found: ${profileId}`)
  }

  const parsed = kickoffProfileSchema.safeParse(parseYamlFile(resolveRepoPath(entry.path)))
  if (!parsed.success) {
    throw new ValidationError(`Invalid kickoff workflow profile "${profileId}": ${toValidationMessage(parsed.error)}`)
  }
  if (parsed.data.id !== profileId) {
    throw new ValidationError(`Kickoff workflow profile "${profileId}" has mismatched id "${parsed.data.id}"`)
  }
  cachedProfiles.set(profileId, parsed.data)
  return parsed.data
}

export function readKickoffQualityProfile(): KickoffQualityProfile {
  if (cachedQualityProfile) return cachedQualityProfile
  const manifest = readKickoffWorkflowManifest()
  const parsed = kickoffQualityProfileSchema.safeParse(
    parseYamlFile(resolveRepoPath(manifest.quality_profiles.default)),
  )
  if (!parsed.success) {
    throw new ValidationError(`Invalid kickoff quality profile: ${toValidationMessage(parsed.error)}`)
  }
  cachedQualityProfile = parsed.data
  return parsed.data
}

export function readKickoffPatchPackRegistry(): KickoffPatchPackRegistry {
  if (cachedPatchPackRegistry) return cachedPatchPackRegistry
  const manifest = readKickoffWorkflowManifest()
  const parsed = kickoffPatchPackRegistrySchema.safeParse(
    parseYamlFile(resolveRepoPath(manifest.patch_pack_registry)),
  )
  if (!parsed.success) {
    throw new ValidationError(`Invalid kickoff patch-pack registry: ${toValidationMessage(parsed.error)}`)
  }
  cachedPatchPackRegistry = parsed.data
  return parsed.data
}

export function resolveKickoffPatchPackPath(packId: string): string | null {
  const registry = readKickoffPatchPackRegistry()
  const entry = registry.packs.find((item) => item.id === packId) ?? null
  return entry ? resolveRepoPath(entry.path) : null
}

export function getKickoffWorkflowRoot(): string {
  return resolveRepoPath('config/kickoff')
}

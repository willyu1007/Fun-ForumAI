import { createHash } from 'node:crypto'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.js'
import type {
  MediaImportCatalogPolicy,
  MediaImportDedupePolicy,
  MediaImportEntrypoint,
  MediaImportIndexingPolicy,
  MediaImportManifestV1,
  MediaImportReusePolicy,
  MediaImportTargetScope,
  MediaInjectionRequest,
  MediaRetrievalDocScope,
  VisualSourceKind,
} from '../repos/types.js'

const entrypointSchema = z.literal('cli_manifest')
const sourceKindSchema = z.enum([
  'owner_private_pool',
  'community_commons',
  'platform_canonical',
  'generated_public',
  'private_derived_public',
])
const scopeSchema = z.enum([
  'private_internal',
  'community_scoped',
  'public_safe',
  'planner_only',
])

const targetScopeSchema = z.object({
  owner_user_id: z.string().trim().min(1).nullable().optional(),
  steward_agent_id: z.string().trim().min(1).nullable().optional(),
  community_id: z.string().trim().min(1).nullable().optional(),
}).strict()

const indexingSchema = z.object({
  primary_scope: scopeSchema.optional(),
  public_safe_enabled: z.boolean().optional(),
  embedding_policy_id: z.literal('text-embedding-v4-1024').optional(),
}).strict()

const dedupeSchema = z.object({
  policy_id: z.enum(['exact_only', 'exact_and_near']).optional(),
}).strict()

const reuseSchema = z.object({
  mode_id: z.enum(['default', 'public_safe_only']).optional(),
}).strict()

const catalogSchema = z.object({
  policy_id: z.enum(['standard', 'generated_text_derived']).optional(),
}).strict()

const annotationsSchema = z.object({
  tags: z.array(z.string().trim().min(1)).optional(),
  internal_note: z.string().trim().min(1).nullable().optional(),
  owner_note: z.string().trim().min(1).nullable().optional(),
}).strict()

const itemBaseSchema = z.object({
  item_id: z.string().trim().min(1),
  source_kind: sourceKindSchema,
  target_scope: targetScopeSchema.optional(),
  indexing: indexingSchema.optional(),
  dedupe: dedupeSchema.optional(),
  reuse: reuseSchema.optional(),
  catalog: catalogSchema.optional(),
  annotations: annotationsSchema.optional(),
}).strict()

const localFileItemSchema = itemBaseSchema.extend({
  input_kind: z.literal('local_file'),
  path: z.string().trim().min(1),
  declared_mime_type: z.string().trim().min(1).optional(),
  declared_sha256: z.string().trim().min(1).optional(),
})

const remoteUrlItemSchema = itemBaseSchema.extend({
  input_kind: z.literal('remote_url'),
  url: z.string().trim().url(),
  expected_sha256: z.string().trim().min(1).optional(),
})

const existingAssetItemSchema = itemBaseSchema.extend({
  input_kind: z.literal('existing_asset_ref'),
  asset_id: z.string().trim().min(1),
})

const generatedArtifactItemSchema = itemBaseSchema.extend({
  input_kind: z.literal('generated_artifact_ref'),
  generated_job_id: z.string().trim().min(1),
})

const manifestSchema = z.object({
  manifest_meta: z.object({
    contract_version: z.literal(1),
    manifest_kind: z.literal('media_import'),
    manifest_id: z.string().trim().min(1),
    generated_by_tool: z.string().trim().min(1),
    generated_at: z.string().trim().min(1),
    notes: z.array(z.string().trim().min(1)).optional(),
  }).strict(),
  defaults: z.object({
    entrypoint: entrypointSchema,
    target_scope: targetScopeSchema.optional(),
    indexing: indexingSchema.optional(),
    dedupe: dedupeSchema.optional(),
    reuse: reuseSchema.optional(),
    catalog: catalogSchema.optional(),
  }).strict(),
  items: z.array(z.union([
    localFileItemSchema,
    remoteUrlItemSchema,
    existingAssetItemSchema,
    generatedArtifactItemSchema,
  ])).min(1),
}).strict()

export interface ParsedMediaImportManifest {
  manifest: MediaImportManifestV1
  requests: MediaInjectionRequest[]
  normalized_manifest_text: string
  intent_fingerprint: string
  scope_summary: {
    source_kinds: VisualSourceKind[]
    doc_scopes: MediaRetrievalDocScope[]
    owner_user_id: string | null
    steward_agent_id: string | null
    community_id: string | null
    public_safe_enabled: boolean
  }
}

function normalizeTargetScope(
  defaults: Partial<MediaImportTargetScope> | undefined,
  override: Partial<MediaImportTargetScope> | undefined,
): MediaImportTargetScope {
  return {
    owner_user_id: override?.owner_user_id ?? defaults?.owner_user_id ?? null,
    steward_agent_id: override?.steward_agent_id ?? defaults?.steward_agent_id ?? null,
    community_id: override?.community_id ?? defaults?.community_id ?? null,
  }
}

function defaultPrimaryScope(sourceKind: VisualSourceKind): MediaRetrievalDocScope {
  switch (sourceKind) {
    case 'owner_private_pool':
      return 'private_internal'
    case 'community_commons':
      return 'community_scoped'
    case 'platform_canonical':
    case 'generated_public':
    case 'private_derived_public':
    default:
      return 'public_safe'
  }
}

function normalizeIndexing(
  sourceKind: VisualSourceKind,
  defaults: Partial<MediaImportIndexingPolicy> | undefined,
  override: Partial<MediaImportIndexingPolicy> | undefined,
): MediaImportIndexingPolicy {
  const primary_scope = override?.primary_scope ?? defaults?.primary_scope ?? defaultPrimaryScope(sourceKind)
  const public_safe_enabled = override?.public_safe_enabled
    ?? defaults?.public_safe_enabled
    ?? (sourceKind !== 'owner_private_pool')
  const embedding_policy_id = override?.embedding_policy_id
    ?? defaults?.embedding_policy_id
    ?? 'text-embedding-v4-1024'
  return {
    primary_scope,
    public_safe_enabled,
    embedding_policy_id,
  }
}

function normalizeDedupe(
  defaults: Partial<MediaImportDedupePolicy> | undefined,
  override: Partial<MediaImportDedupePolicy> | undefined,
): MediaImportDedupePolicy {
  return {
    policy_id: override?.policy_id ?? defaults?.policy_id ?? 'exact_and_near',
  }
}

function normalizeReuse(
  defaults: Partial<MediaImportReusePolicy> | undefined,
  override: Partial<MediaImportReusePolicy> | undefined,
): MediaImportReusePolicy {
  return {
    mode_id: override?.mode_id ?? defaults?.mode_id ?? 'default',
  }
}

function normalizeCatalog(
  sourceKind: VisualSourceKind,
  defaults: Partial<MediaImportCatalogPolicy> | undefined,
  override: Partial<MediaImportCatalogPolicy> | undefined,
): MediaImportCatalogPolicy {
  return {
    policy_id:
      override?.policy_id
      ?? defaults?.policy_id
      ?? (sourceKind === 'generated_public' ? 'generated_text_derived' : 'standard'),
  }
}

function normalizeAnnotations(
  input: {
    tags?: string[]
    internal_note?: string | null
    owner_note?: string | null
  } | undefined,
) {
  return {
    tags: input?.tags?.map((item) => item.trim()).filter(Boolean) ?? [],
    internal_note: input?.internal_note?.trim() || null,
    owner_note: input?.owner_note?.trim() || null,
  }
}

function buildNormalizedRequest(
  manifest: MediaImportManifestV1,
  item: MediaImportManifestV1['items'][number],
): MediaInjectionRequest {
  const target_scope = normalizeTargetScope(manifest.defaults.target_scope, item.target_scope)
  const indexing = normalizeIndexing(item.source_kind, manifest.defaults.indexing, item.indexing)
  const dedupe = normalizeDedupe(manifest.defaults.dedupe, item.dedupe)
  const reuse = normalizeReuse(manifest.defaults.reuse, item.reuse)
  const catalog = normalizeCatalog(item.source_kind, manifest.defaults.catalog, item.catalog)
  const annotations = normalizeAnnotations(item.annotations)

  const base: MediaInjectionRequest = {
    item_id: item.item_id,
    input_kind: item.input_kind,
    source_kind: item.source_kind,
    target_scope,
    indexing,
    dedupe,
    reuse,
    catalog,
    annotations,
  }

  switch (item.input_kind) {
    case 'local_file':
      return {
        ...base,
        local_file: {
          path: item.path,
          declared_mime_type: item.declared_mime_type?.trim() || null,
          declared_sha256: item.declared_sha256?.trim() || null,
        },
      }
    case 'remote_url':
      return {
        ...base,
        remote_url: {
          url: item.url,
          expected_sha256: item.expected_sha256?.trim() || null,
        },
      }
    case 'existing_asset_ref':
      return {
        ...base,
        existing_asset_ref: {
          asset_id: item.asset_id,
        },
      }
    case 'generated_artifact_ref':
      return {
        ...base,
        generated_artifact_ref: {
          generated_job_id: item.generated_job_id,
        },
      }
  }
}

function assertSemanticGuards(request: MediaInjectionRequest): void {
  if (request.source_kind === 'community_commons' && !request.target_scope.community_id) {
    throw new ValidationError(`item ${request.item_id} requires target_scope.community_id for community_commons`)
  }
  if (request.source_kind === 'owner_private_pool' && !request.target_scope.steward_agent_id) {
    throw new ValidationError(`item ${request.item_id} requires target_scope.steward_agent_id for owner_private_pool`)
  }
  if (request.source_kind === 'owner_private_pool' && request.indexing.primary_scope !== 'private_internal') {
    throw new ValidationError(`item ${request.item_id} must use private_internal indexing for owner_private_pool`)
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `"${key}":${stableStringify(item)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

function computeIntentFingerprint(requests: MediaInjectionRequest[]): string {
  return createHash('sha256')
    .update(stableStringify(requests))
    .digest('hex')
}

export function parseMediaImportManifest(input: {
  raw_manifest_text: string
  format: 'yaml' | 'json'
}): ParsedMediaImportManifest {
  let rawValue: unknown
  try {
    rawValue = input.format === 'yaml'
      ? parseYaml(input.raw_manifest_text)
      : JSON.parse(input.raw_manifest_text)
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : 'failed to parse media import manifest',
    )
  }

  const parsed = manifestSchema.safeParse(rawValue)
  if (!parsed.success) {
    throw new ValidationError('invalid media import manifest', parsed.error.flatten())
  }

  const manifest = parsed.data as MediaImportManifestV1
  const requests = manifest.items.map((item) => {
    const request = buildNormalizedRequest(manifest, item)
    assertSemanticGuards(request)
    return request
  })
  const normalized_manifest_text = JSON.stringify({
    manifest_meta: manifest.manifest_meta,
    defaults: manifest.defaults,
    items: requests,
  }, null, 2)
  const source_kinds = Array.from(new Set(requests.map((item) => item.source_kind)))
  const doc_scopes = Array.from(new Set(requests.map((item) => item.indexing.primary_scope)))
  const scope_summary = {
    source_kinds,
    doc_scopes,
    owner_user_id: requests[0]?.target_scope.owner_user_id ?? null,
    steward_agent_id: requests[0]?.target_scope.steward_agent_id ?? null,
    community_id: requests[0]?.target_scope.community_id ?? null,
    public_safe_enabled: requests.some((item) => item.indexing.public_safe_enabled),
  }

  return {
    manifest,
    requests,
    normalized_manifest_text,
    intent_fingerprint: computeIntentFingerprint(requests),
    scope_summary,
  }
}

export function buildMediaImportRequestFingerprint(input: {
  intent_fingerprint: string
  apply_request_id: string
  entrypoint?: MediaImportEntrypoint
}): string {
  return createHash('sha256')
    .update(`${input.entrypoint ?? 'cli_manifest'}:${input.intent_fingerprint}:${input.apply_request_id}`)
    .digest('hex')
}

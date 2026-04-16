import { createHash, randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { config } from '../lib/config.js'
import { ValidationError } from '../lib/errors.js'
import type { MediaImportJob, MediaInjectionRequest } from '../repos/types.js'
import type { MediaImportJobRepository } from '../repos/media-import-job-repository.js'
import type { MediaImportJobItemRepository } from '../repos/media-import-job-item-repository.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import type { MediaDuplicateService } from './media-duplicate-service.js'
import {
  buildMediaImportRequestFingerprint,
  parseMediaImportManifest,
} from './media-injection-manifest.js'
import type { MediaImportArtifactService } from './media-import-artifact-service.js'

export interface MediaInjectionServiceDeps {
  mediaImportJobRepo: MediaImportJobRepository
  mediaImportJobItemRepo: MediaImportJobItemRepository
  mediaImportArtifactService: MediaImportArtifactService
  mediaDuplicateService?: MediaDuplicateService | null
  mediaAssetRepo?: Pick<MediaAssetRepository, 'findById'> | null
  mediaGenerationJobRepo?: Pick<MediaGenerationJobRepository, 'findById'> | null
}

export interface StageMediaImportManifestInput {
  manifest_path: string
  raw_manifest_text: string
  format: 'yaml' | 'json'
  requested_by_type: 'user' | 'agent' | 'system'
  requested_by_id: string
  apply_request_id?: string
}

export class MediaInjectionService {
  constructor(private readonly deps: MediaInjectionServiceDeps) {}

  async dryRun(input: {
    manifest_path: string
    raw_manifest_text: string
    format: 'yaml' | 'json'
  }): Promise<{
    request_count: number
    intent_fingerprint: string
    scope_summary: Awaited<ReturnType<typeof parseMediaImportManifest>>['scope_summary']
    requests: MediaInjectionRequest[]
    item_plan: Array<{
      item_id: string
      action: 'create' | 'reuse'
      reusable_asset_id: string | null
    }>
  }> {
    const parsed = parseMediaImportManifest({
      raw_manifest_text: input.raw_manifest_text,
      format: input.format,
    })
    const manifestDir = dirname(resolve(input.manifest_path))
    const plannedCreateKeys = new Set<string>()
    const itemPlan = [] as Array<{
      item_id: string
      action: 'create' | 'reuse'
      reusable_asset_id: string | null
    }>
    for (const request of parsed.requests) {
      const reusableAssetId = await this.resolveReusableAssetId(request, manifestDir)
      const plannedReuseKey = await this.resolvePlannedReuseKey(request, manifestDir)
      const action: 'create' | 'reuse' = reusableAssetId || (plannedReuseKey && plannedCreateKeys.has(plannedReuseKey))
        ? 'reuse'
        : 'create'
      if (action === 'create' && plannedReuseKey) {
        plannedCreateKeys.add(plannedReuseKey)
      }
      itemPlan.push({
        item_id: request.item_id,
        action,
        reusable_asset_id: reusableAssetId,
      })
    }
    return {
      request_count: parsed.requests.length,
      intent_fingerprint: parsed.intent_fingerprint,
      scope_summary: parsed.scope_summary,
      requests: parsed.requests,
      item_plan: itemPlan,
    }
  }

  async stageApply(input: StageMediaImportManifestInput): Promise<MediaImportJob> {
    if (!config.launch.capabilities.mediaInjectionV1) {
      throw new ValidationError('media injection apply is disabled by FF_MEDIA_INJECTION_V1')
    }
    const parsed = parseMediaImportManifest({
      raw_manifest_text: input.raw_manifest_text,
      format: input.format,
    })
    const applyRequestId = input.apply_request_id ?? randomUUID()
    const requestFingerprint = buildMediaImportRequestFingerprint({
      intent_fingerprint: parsed.intent_fingerprint,
      apply_request_id: applyRequestId,
    })
    const existing = await this.deps.mediaImportJobRepo.findByRequestFingerprint(requestFingerprint)
    if (existing) return existing

    const stagingManifestKey = await this.deps.mediaImportArtifactService.stageRawManifest({
      request_fingerprint: requestFingerprint,
      text: input.raw_manifest_text,
      format: input.format,
    })
    const normalizedManifestKey = await this.deps.mediaImportArtifactService.stageNormalizedManifest({
      request_fingerprint: requestFingerprint,
      text: parsed.normalized_manifest_text,
    })
    const manifestDir = dirname(resolve(input.manifest_path))
    const preparedItems = await Promise.all(parsed.requests.map((request, itemIndex) =>
      this.prepareStagedItem({
        request,
        item_index: itemIndex,
        request_fingerprint: requestFingerprint,
        manifest_dir: manifestDir,
      }),
    ))

    const job = await this.deps.mediaImportJobRepo.create({
      status: 'staged',
      phase: 'validate_manifest',
      entrypoint: 'cli_manifest',
      requested_by_type: input.requested_by_type,
      requested_by_id: input.requested_by_id,
      manifest_version: parsed.manifest.manifest_meta.contract_version,
      intent_fingerprint: parsed.intent_fingerprint,
      request_fingerprint: requestFingerprint,
      staging_manifest_key: stagingManifestKey,
      normalized_manifest_key: normalizedManifestKey,
      scope_summary_json: parsed.scope_summary,
      total_items: preparedItems.length,
      processed_items: 0,
      created_items: 0,
      reused_items: 0,
      suppressed_items: 0,
      failed_items: 0,
      attempt_count: 0,
    })

    await this.deps.mediaImportJobItemRepo.createMany(preparedItems.map((item) => ({
      job_id: job.id,
      item_id: item.item_id,
      item_index: item.item_index,
      status: 'pending',
      input_kind: item.request.input_kind,
      source_kind: item.request.source_kind,
      index_scope: item.request.indexing.primary_scope,
      owner_user_id: item.request.target_scope.owner_user_id,
      steward_agent_id: item.request.target_scope.steward_agent_id,
      community_id: item.request.target_scope.community_id,
      staging_object_key: item.staging_object_key,
      origin_url: item.origin_url,
      source_asset_id: item.source_asset_id,
      generated_job_id: item.generated_job_id,
      declared_sha256: item.declared_sha256,
      mime_type: item.mime_type,
      file_size_bytes: item.file_size_bytes,
      width: null,
      height: null,
      resolved_request_json: item.request,
    })))

    return job
  }

  async getJobSummary(jobId: string): Promise<MediaImportJob | null> {
    return this.deps.mediaImportJobRepo.findById(jobId)
  }

  private async prepareStagedItem(input: {
    request: MediaInjectionRequest
    item_index: number
    request_fingerprint: string
    manifest_dir: string
  }): Promise<{
    item_id: string
    item_index: number
    request: MediaInjectionRequest
    staging_object_key: string | null
    origin_url: string | null
    source_asset_id: string | null
    generated_job_id: string | null
    declared_sha256: string | null
    mime_type: string | null
    file_size_bytes: number | null
  }> {
    switch (input.request.input_kind) {
      case 'local_file': {
        const resolvedPath = resolve(input.manifest_dir, input.request.local_file!.path)
        const [fileStat, bytes] = await Promise.all([stat(resolvedPath), readFile(resolvedPath)])
        const declaredMime = input.request.local_file?.declared_mime_type
          ?? inferMimeTypeFromPath(resolvedPath)
        const declaredSha = input.request.local_file?.declared_sha256
          ?? createHash('sha256').update(bytes).digest('hex')
        const stagingKey = await this.deps.mediaImportArtifactService.stageLocalFile({
          request_fingerprint: input.request_fingerprint,
          item_id: input.request.item_id,
          path: resolvedPath,
          bytes,
          content_type: declaredMime,
        })
        return {
          item_id: input.request.item_id,
          item_index: input.item_index,
          request: input.request,
          staging_object_key: stagingKey,
          origin_url: null,
          source_asset_id: null,
          generated_job_id: null,
          declared_sha256: declaredSha,
          mime_type: declaredMime,
          file_size_bytes: fileStat.size,
        }
      }
      case 'remote_url':
        return {
          item_id: input.request.item_id,
          item_index: input.item_index,
          request: input.request,
          staging_object_key: null,
          origin_url: input.request.remote_url!.url,
          source_asset_id: null,
          generated_job_id: null,
          declared_sha256: input.request.remote_url?.expected_sha256 ?? null,
          mime_type: null,
          file_size_bytes: null,
        }
      case 'existing_asset_ref':
        return {
          item_id: input.request.item_id,
          item_index: input.item_index,
          request: input.request,
          staging_object_key: null,
          origin_url: null,
          source_asset_id: input.request.existing_asset_ref!.asset_id,
          generated_job_id: null,
          declared_sha256: null,
          mime_type: null,
          file_size_bytes: null,
        }
      case 'generated_artifact_ref':
        return {
          item_id: input.request.item_id,
          item_index: input.item_index,
          request: input.request,
          staging_object_key: null,
          origin_url: null,
          source_asset_id: null,
          generated_job_id: input.request.generated_artifact_ref!.generated_job_id,
          declared_sha256: null,
          mime_type: null,
          file_size_bytes: null,
        }
    }
  }

  private async resolveLocalFileSha256(
    request: MediaInjectionRequest,
    manifestDir: string,
  ): Promise<string | null> {
    if (request.input_kind !== 'local_file') return null
    const resolvedPath = resolve(manifestDir, request.local_file!.path)
    return request.local_file?.declared_sha256
      ?? createHash('sha256').update(await readFile(resolvedPath)).digest('hex')
  }

  private async resolvePlannedReuseKey(
    request: MediaInjectionRequest,
    manifestDir: string,
  ): Promise<string | null> {
    const sha256 = await this.resolveLocalFileSha256(request, manifestDir)
    if (!sha256) return null
    if (request.source_kind === 'owner_private_pool') {
      return [
        sha256,
        request.source_kind,
        request.target_scope.owner_user_id ?? '',
        request.target_scope.steward_agent_id ?? '',
      ].join(':')
    }
    return [sha256, 'public'].join(':')
  }

  private async resolveReusableAssetId(
    request: MediaInjectionRequest,
    manifestDir: string,
  ): Promise<string | null> {
    switch (request.input_kind) {
      case 'existing_asset_ref': {
        if (!this.deps.mediaAssetRepo) {
          return request.existing_asset_ref?.asset_id ?? null
        }
        const assetId = request.existing_asset_ref?.asset_id ?? null
        if (!assetId) return null
        return (await this.deps.mediaAssetRepo.findById(assetId))?.id ?? null
      }
      case 'generated_artifact_ref': {
        if (!this.deps.mediaGenerationJobRepo) return null
        const generatedJobId = request.generated_artifact_ref?.generated_job_id ?? null
        if (!generatedJobId) return null
        return (await this.deps.mediaGenerationJobRepo.findById(generatedJobId))?.output_asset_id ?? null
      }
      case 'local_file': {
        if (!this.deps.mediaDuplicateService) return null
        const sha256 = await this.resolveLocalFileSha256(request, manifestDir)
        if (!sha256) return null
        const reusable = await this.deps.mediaDuplicateService.findReusableExactAsset({
          sha256,
          source_kind: request.source_kind,
          target_scope: {
            owner_user_id: request.target_scope.owner_user_id,
            steward_agent_id: request.target_scope.steward_agent_id,
          },
        })
        return reusable?.id ?? null
      }
      case 'remote_url':
      default:
        return null
    }
  }
}

function inferMimeTypeFromPath(path: string): string {
  const lower = extname(path).toLowerCase()
  switch (lower) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    default:
      throw new ValidationError(`unsupported local file extension for media injection: ${lower || 'unknown'}`)
  }
}

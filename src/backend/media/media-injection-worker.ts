import { config } from '../lib/config.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import type {
  MediaAsset,
  MediaImportJob,
  MediaImportJobItem,
  MediaImportJobItemStatus,
  MediaInjectionRequest,
  MediaSemanticSnapshot,
  VisualSourceKind,
} from '../repos/types.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { MediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import type { MediaImportJobItemRepository } from '../repos/media-import-job-item-repository.js'
import type { MediaImportJobRepository } from '../repos/media-import-job-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { MediaAssetService } from './media-asset-service.js'
import type { MediaReuseGovernanceService } from './media-reuse-governance-service.js'
import type { MediaRetrievalService } from './media-retrieval-service.js'
import type { MediaDuplicateService } from './media-duplicate-service.js'
import type { MediaImportArtifactService } from './media-import-artifact-service.js'

export interface MediaInjectionWorkerDeps {
  mediaImportJobRepo: MediaImportJobRepository
  mediaImportJobItemRepo: MediaImportJobItemRepository
  mediaAssetRepo: MediaAssetRepository
  agentRepo?: Pick<AgentRepository, 'findById'> | null
  mediaGenerationJobRepo: Pick<MediaGenerationJobRepository, 'findById'>
  mediaSemanticSnapshotRepo: Pick<MediaSemanticSnapshotRepository, 'findCurrentByAssetId'>
  mediaAssetService: Pick<
    MediaAssetService,
    'ingestOwnerUpload' | 'ingestOwnerUrl' | 'ingestManagedAsset' | 'ingestManagedRemoteAsset'
  >
  mediaReuseGovernanceService: Pick<
    MediaReuseGovernanceService,
    | 'registerCommunityCommonsAsset'
    | 'registerPlatformCanonicalAsset'
    | 'registerGeneratedPublicAsset'
    | 'registerPrivateDerivedPublicAsset'
    | 'registerSelfPublicArchiveAsset'
  >
  mediaRetrievalService: Pick<MediaRetrievalService, 'ensureAssetIndexed'>
  mediaDuplicateService?: MediaDuplicateService | null
  mediaImportArtifactService: MediaImportArtifactService
}

export class MediaInjectionWorker {
  constructor(private readonly deps: MediaInjectionWorkerDeps) {}

  async purgeExpiredArtifacts(): Promise<{
    input_job_ids: string[]
    result_job_ids: string[]
  }> {
    const now = new Date()
    const inputCandidates = await this.deps.mediaImportJobRepo.listExpiredInputArtifactJobs(
      now,
      config.mediaInjection.successInputRetentionMs,
      config.mediaInjection.failedInputRetentionMs,
    )
    const resultCandidates = await this.deps.mediaImportJobRepo.listExpiredResultArtifactJobs(
      now,
      config.mediaInjection.resultArtifactRetentionMs,
    )

    const inputPurged: string[] = []
    for (const job of inputCandidates) {
      try {
        const items = await this.deps.mediaImportJobItemRepo.listByJobId(job.id)
        const keys = [
          job.staging_manifest_key,
          job.normalized_manifest_key,
          ...items.map((item) => item.staging_object_key),
        ].filter((key): key is string => Boolean(key))
        if (keys.length > 0) {
          await this.deps.mediaImportArtifactService.deleteObjects(keys)
        }
        await this.deps.mediaImportJobRepo.update(job.id, {
          staging_manifest_key: null,
          normalized_manifest_key: null,
        })
        await Promise.all(items
          .filter((item) => item.staging_object_key)
          .map((item) => this.deps.mediaImportJobItemRepo.update(item.id, {
            staging_object_key: null,
          })))
        inputPurged.push(job.id)
      } catch (error) {
        console.error(`[MediaInjectionWorker] failed to purge input artifacts for job=${job.id}:`, error)
      }
    }

    const resultPurged: string[] = []
    for (const job of resultCandidates) {
      try {
        const keys = [job.result_manifest_key, job.failure_log_key].filter((key): key is string => Boolean(key))
        if (keys.length > 0) {
          await this.deps.mediaImportArtifactService.deleteObjects(keys)
        }
        await this.deps.mediaImportJobRepo.update(job.id, {
          result_manifest_key: null,
          failure_log_key: null,
        })
        resultPurged.push(job.id)
      } catch (error) {
        console.error(`[MediaInjectionWorker] failed to purge result artifacts for job=${job.id}:`, error)
      }
    }

    return {
      input_job_ids: inputPurged,
      result_job_ids: resultPurged,
    }
  }

  async sweepTimedOutRunningJobs(): Promise<MediaImportJob[]> {
    return this.deps.mediaImportJobRepo.markTimedOutRunningJobs(
      new Date(),
      config.mediaInjection.runningTimeoutMs,
    )
  }

  async expireStagedJobs(): Promise<MediaImportJob[]> {
    return this.deps.mediaImportJobRepo.markExpiredStagedJobs(
      new Date(),
      config.mediaInjection.stagedExpiryMs,
    )
  }

  async processNextReadyJob(): Promise<MediaImportJob | null> {
    await this.expireStagedJobs()
    await this.sweepTimedOutRunningJobs()
    await this.purgeExpiredArtifacts()
    const claimed = await this.deps.mediaImportJobRepo.claimNextReady({
      now: new Date(),
      worker_id: config.mediaInjection.workerId,
      global_concurrency: config.mediaInjection.globalConcurrency,
      running_timeout_ms: config.mediaInjection.runningTimeoutMs,
    })
    if (!claimed) return null
    return this.processJob(claimed.id)
  }

  async processJob(jobId: string): Promise<MediaImportJob | null> {
    const job = await this.deps.mediaImportJobRepo.findById(jobId)
    if (!job) throw new NotFoundError('MediaImportJob', jobId)
    const items = await this.deps.mediaImportJobItemRepo.listByJobId(job.id)
    await this.deps.mediaImportJobRepo.update(job.id, {
      status: 'running',
      phase: 'hydrate_inputs',
      started_at: job.started_at ?? new Date(),
      last_heartbeat_at: new Date(),
    })

    for (const item of items) {
      if (isTerminalItemStatus(item.status)) continue
      await this.deps.mediaImportJobRepo.touchHeartbeat(job.id, new Date())
      try {
        await this.processItem(job, item)
      } catch (error) {
        await this.deps.mediaImportJobItemRepo.update(item.id, {
          status: 'failed',
          failed_phase: 'materialize_assets',
          error_code: 'item_failed',
          error_message: error instanceof Error ? error.message : 'media_import_item_failed',
          finished_at: new Date(),
        })
      }
    }

    const finalItems = await this.deps.mediaImportJobItemRepo.listByJobId(job.id)
    const counts = countItemStatuses(finalItems)
    const finalStatus = resolveFinalJobStatus(counts)
    const resultKey = await this.deps.mediaImportArtifactService.writeResultManifest(job.id, {
      job_id: job.id,
      status: finalStatus,
      counts,
      items: finalItems.map((item) => ({
        item_id: item.item_id,
        status: item.status,
        resolved_asset_id: item.resolved_asset_id,
        duplicate_cluster_id: item.duplicate_cluster_id,
        error_code: item.error_code,
      })),
    })
    const failedItems = finalItems.filter((item) => item.status === 'failed')
    const failureKey = failedItems.length > 0
      ? await this.deps.mediaImportArtifactService.writeFailureLog(job.id, {
          job_id: job.id,
          failed_items: failedItems.map((item) => ({
            item_id: item.item_id,
            failed_phase: item.failed_phase,
            error_code: item.error_code,
            error_message: item.error_message,
          })),
        })
      : null

    return this.deps.mediaImportJobRepo.update(job.id, {
      status: finalStatus,
      phase: 'finalize',
      processed_items: counts.processed,
      created_items: counts.created,
      reused_items: counts.reused,
      suppressed_items: counts.suppressed,
      failed_items: counts.failed,
      result_manifest_key: resultKey,
      failure_log_key: failureKey,
      finished_at: new Date(),
      last_heartbeat_at: new Date(),
    })
  }

  private async processItem(job: MediaImportJob, item: MediaImportJobItem): Promise<void> {
    await this.deps.mediaImportJobItemRepo.update(item.id, {
      status: 'processing',
      started_at: item.started_at ?? new Date(),
      error_code: null,
      error_message: null,
    })

    const request = item.resolved_request_json
    await this.deps.mediaImportJobRepo.update(job.id, { phase: 'dedupe' })
    let asset = await this.resolveExactReusableAsset(item, request)
    let snapshot: MediaSemanticSnapshot | null = asset
      ? await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
      : null
    let status: MediaImportJobItemStatus = asset ? 'reused' : 'created'

    if (!asset || !snapshot) {
      await this.deps.mediaImportJobRepo.update(job.id, { phase: 'materialize_assets' })
      const materialized = await this.materializeAsset(item, request)
      asset = materialized.asset
      snapshot = materialized.snapshot
      status = materialized.status
    }
    if (!asset || !snapshot) {
      throw new ValidationError(`media import item ${item.item_id} could not resolve asset`)
    }

    const cluster = this.deps.mediaDuplicateService
      ? await this.deps.mediaDuplicateService.reconcileAssetClusters(asset)
      : null

    await this.registerAssetPool(request.source_kind, request, asset)
    await this.deps.mediaImportJobRepo.update(job.id, { phase: 'build_retrieval' })
    const retrievalRecords = await this.deps.mediaRetrievalService.ensureAssetIndexed({
      asset,
      snapshot,
      source_kind: request.source_kind,
      target_scope: request.target_scope,
      annotations: request.annotations,
      requested_scopes: resolveRequestedDocScopes(request),
      generated_from: request.catalog.policy_id === 'generated_text_derived'
        ? 'generated_text_derived'
        : 'catalog_card',
      duplicate_cluster_id: cluster?.id ?? asset.duplicate_cluster_id,
      is_canonical: !cluster || cluster.canonical_asset_id === asset.id,
    })
    if (config.launch.capabilities.mediaRetrievalV1) {
      const nonSearchableEmbedding = retrievalRecords.find((record) =>
        record.embedding_snapshot?.search_status !== 'searchable'
        || !record.embedding_snapshot?.is_active,
      )
      if (nonSearchableEmbedding) {
        const snapshot = nonSearchableEmbedding.embedding_snapshot
        throw new ValidationError(
          `media retrieval embedding is not searchable for document ${nonSearchableEmbedding.document.id}`
          + ` error_code=${snapshot?.error_code ?? 'missing_snapshot'}`,
        )
      }
    }

    await this.deps.mediaImportJobItemRepo.update(item.id, {
      status,
      duplicate_cluster_id: cluster?.id ?? asset.duplicate_cluster_id,
      resolved_asset_id: asset.id,
      result_summary_json: {
        retrieval_document_ids: retrievalRecords.map((record) => record.document.id),
        retrieval_doc_scopes: retrievalRecords.map((record) => record.document.doc_scope),
        embedding_snapshot_ids: retrievalRecords
          .map((record) => record.embedding_snapshot?.id ?? null)
          .filter((snapshotId): snapshotId is string => Boolean(snapshotId)),
        semantic_snapshot_id: snapshot.id,
      },
      finished_at: new Date(),
    })
  }

  private async resolveExactReusableAsset(
    item: MediaImportJobItem,
    request: MediaInjectionRequest,
  ): Promise<MediaAsset | null> {
    if (!this.deps.mediaDuplicateService || !item.declared_sha256) return null
    return this.deps.mediaDuplicateService.findReusableExactAsset({
      sha256: item.declared_sha256,
      source_kind: request.source_kind,
      target_scope: {
        owner_user_id: request.target_scope.owner_user_id,
        steward_agent_id: request.target_scope.steward_agent_id,
      },
    })
  }

  private async materializeAsset(
    item: MediaImportJobItem,
    request: MediaInjectionRequest,
  ): Promise<{
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    status: MediaImportJobItemStatus
  }> {
    switch (request.input_kind) {
      case 'local_file': {
        if (!item.staging_object_key) {
          throw new ValidationError(`media import item ${item.item_id} is missing staging_object_key`)
        }
        const staged = await this.deps.mediaImportArtifactService.readBuffer(item.staging_object_key)
        if (!staged) {
          throw new ValidationError(`staged object missing for media import item ${item.item_id}`)
        }
        if (request.source_kind === 'owner_private_pool') {
          if (!request.target_scope.owner_user_id || !request.target_scope.steward_agent_id) {
            throw new ValidationError(`owner private import ${item.item_id} requires owner and steward ids`)
          }
          await this.assertStewardAgentExists(request.target_scope.steward_agent_id)
          const record = await this.deps.mediaAssetService.ingestOwnerUpload({
            agent_id: request.target_scope.steward_agent_id,
            owner_user_id: request.target_scope.owner_user_id,
            owner_note: request.annotations.owner_note,
            mime_type: item.mime_type ?? staged.content_type,
            bytes: staged.data,
          })
          return {
            asset: record.asset,
            snapshot: record.snapshot!,
            status: 'created',
          }
        }
        await this.assertStewardAgentExists(request.target_scope.steward_agent_id)
        const managed = await this.deps.mediaAssetService.ingestManagedAsset({
          steward_agent_id: request.target_scope.steward_agent_id,
          owner_user_id: request.target_scope.owner_user_id,
          source_kind: resolveAssetSourceKind(request.source_kind, request.input_kind),
          mime_type: item.mime_type ?? staged.content_type,
          bytes: staged.data,
          visibility_policy: resolveVisibilityPolicy(request.source_kind),
          lifecycle_status: 'active',
        })
        return {
          asset: managed.asset,
          snapshot: managed.snapshot,
          status: 'created',
        }
      }
      case 'remote_url': {
        if (!item.origin_url) {
          throw new ValidationError(`media import item ${item.item_id} is missing origin_url`)
        }
        if (request.source_kind === 'owner_private_pool') {
          if (!request.target_scope.owner_user_id || !request.target_scope.steward_agent_id) {
            throw new ValidationError(`owner private import ${item.item_id} requires owner and steward ids`)
          }
          await this.assertStewardAgentExists(request.target_scope.steward_agent_id)
          const record = await this.deps.mediaAssetService.ingestOwnerUrl({
            agent_id: request.target_scope.steward_agent_id,
            owner_user_id: request.target_scope.owner_user_id,
            source_url: item.origin_url,
            owner_note: request.annotations.owner_note,
          })
          return {
            asset: record.asset,
            snapshot: record.snapshot!,
            status: 'created',
          }
        }
        await this.assertStewardAgentExists(request.target_scope.steward_agent_id)
        const managed = await this.deps.mediaAssetService.ingestManagedRemoteAsset({
          steward_agent_id: request.target_scope.steward_agent_id,
          owner_user_id: request.target_scope.owner_user_id,
          source_kind: resolveAssetSourceKind(request.source_kind, request.input_kind),
          source_url: item.origin_url,
          visibility_policy: resolveVisibilityPolicy(request.source_kind),
          lifecycle_status: 'active',
        })
        return {
          asset: managed.asset,
          snapshot: managed.snapshot,
          status: 'created',
        }
      }
      case 'existing_asset_ref': {
        if (!item.source_asset_id) {
          throw new ValidationError(`media import item ${item.item_id} is missing source_asset_id`)
        }
        const asset = await this.deps.mediaAssetRepo.findById(item.source_asset_id)
        if (!asset) throw new NotFoundError('MediaAsset', item.source_asset_id)
        const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
        if (!snapshot) throw new ValidationError(`media asset ${asset.id} is missing current semantic snapshot`)
        return { asset, snapshot, status: 'reused' }
      }
      case 'generated_artifact_ref': {
        if (!item.generated_job_id) {
          throw new ValidationError(`media import item ${item.item_id} is missing generated_job_id`)
        }
        const job = await this.deps.mediaGenerationJobRepo.findById(item.generated_job_id)
        if (!job?.output_asset_id) {
          throw new ValidationError(`generated job ${item.generated_job_id} has no output asset`)
        }
        const asset = await this.deps.mediaAssetRepo.findById(job.output_asset_id)
        if (!asset) throw new NotFoundError('MediaAsset', job.output_asset_id)
        const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
        if (!snapshot) throw new ValidationError(`generated asset ${asset.id} is missing semantic snapshot`)
        return { asset, snapshot, status: 'reused' }
      }
    }
  }

  private async assertStewardAgentExists(stewardAgentId: string | null): Promise<void> {
    if (!stewardAgentId || !this.deps.agentRepo) return
    const agent = await Promise.resolve(this.deps.agentRepo.findById(stewardAgentId))
    if (!agent) {
      throw new ValidationError(`steward agent ${stewardAgentId} does not exist`)
    }
  }

  private async registerAssetPool(
    sourceKind: VisualSourceKind,
    request: MediaInjectionRequest,
    asset: MediaAsset,
  ): Promise<void> {
    switch (sourceKind) {
      case 'community_commons':
        if (!request.target_scope.community_id) {
          throw new ValidationError(`community commons asset ${asset.id} is missing community_id`)
        }
        await this.deps.mediaReuseGovernanceService.registerCommunityCommonsAsset({
          community_id: request.target_scope.community_id,
          asset_id: asset.id,
          actor_user_id: request.target_scope.owner_user_id ?? request.target_scope.steward_agent_id ?? 'media-injection-worker',
        })
        break
      case 'platform_canonical':
        await this.deps.mediaReuseGovernanceService.registerPlatformCanonicalAsset({
          asset_id: asset.id,
          actor_user_id: request.target_scope.owner_user_id ?? request.target_scope.steward_agent_id ?? 'media-injection-worker',
        })
        break
      case 'generated_public':
        if (!request.target_scope.steward_agent_id) {
          throw new ValidationError(`generated public asset ${asset.id} is missing steward_agent_id`)
        }
        await this.deps.mediaReuseGovernanceService.registerGeneratedPublicAsset({
          asset_id: asset.id,
          agent_id: request.target_scope.steward_agent_id,
          actor_user_id: request.target_scope.steward_agent_id,
        })
        break
      case 'private_derived_public':
        if (!request.target_scope.steward_agent_id) {
          throw new ValidationError(`private derived asset ${asset.id} is missing steward_agent_id`)
        }
        await this.deps.mediaReuseGovernanceService.registerPrivateDerivedPublicAsset({
          asset_id: asset.id,
          agent_id: request.target_scope.steward_agent_id,
          actor_user_id: request.target_scope.steward_agent_id,
        })
        break
      case 'self_public_archive':
        if (!request.target_scope.steward_agent_id) {
          throw new ValidationError(`self public archive asset ${asset.id} is missing steward_agent_id`)
        }
        await this.deps.mediaReuseGovernanceService.registerSelfPublicArchiveAsset({
          asset_id: asset.id,
          agent_id: request.target_scope.steward_agent_id,
          actor_user_id: request.target_scope.steward_agent_id,
        })
        break
      default:
        break
    }
  }
}

function resolveRequestedDocScopes(request: MediaInjectionRequest) {
  const scopes = [request.indexing.primary_scope]
  if (
    request.indexing.public_safe_enabled
    && request.indexing.primary_scope !== 'public_safe'
    && request.source_kind !== 'owner_private_pool'
  ) {
    scopes.push('public_safe')
  }
  return Array.from(new Set(scopes))
}

function resolveAssetSourceKind(
  sourceKind: VisualSourceKind,
  inputKind: MediaInjectionRequest['input_kind'],
): MediaAsset['source_kind'] {
  switch (sourceKind) {
    case 'community_commons':
      return 'community_commons'
    case 'platform_canonical':
      return 'platform_canonical'
    case 'generated_public':
    case 'private_derived_public':
    case 'self_public_archive':
      return 'generated'
    case 'owner_private_pool':
    default:
      return inputKind === 'remote_url' ? 'url_import' : 'owner_console_upload'
  }
}

function resolveVisibilityPolicy(sourceKind: VisualSourceKind): MediaAsset['visibility_policy'] {
  return sourceKind === 'owner_private_pool' ? 'private_only' : 'public_original_allowed'
}

function isTerminalItemStatus(status: MediaImportJobItemStatus): boolean {
  return status === 'created'
    || status === 'reused'
    || status === 'suppressed'
    || status === 'failed'
    || status === 'cancelled'
}

function countItemStatuses(items: MediaImportJobItem[]) {
  return items.reduce((acc, item) => {
    if (isTerminalItemStatus(item.status)) {
      acc.processed += 1
    }
    if (item.status === 'created') acc.created += 1
    if (item.status === 'reused') acc.reused += 1
    if (item.status === 'suppressed') acc.suppressed += 1
    if (item.status === 'failed') acc.failed += 1
    return acc
  }, {
    processed: 0,
    created: 0,
    reused: 0,
    suppressed: 0,
    failed: 0,
  })
}

function resolveFinalJobStatus(counts: ReturnType<typeof countItemStatuses>): MediaImportJob['status'] {
  if (counts.failed === 0) return 'succeeded'
  if (counts.created + counts.reused + counts.suppressed > 0) return 'partial_succeeded'
  return 'failed'
}

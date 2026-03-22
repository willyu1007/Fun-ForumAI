import { createHash } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { LlmClient } from '../src/backend/llm/llm-client.js'
import { LLMGateway } from '../src/backend/llm/llm-gateway.js'
import { PromptEngine } from '../src/backend/llm/prompt-engine.js'
import { loadLlmRegistryBundle } from '../src/backend/llm/registry-loader.js'
import { SecretResolver } from '../src/backend/llm/secret-resolver.js'
import { CredentialBroker } from '../src/backend/llm/credential-broker.js'
import { UsageLedgerWriter, InMemoryUsageLedgerRepository } from '../src/backend/llm/usage-ledger.js'
import { createDefaultBudgetChecker } from '../src/backend/llm/default-budget-checker.js'
import { BudgetGuard } from '../src/backend/llm/budget-guard.js'
import { config } from '../src/backend/lib/config.js'
import { resolvePreferredMultimodalModelId } from '../src/backend/llm/model-preference.js'
import { getPrismaClient, disconnectPrisma } from '../src/backend/persistence/prisma-client.js'
import {
  MediaSemanticService,
  buildFallbackMediaSemanticSummary,
  buildRetrievalCaptionText,
  buildOwnerPrivatePoolSceneId,
  pickModelReachableMediaUrl,
  resolveMediaAssetUrl,
} from '../src/backend/media/index.js'
import { LocalStorageAdapter, S3StorageAdapter, type StorageAdapter } from '../src/backend/services/storage-adapter.js'

type LegacyAssetRow = Awaited<ReturnType<typeof loadLegacyAssets>>[number]

const MAX_FETCH_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

function parseArgs(argv: string[]) {
  const out: {
    agentId?: string
    limit?: number
    dryRun: boolean
    forceRefresh: boolean
  } = {
    dryRun: false,
    forceRefresh: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (token === '--force-refresh') {
      out.forceRefresh = true
      continue
    }
    if (token === '--agent-id') {
      out.agentId = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--limit') {
      out.limit = Number(argv[i + 1])
      i += 1
      continue
    }
  }

  return out
}

function createStorageAdapter(): StorageAdapter {
  return config.inclinationAssets.storageBackend === 's3' && config.inclinationAssets.s3.bucket
    ? new S3StorageAdapter({
        bucket: config.inclinationAssets.s3.bucket,
        region: config.inclinationAssets.s3.region,
        endpoint: config.inclinationAssets.s3.endpoint || undefined,
        forcePathStyle: config.inclinationAssets.s3.forcePathStyle,
        accessKeyId: config.inclinationAssets.s3.accessKeyId || undefined,
        secretAccessKey: config.inclinationAssets.s3.secretAccessKey || undefined,
        publicBaseUrl: config.inclinationAssets.publicBaseUrl || undefined,
      })
    : new LocalStorageAdapter({
        baseDir: config.inclinationAssets.localDir,
      })
}

function createMediaSemanticService() {
  const registryBundle = loadLlmRegistryBundle()
  const llmClient = new LlmClient({
    provider: {
      provider_id: config.llm.provider,
      base_url: config.llm.baseUrl,
      api_key: '',
      timeout_ms: config.llm.timeoutMs,
      max_retries: config.llm.maxRetries,
    },
    defaults: {
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    },
  })
  const promptEngine = new PromptEngine()
  const secretResolver = new SecretResolver()
  const credentialBroker = new CredentialBroker({
    bundle: registryBundle,
    secretResolver,
  })
  const usageLedgerRepo = new InMemoryUsageLedgerRepository()
  const usageLedger = new UsageLedgerWriter()
  usageLedger.setRepository(usageLedgerRepo)
  const budgetGuard = new BudgetGuard(createDefaultBudgetChecker(usageLedgerRepo))
  const llmGateway = new LLMGateway({
    bundle: registryBundle,
    promptEngine,
    llmClient,
    credentialBroker,
    usageLedger,
    budgetGuard,
  })

  return new MediaSemanticService({
    llmGateway,
    agentRepo: { findById: () => null } as never,
    agentConfigRepo: { findLatest: () => null } as never,
    eventRepo: { create: () => ({ id: 'noop' }) } as never,
    agentRunRepo: { create: () => ({ id: 'noop' }) } as never,
    preferredModelId: resolvePreferredMultimodalModelId(config.llm.model),
  })
}

async function loadLegacyAssets(input: { agentId?: string; limit?: number }) {
  const prisma = getPrismaClient()
  return prisma.agentInclinationAsset.findMany({
    where: input.agentId ? { agentId: input.agentId } : undefined,
    orderBy: [{ createdAt: 'asc' }],
    ...(input.limit ? { take: input.limit } : {}),
  })
}

function mapLegacyStatus(status: LegacyAssetRow['status']) {
  if (status === 'CANCELLED' || status === 'REPLACED') {
    return {
      visibility_policy: 'private_only' as const,
      lifecycle_status: 'archived' as const,
    }
  }
  if (status === 'FAILED') {
    return {
      visibility_policy: 'blocked' as const,
      lifecycle_status: 'blocked' as const,
    }
  }
  return {
    visibility_policy: 'private_only' as const,
    lifecycle_status: 'active' as const,
  }
}

function mapSourceKind(sourceType: LegacyAssetRow['sourceType']) {
  return sourceType === 'UPLOAD' ? 'owner_console_upload' as const : 'url_import' as const
}

function buildLegacyPartialSummary(
  legacySummary: unknown,
  mimeType: string,
) {
  const fallback = buildFallbackMediaSemanticSummary(mimeType, 'legacy')
  if (!legacySummary || typeof legacySummary !== 'object' || Array.isArray(legacySummary)) {
    return fallback
  }
  const record = legacySummary as Record<string, unknown>
  const discussionPoints = Array.isArray(record.discussion_points)
    ? record.discussion_points.filter((item): item is string => typeof item === 'string').slice(0, 6)
    : fallback.discussion_points

  const theme = typeof record.theme === 'string' && record.theme.trim() ? record.theme.trim() : fallback.theme
  const scene = typeof record.scene === 'string' && record.scene.trim() ? record.scene.trim() : fallback.scene
  const mood = typeof record.mood === 'string' && record.mood.trim() ? record.mood.trim() : fallback.mood
  const publicSafeSummary = `${theme}. ${scene}. ${mood}.`

  return {
    theme,
    scene,
    mood,
    discussion_points: discussionPoints,
    salient_entities: [],
    ocr_snippets: [],
    safety_labels: [],
    public_safe_summary: publicSafeSummary.slice(0, 400),
    internal_full_summary: publicSafeSummary.slice(0, 400),
  }
}

function readImageDimensions(mimeType: string, bytes: Buffer): { width: number | null; height: number | null } {
  try {
    if (mimeType === 'image/png' && bytes.length >= 24) {
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    }
    if (mimeType === 'image/gif' && bytes.length >= 10) {
      return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }
    }
    if ((mimeType === 'image/jpeg' || mimeType === 'image/jpg') && bytes.length >= 4) {
      let offset = 2
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1
          continue
        }
        const marker = bytes[offset + 1]
        const length = bytes.readUInt16BE(offset + 2)
        const isSofMarker = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
        if (isSofMarker && offset + 8 < bytes.length) {
          return {
            height: bytes.readUInt16BE(offset + 5),
            width: bytes.readUInt16BE(offset + 7),
          }
        }
        offset += 2 + length
      }
    }
  } catch {
    return { width: null, height: null }
  }
  return { width: null, height: null }
}

async function fetchRemoteBytes(originUrl: string): Promise<Buffer | null> {
  if (!originUrl.startsWith('https://')) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(originUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!response.ok) return null
    const sizeHeader = Number(response.headers.get('content-length') ?? '0')
    if (Number.isFinite(sizeHeader) && sizeHeader > MAX_FETCH_BYTES) {
      return null
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FETCH_BYTES) return null
    return bytes
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function loadBytesForLegacyAsset(
  legacy: LegacyAssetRow,
  storage: StorageAdapter,
): Promise<Buffer | null> {
  if (legacy.storageKey) {
    const stored = await storage.getObject(legacy.storageKey)
    if (stored?.data?.byteLength) {
      return stored.data
    }
  }
  if (legacy.originUrl) {
    return fetchRemoteBytes(legacy.originUrl)
  }
  return null
}

async function ensureBinding(input: {
  assetId: string
  semanticSnapshotId: string
  sceneType: 'memory_card' | 'forum_post'
  sceneId: string
  sourceSceneType?: string | null
  sourceSceneId?: string | null
  bindingRole: 'memory' | 'primary'
  relationToScene: 'uploaded_by_owner' | 'selected_for_post'
  bindingNoteText?: string | null
  displayPolicy: 'runtime_only_no_display' | 'original_allowed'
  createdByType: 'owner' | 'system'
  createdById: string
  dryRun: boolean
}) {
  const prisma = getPrismaClient()
  const existing = await prisma.sceneMediaBinding.findFirst({
    where: {
      assetId: input.assetId,
      sceneType: input.sceneType,
      sceneId: input.sceneId,
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  if (existing) {
    if (!input.dryRun) {
      await prisma.sceneMediaBinding.update({
        where: { id: existing.id },
        data: {
          semanticSnapshotId: input.semanticSnapshotId,
          sourceSceneType: input.sourceSceneType ?? null,
          sourceSceneId: input.sourceSceneId ?? null,
          bindingRole: input.bindingRole,
          relationToScene: input.relationToScene,
          bindingNoteText: input.bindingNoteText ?? null,
          displayPolicy: input.displayPolicy,
          createdByType: input.createdByType,
          createdById: input.createdById,
        },
      })
    }
    return existing.id
  }

  if (input.dryRun) {
    return `dry-run:${input.sceneType}:${input.sceneId}:${input.assetId}`
  }

  const created = await prisma.sceneMediaBinding.create({
    data: {
      sceneType: input.sceneType,
      sceneId: input.sceneId,
      assetId: input.assetId,
      semanticSnapshotId: input.semanticSnapshotId,
      sourceSceneType: input.sourceSceneType ?? null,
      sourceSceneId: input.sourceSceneId ?? null,
      bindingRole: input.bindingRole,
      relationToScene: input.relationToScene,
      bindingNoteText: input.bindingNoteText ?? null,
      displayPolicy: input.displayPolicy,
      createdByType: input.createdByType,
      createdById: input.createdById,
    },
  })
  return created.id
}

async function ensureProjection(input: {
  bindingId: string
  projectionSurface: 'retrieval' | 'public_display'
  projectionKind: 'retrieval_caption' | 'display_attachment'
  schemaVersion: string
  payloadJson: Record<string, unknown>
  tokenEstimate?: number | null
  promptWeight?: string | null
  mentionPolicy?: string | null
  preferredDisplayVariant?: string | null
  dryRun: boolean
}) {
  const prisma = getPrismaClient()
  const existing = await prisma.mediaContextProjection.findFirst({
    where: {
      bindingId: input.bindingId,
      projectionSurface: input.projectionSurface,
      projectionKind: input.projectionKind,
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  if (existing) {
    if (!input.dryRun) {
      await prisma.mediaContextProjection.update({
        where: { id: existing.id },
        data: {
          schemaVersion: input.schemaVersion,
          payloadJson: input.payloadJson,
          tokenEstimate: input.tokenEstimate ?? null,
          promptWeight: input.promptWeight ?? null,
          mentionPolicy: input.mentionPolicy ?? null,
          preferredDisplayVariant: input.preferredDisplayVariant ?? null,
        },
      })
    }
    return
  }

  if (input.dryRun) return

  await prisma.mediaContextProjection.create({
    data: {
      bindingId: input.bindingId,
      projectionSurface: input.projectionSurface,
      projectionKind: input.projectionKind,
      schemaVersion: input.schemaVersion,
      payloadJson: input.payloadJson,
      tokenEstimate: input.tokenEstimate ?? null,
      promptWeight: input.promptWeight ?? null,
      mentionPolicy: input.mentionPolicy ?? null,
      preferredDisplayVariant: input.preferredDisplayVariant ?? null,
    },
  })
}

async function backfillOne(input: {
  legacy: LegacyAssetRow
  storage: StorageAdapter
  semanticService: MediaSemanticService
  dryRun: boolean
  forceRefresh: boolean
}) {
  const prisma = getPrismaClient()
  const { legacy, storage, semanticService, dryRun, forceRefresh } = input
  const mapped = mapLegacyStatus(legacy.status)
  const postMediaRows = await prisma.postMedia.findMany({
    where: { assetId: legacy.id },
    orderBy: [{ createdAt: 'asc' }],
  })

  const bytes = await loadBytesForLegacyAsset(legacy, storage)
  const dimensions = bytes ? readImageDimensions(legacy.mimeType, bytes) : { width: null, height: null }
  const sha256 = bytes
    ? createHash('sha256').update(bytes).digest('hex')
    : `legacy-pending:${legacy.id}`

  const mediaAssetData = {
    stewardAgentId: legacy.agentId,
    ownerUserId: legacy.ownerUserId,
    sourceKind: mapSourceKind(legacy.sourceType),
    visibilityPolicy: legacy.consumedPostId || postMediaRows.length > 0
      ? 'public_original_allowed'
      : mapped.visibility_policy,
    lifecycleStatus: mapped.lifecycle_status,
    storageKey: legacy.storageKey,
    originUrl: legacy.originUrl,
    mimeType: legacy.mimeType,
    fileSizeBytes: legacy.fileSizeBytes,
    width: dimensions.width,
    height: dimensions.height,
    sha256,
    phash: null,
    createdAt: legacy.createdAt,
    updatedAt: new Date(),
  }

  const mediaAsset = dryRun
    ? { id: legacy.id, ...mediaAssetData }
    : await prisma.mediaAsset.upsert({
        where: { id: legacy.id },
        update: mediaAssetData,
        create: {
          id: legacy.id,
          ...mediaAssetData,
        },
      })

  let currentSnapshot = await prisma.mediaSemanticSnapshot.findFirst({
    where: { assetId: legacy.id, isCurrent: true },
    orderBy: [{ createdAt: 'desc' }],
  })

  if (
    !currentSnapshot
    || forceRefresh
    || currentSnapshot.snapshotKind === 'legacy_imported_partial'
    || currentSnapshot.extractionStatus !== 'completed'
    || currentSnapshot.qualityGrade !== 'rich'
  ) {
    const mediaUrl = resolveMediaAssetUrl({
      storage_key: mediaAsset.storageKey ?? null,
      origin_url: mediaAsset.originUrl ?? null,
    }, storage)
    const semanticSourceUrl = pickModelReachableMediaUrl(mediaUrl, legacy.originUrl)

    const semantic = bytes || semanticSourceUrl
      ? await semanticService.extract({
          mimeType: legacy.mimeType,
          sourceUrl: semanticSourceUrl,
          uploadBuffer: bytes,
        })
      : null

    const snapshotPayload = semantic
      ? {
          snapshotKind: 'visual_core' as const,
          schemaVersion: semantic.schema_version,
          modelProvider: semantic.model_provider,
          modelName: semantic.model_name,
          modelVersion: semantic.model_version,
          summaryJson: semantic.summary,
          extractionStatus: semantic.extraction_status,
          qualityGrade: semantic.quality_grade,
        }
      : {
          snapshotKind: 'legacy_imported_partial' as const,
          schemaVersion: 'media_semantic_summary.v1',
          modelProvider: 'legacy-import',
          modelName: 'agent_inclination_assets',
          modelVersion: 'legacy-v1',
          summaryJson: buildLegacyPartialSummary(legacy.visionSummaryJson, legacy.mimeType),
          extractionStatus: 'fallback' as const,
          qualityGrade: 'legacy_imported_partial' as const,
        }

    if (!dryRun) {
      await prisma.mediaSemanticSnapshot.updateMany({
        where: { assetId: legacy.id, isCurrent: true },
        data: { isCurrent: false },
      })
      currentSnapshot = await prisma.mediaSemanticSnapshot.create({
        data: {
          assetId: legacy.id,
          snapshotKind: snapshotPayload.snapshotKind,
          schemaVersion: snapshotPayload.schemaVersion,
          modelProvider: snapshotPayload.modelProvider,
          modelName: snapshotPayload.modelName,
          modelVersion: snapshotPayload.modelVersion,
          summaryJson: snapshotPayload.summaryJson,
          extractionStatus: snapshotPayload.extractionStatus,
          qualityGrade: snapshotPayload.qualityGrade,
          isCurrent: true,
        },
      })
    }
  }

  const effectiveSnapshot = currentSnapshot ?? {
    id: `dry-run:${legacy.id}`,
    summaryJson: buildLegacyPartialSummary(legacy.visionSummaryJson, legacy.mimeType),
  }
  const effectiveSummary = (effectiveSnapshot.summaryJson ?? buildLegacyPartialSummary(legacy.visionSummaryJson, legacy.mimeType)) as Record<string, unknown>
  const mediaUrl = resolveMediaAssetUrl({
    storage_key: mediaAsset.storageKey ?? null,
    origin_url: mediaAsset.originUrl ?? null,
  }, storage)

  const ownerBindingId = await ensureBinding({
    assetId: legacy.id,
    semanticSnapshotId: effectiveSnapshot.id,
    sceneType: 'memory_card',
    sceneId: buildOwnerPrivatePoolSceneId(legacy.agentId),
    bindingRole: 'memory',
    relationToScene: 'uploaded_by_owner',
    bindingNoteText: legacy.ownerNote,
    displayPolicy: 'runtime_only_no_display',
    createdByType: 'owner',
    createdById: legacy.ownerUserId,
    dryRun,
  })

  if (mediaUrl) {
    const retrievalText = buildRetrievalCaptionText({
      summary: {
        theme: String(effectiveSummary.theme ?? ''),
        scene: String(effectiveSummary.scene ?? ''),
        mood: String(effectiveSummary.mood ?? ''),
        discussion_points: Array.isArray(effectiveSummary.discussion_points)
          ? effectiveSummary.discussion_points.filter((item): item is string => typeof item === 'string')
          : [],
        salient_entities: Array.isArray(effectiveSummary.salient_entities)
          ? effectiveSummary.salient_entities.filter((item): item is string => typeof item === 'string')
          : [],
        ocr_snippets: Array.isArray(effectiveSummary.ocr_snippets)
          ? effectiveSummary.ocr_snippets.filter((item): item is string => typeof item === 'string')
          : [],
        safety_labels: Array.isArray(effectiveSummary.safety_labels)
          ? effectiveSummary.safety_labels.filter((item): item is string => typeof item === 'string')
          : [],
        public_safe_summary: String(effectiveSummary.public_safe_summary ?? ''),
        internal_full_summary: String(effectiveSummary.internal_full_summary ?? ''),
      },
      ownerNote: legacy.ownerNote,
    })

    await ensureProjection({
      bindingId: ownerBindingId,
      projectionSurface: 'retrieval',
      projectionKind: 'retrieval_caption',
      schemaVersion: 'retrieval_caption.v1',
      payloadJson: {
        asset_id: legacy.id,
        media_url: mediaUrl,
        mime_type: legacy.mimeType,
        caption_text: retrievalText,
        summary: effectiveSummary,
        owner_note: legacy.ownerNote,
      },
      tokenEstimate: Math.max(1, Math.ceil(retrievalText.length / 4)),
      promptWeight: 'primary',
      mentionPolicy: 'owner_private_pool_only',
      dryRun,
    })
  }

  const consumedPostIds = new Set<string>()
  if (legacy.consumedPostId) consumedPostIds.add(legacy.consumedPostId)
  for (const row of postMediaRows) {
    consumedPostIds.add(row.postId)
  }

  for (const postId of consumedPostIds) {
    const postBindingId = await ensureBinding({
      assetId: legacy.id,
      semanticSnapshotId: effectiveSnapshot.id,
      sceneType: 'forum_post',
      sceneId: postId,
      sourceSceneType: 'memory_card',
      sourceSceneId: buildOwnerPrivatePoolSceneId(legacy.agentId),
      bindingRole: 'primary',
      relationToScene: 'selected_for_post',
      bindingNoteText: legacy.ownerNote,
      displayPolicy: 'original_allowed',
      createdByType: 'system',
      createdById: 't118-backfill',
      dryRun,
    })

    const displayUrl = postMediaRows.find((row) => row.postId === postId)?.mediaUrl ?? mediaUrl
    if (!displayUrl) continue

    await ensureProjection({
      bindingId: postBindingId,
      projectionSurface: 'public_display',
      projectionKind: 'display_attachment',
      schemaVersion: 'display_attachment.v1',
      payloadJson: {
        asset_id: legacy.id,
        media_url: displayUrl,
        mime_type: legacy.mimeType,
        width: mediaAsset.width ?? null,
        height: mediaAsset.height ?? null,
        alt_text: String(effectiveSummary.public_safe_summary ?? ''),
      },
      preferredDisplayVariant: 'original',
      tokenEstimate: Math.max(1, Math.ceil(String(effectiveSummary.public_safe_summary ?? '').length / 4)),
      dryRun,
    })
  }

  return {
    asset_id: legacy.id,
    lifecycle_status: mediaAsset.lifecycleStatus,
    snapshot_kind: currentSnapshot?.snapshotKind ?? 'legacy_imported_partial',
    consumed_post_count: consumedPostIds.size,
    had_bytes: Boolean(bytes),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const storage = createStorageAdapter()
  const semanticService = createMediaSemanticService()
  const legacyAssets = await loadLegacyAssets({
    agentId: args.agentId,
    limit: args.limit,
  })

  const results: Array<Record<string, unknown>> = []
  for (const legacy of legacyAssets) {
    results.push(await backfillOne({
      legacy,
      storage,
      semanticService,
      dryRun: args.dryRun,
      forceRefresh: args.forceRefresh,
    }))
    await sleep(25)
  }

  console.log(JSON.stringify({
    dry_run: args.dryRun,
    force_refresh: args.forceRefresh,
    processed: results.length,
    results,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[t118-media-domain-backfill] FAILED')
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectPrisma().catch(() => undefined)
  })

import { disconnectPrisma, getPrismaClient } from '../src/backend/persistence/prisma-client.js'
import { PgMediaAssetRepository } from '../src/backend/repos/pg/pg-media-asset-repository.js'
import { PgMediaSemanticSnapshotRepository } from '../src/backend/repos/pg/pg-media-semantic-snapshot-repository.js'
import { PgSceneMediaBindingRepository } from '../src/backend/repos/pg/pg-scene-media-binding-repository.js'
import { PgMediaContextProjectionRepository } from '../src/backend/repos/pg/pg-media-context-projection-repository.js'
import { PgMediaReusePolicyRepository } from '../src/backend/repos/pg/pg-media-reuse-policy-repository.js'
import { PgMediaGenerationJobRepository } from '../src/backend/repos/pg/pg-media-generation-job-repository.js'
import { PgImagePlanRepository } from '../src/backend/repos/pg/pg-image-plan-repository.js'
import { MediaBindingService } from '../src/backend/media/media-binding-service.js'
import { MediaProjectionService } from '../src/backend/media/media-projection-service.js'
import { MediaReuseGovernanceService } from '../src/backend/media/media-reuse-governance-service.js'
import type { SceneMediaBinding, VisualSourceKind } from '../src/backend/repos/types.js'

interface ParsedArgs {
  dryRun: boolean
  agentId: string | null
  limit: number | null
}

interface BackfillStats {
  owner_private_pool_policies_created: number
  forum_post_policies_created: number
  private_handoff_projections_created: number
  private_projection_policies_created: number
  scanned_bindings: number
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    dryRun: false,
    agentId: null,
    limit: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dry-run') {
      parsed.dryRun = true
      continue
    }
    if (token === '--agent-id') {
      parsed.agentId = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (token === '--limit') {
      const value = Number(argv[index + 1] ?? '')
      parsed.limit = Number.isFinite(value) && value > 0 ? value : null
      index += 1
    }
  }

  return parsed
}

function logAction(message: string, meta: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({
    message,
    ...meta,
  }))
}

function reachedLimit(stats: BackfillStats, limit: number | null): boolean {
  return limit !== null && stats.scanned_bindings >= limit
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const prisma = getPrismaClient()
  const mediaAssetRepo = new PgMediaAssetRepository(prisma)
  const mediaSemanticSnapshotRepo = new PgMediaSemanticSnapshotRepository(prisma)
  const sceneMediaBindingRepo = new PgSceneMediaBindingRepository(prisma)
  const mediaContextProjectionRepo = new PgMediaContextProjectionRepository(prisma)
  const mediaReusePolicyRepo = new PgMediaReusePolicyRepository(prisma)
  const mediaGenerationJobRepo = new PgMediaGenerationJobRepository(prisma)
  const imagePlanRepo = new PgImagePlanRepository(prisma)
  const mediaBindingService = new MediaBindingService({
    sceneMediaBindingRepo,
  })
  const mediaProjectionService = new MediaProjectionService({
    mediaContextProjectionRepo,
  })
  const mediaReuseGovernanceService = new MediaReuseGovernanceService({
    mediaAssetRepo,
    mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    mediaReusePolicyRepo,
    mediaGenerationJobRepo,
    imagePlanRepo,
    mediaBindingService,
  })
  const stats: BackfillStats = {
    owner_private_pool_policies_created: 0,
    forum_post_policies_created: 0,
    private_handoff_projections_created: 0,
    private_projection_policies_created: 0,
    scanned_bindings: 0,
  }

  const ensureAssetPolicyIfMissing = async (input: {
    assetId: string
    sourceKind: VisualSourceKind
    communityId?: string | null
    allowQuoteOriginal?: boolean
  }): Promise<boolean> => {
    const existing = await mediaReusePolicyRepo.findBySubject('asset', input.assetId, input.sourceKind)
    if (existing) return false
    const asset = await mediaAssetRepo.findById(input.assetId)
    if (!asset) return false
    if (args.dryRun) return true
    await mediaReuseGovernanceService.ensureAssetPolicy({
      source_kind: input.sourceKind,
      asset,
      community_id: input.communityId ?? null,
      allow_quote_original: input.allowQuoteOriginal,
    })
    return true
  }

  const ensureProjectionPolicyIfMissing = async (input: {
    projectionId: string
    stewardAgentId?: string | null
  }): Promise<boolean> => {
    const existing = await mediaReusePolicyRepo.findBySubject(
      'projection',
      input.projectionId,
      'private_runtime_projection',
    )
    if (existing) return false
    const projection = await mediaContextProjectionRepo.findById(input.projectionId)
    if (!projection) return false
    if (args.dryRun) return true
    await mediaReuseGovernanceService.ensureProjectionPolicy({
      source_kind: 'private_runtime_projection',
      projection,
      steward_agent_id: input.stewardAgentId ?? null,
    })
    return true
  }

  const ownerPoolBindings = await prisma.sceneMediaBinding.findMany({
    where: {
      sceneType: 'memory_card',
      sceneId: { startsWith: 'owner_private_pool:' },
      ...(args.agentId
        ? {
            asset: {
              stewardAgentId: args.agentId,
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: 'asc' }],
  })
  const ownerAssetIds = Array.from(new Set(ownerPoolBindings.map((binding) => binding.assetId)))
  for (const assetId of ownerAssetIds) {
    if (reachedLimit(stats, args.limit)) break
    const created = await ensureAssetPolicyIfMissing({
      assetId,
      sourceKind: 'owner_private_pool',
    })
    stats.scanned_bindings += 1
    if (created) {
      stats.owner_private_pool_policies_created += 1
      logAction('owner_private_pool policy backfilled', {
        asset_id: assetId,
        dry_run: args.dryRun,
      })
    }
  }

  const forumBindings = await prisma.sceneMediaBinding.findMany({
    where: {
      sceneType: 'forum_post',
      NOT: {
        displayPolicy: 'runtime_only_no_display',
      },
      ...(args.agentId
        ? {
            asset: {
              stewardAgentId: args.agentId,
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: 'asc' }],
  })
  const forumAssetIds = Array.from(new Set(forumBindings.map((binding) => binding.assetId)))
  for (const assetId of forumAssetIds) {
    if (reachedLimit(stats, args.limit)) break
    const archiveCreated = await ensureAssetPolicyIfMissing({
      assetId,
      sourceKind: 'self_public_archive',
    })
    const episodeCreated = await ensureAssetPolicyIfMissing({
      assetId,
      sourceKind: 'same_episode_public',
    })
    stats.scanned_bindings += 1
    if (archiveCreated) {
      stats.forum_post_policies_created += 1
      logAction('self_public_archive policy backfilled', {
        asset_id: assetId,
        dry_run: args.dryRun,
      })
    }
    if (episodeCreated) {
      stats.forum_post_policies_created += 1
      logAction('same_episode_public policy backfilled', {
        asset_id: assetId,
        dry_run: args.dryRun,
      })
    }
  }

  const privateBindings = await prisma.sceneMediaBinding.findMany({
    where: {
      sceneType: 'private_message',
      ...(args.agentId
        ? {
            asset: {
              stewardAgentId: args.agentId,
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: 'asc' }],
  })
  for (const row of privateBindings) {
    if (reachedLimit(stats, args.limit)) break
    stats.scanned_bindings += 1

    const binding = (await sceneMediaBindingRepo.findByScene('private_message', row.sceneId))
      .find((item) => item.id === row.id) as SceneMediaBinding | undefined
    if (!binding) continue

    const asset = await mediaAssetRepo.findById(binding.asset_id)
    const snapshot = await mediaSemanticSnapshotRepo.findCurrentByAssetId(binding.asset_id)
    if (!asset || !snapshot) continue

    const projections = await mediaContextProjectionRepo.findByBindingId(binding.id)
    const existingHandoff = projections.find((projection) =>
      projection.projection_surface === 'planner'
      && projection.projection_kind === 'public_reuse_handoff',
    ) ?? null
    const handoffProjection = existingHandoff ?? (args.dryRun
      ? null
      : (await mediaProjectionService.createPublicReuseHandoffProjection({
          binding,
          asset,
          snapshot,
          source_kind: asset.source_kind,
          why_relevant_hint: '历史私聊图片补齐 public-safe handoff，供 planner 安全复用。',
          allowed_reuse_modes: ['derive_new', 'reference_only'],
          disclose_origin_policy: 'never',
        })).projection)

    if (!existingHandoff) {
      stats.private_handoff_projections_created += 1
      logAction('private public_reuse_handoff backfilled', {
        binding_id: binding.id,
        asset_id: asset.id,
        dry_run: args.dryRun,
      })
    }

    if (existingHandoff || handoffProjection) {
      const policyCreated = await ensureProjectionPolicyIfMissing({
        projectionId: (existingHandoff ?? handoffProjection)!.id,
        stewardAgentId: asset.steward_agent_id,
      })
      if (policyCreated) {
        stats.private_projection_policies_created += 1
        logAction('private_runtime_projection policy backfilled', {
          projection_id: (existingHandoff ?? handoffProjection)!.id,
          asset_id: asset.id,
          dry_run: args.dryRun,
        })
      }
    }
  }

  console.log(JSON.stringify({
    message: 't121 media governance backfill complete',
    dry_run: args.dryRun,
    agent_id: args.agentId,
    limit: args.limit,
    stats,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectPrisma()
  })

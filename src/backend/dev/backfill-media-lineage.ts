import {
  buildLegacyGenerationSpec,
  compileMediaGenerationSpec,
} from '../media/media-generation-compiler.js'
import { MediaLineageService } from '../media/media-lineage-service.js'
import { disconnectPrisma, getPrismaClient } from '../persistence/prisma-client.js'
import { PgMediaLineageEdgeRepository } from '../repos/pg/pg-media-lineage-edge-repository.js'
import type {
  CreateMediaLineageEdgeInput,
  MediaGenerationJob,
  MediaLineageNodeType,
} from '../repos/types.js'

type BindingRow = {
  id: string
  assetId: string
  semanticSnapshotId: string
  sceneType: string
  sceneId: string
  sourceSceneType: string | null
  sourceSceneId: string | null
  createdAt: Date
}

type SnapshotRow = {
  id: string
  assetId: string
  schemaVersion: string
}

interface BackfillSummary {
  prepared_edges: number
  inserted_edges: number
  skipped_existing_edges: number
  orphaned_marks: number
  generation_jobs_updated: number
}

function parseNumberFlag(flag: string, fallback: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  if (!raw) return fallback
  const parsed = Number.parseInt(raw.slice(flag.length + 1), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function edgeKey(input: {
  from_node_type: MediaLineageNodeType
  from_node_id: string
  edge_kind: string
  to_node_type: MediaLineageNodeType
  to_node_id: string
}): string {
  return [
    input.from_node_type,
    input.from_node_id,
    input.edge_kind,
    input.to_node_type,
    input.to_node_id,
  ].join('|')
}

function isStoredGenerationSpec(value: unknown): value is MediaGenerationJob['generation_spec'] {
  return isRecord(value) && typeof value.intent === 'string'
}

function isStoredCompiledPrompt(value: unknown): value is MediaGenerationJob['compiled_prompt'] {
  return isRecord(value) && typeof value.rendered_prompt === 'string'
}

function bindingSceneKey(sceneType: string, sceneId: string): string {
  return `${sceneType}|${sceneId}`
}

function resolveSourceBinding(
  binding: BindingRow,
  bindingsByScene: Map<string, BindingRow[]>,
): BindingRow | null {
  if (!binding.sourceSceneType || !binding.sourceSceneId) return null
  const candidates = bindingsByScene.get(bindingSceneKey(binding.sourceSceneType, binding.sourceSceneId)) ?? []
  if (candidates.length === 1) return candidates[0] ?? null
  const sameAssetCandidates = candidates.filter((candidate) => candidate.assetId === binding.assetId)
  if (sameAssetCandidates.length === 1) return sameAssetCandidates[0] ?? null
  return null
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const batchSize = parseNumberFlag('--batch-size', 200)
  const prisma = getPrismaClient()
  const mediaLineageService = new MediaLineageService({
    mediaLineageEdgeRepo: new PgMediaLineageEdgeRepository(prisma),
  })
  const summary: BackfillSummary = {
    prepared_edges: 0,
    inserted_edges: 0,
    skipped_existing_edges: 0,
    orphaned_marks: 0,
    generation_jobs_updated: 0,
  }

  const existingEdgeKeys = new Set(
    (
      await prisma.mediaLineageEdge.findMany({
        select: {
          fromNodeType: true,
          fromNodeId: true,
          edgeKind: true,
          toNodeType: true,
          toNodeId: true,
        },
      })
    ).map((row) =>
      edgeKey({
        from_node_type: row.fromNodeType as MediaLineageNodeType,
        from_node_id: row.fromNodeId,
        edge_kind: row.edgeKind,
        to_node_type: row.toNodeType as MediaLineageNodeType,
        to_node_id: row.toNodeId,
      })),
  )

  const pending: CreateMediaLineageEdgeInput[] = []
  const enqueueEdge = (input: CreateMediaLineageEdgeInput) => {
    const key = edgeKey(input)
    if (existingEdgeKeys.has(key)) {
      summary.skipped_existing_edges += 1
      return
    }
    existingEdgeKeys.add(key)
    pending.push(input)
    summary.prepared_edges += 1
    if (input.edge_kind === 'orphaned_lineage') {
      summary.orphaned_marks += 1
    }
  }
  const flushEdges = async () => {
    if (pending.length === 0) return
    const chunks: CreateMediaLineageEdgeInput[][] = []
    for (let index = 0; index < pending.length; index += batchSize) {
      chunks.push(pending.slice(index, index + batchSize))
    }
    pending.length = 0
    if (dryRun) return
    for (const chunk of chunks) {
      const inserted = await mediaLineageService.recordEdges(chunk)
      summary.inserted_edges += inserted.length
    }
  }
  const markOrphaned = (
    nodeType: MediaLineageNodeType,
    nodeId: string,
    reason: string,
    metadata: Record<string, unknown> = {},
  ) => {
    enqueueEdge({
      from_node_type: nodeType,
      from_node_id: nodeId,
      to_node_type: nodeType,
      to_node_id: nodeId,
      edge_kind: 'orphaned_lineage',
      metadata_json: {
        reason,
        ...metadata,
      },
    })
  }

  const snapshots = await prisma.mediaSemanticSnapshot.findMany({
    select: {
      id: true,
      assetId: true,
      schemaVersion: true,
    },
  })
  const snapshotsByAssetId = new Map<string, SnapshotRow[]>()
  for (const snapshot of snapshots) {
    const bucket = snapshotsByAssetId.get(snapshot.assetId) ?? []
    bucket.push(snapshot)
    snapshotsByAssetId.set(snapshot.assetId, bucket)
    enqueueEdge({
      from_node_type: 'asset',
      from_node_id: snapshot.assetId,
      to_node_type: 'semantic_snapshot',
      to_node_id: snapshot.id,
      edge_kind: 'asset_described_by_snapshot',
      metadata_json: {
        schema_version: snapshot.schemaVersion,
      },
    })
  }
  await flushEdges()

  const bindings = await prisma.sceneMediaBinding.findMany({
    select: {
      id: true,
      assetId: true,
      semanticSnapshotId: true,
      sceneType: true,
      sceneId: true,
      sourceSceneType: true,
      sourceSceneId: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }],
  })
  const bindingsByScene = new Map<string, BindingRow[]>()
  for (const binding of bindings) {
    const key = bindingSceneKey(binding.sceneType, binding.sceneId)
    const bucket = bindingsByScene.get(key) ?? []
    bucket.push(binding)
    bindingsByScene.set(key, bucket)
  }
  for (const binding of bindings) {
    enqueueEdge({
      from_node_type: 'asset',
      from_node_id: binding.assetId,
      to_node_type: 'binding',
      to_node_id: binding.id,
      edge_kind: 'asset_bound_to_scene',
      metadata_json: {
        scene_type: binding.sceneType,
        scene_id: binding.sceneId,
      },
    })
    enqueueEdge({
      from_node_type: 'semantic_snapshot',
      from_node_id: binding.semanticSnapshotId,
      to_node_type: 'binding',
      to_node_id: binding.id,
      edge_kind: 'snapshot_bound_to_scene',
      metadata_json: {
        scene_type: binding.sceneType,
        scene_id: binding.sceneId,
      },
    })
    if (binding.sourceSceneType && binding.sourceSceneId) {
      const sourceBinding = resolveSourceBinding(binding, bindingsByScene)
      if (sourceBinding) {
        enqueueEdge({
          from_node_type: 'binding',
          from_node_id: sourceBinding.id,
          to_node_type: 'binding',
          to_node_id: binding.id,
          edge_kind: 'binding_derived_binding',
          metadata_json: {
            source_scene_type: binding.sourceSceneType,
            source_scene_id: binding.sourceSceneId,
          },
        })
      } else {
        markOrphaned('binding', binding.id, 'unresolved_source_binding', {
          source_scene_type: binding.sourceSceneType,
          source_scene_id: binding.sourceSceneId,
        })
      }
    }
  }
  await flushEdges()

  const projections = await prisma.mediaContextProjection.findMany({
    select: {
      id: true,
      bindingId: true,
      projectionSurface: true,
      projectionKind: true,
    },
  })
  for (const projection of projections) {
    enqueueEdge({
      from_node_type: 'binding',
      from_node_id: projection.bindingId,
      to_node_type: 'projection',
      to_node_id: projection.id,
      edge_kind: 'binding_projected',
      metadata_json: {
        projection_surface: projection.projectionSurface,
        projection_kind: projection.projectionKind,
      },
    })
  }
  await flushEdges()

  const postMediaRows = await prisma.postMedia.findMany({
    select: {
      id: true,
      assetId: true,
      postId: true,
    },
  })
  for (const row of postMediaRows) {
    enqueueEdge({
      from_node_type: 'asset',
      from_node_id: row.assetId,
      to_node_type: 'post_media_attachment',
      to_node_id: row.id,
      edge_kind: 'asset_attached_to_post_media',
      metadata_json: {
        post_id: row.postId,
      },
    })
  }
  await flushEdges()

  const imagePlans = await prisma.imagePlanRecord.findMany({
    select: {
      id: true,
      selectedSources: true,
      generation: true,
      sceneRef: true,
    },
  })
  for (const plan of imagePlans) {
    let linkedSourceCount = 0
    const selectedSources = Array.isArray(plan.selectedSources) ? plan.selectedSources : []
    for (const source of selectedSources) {
      if (!isRecord(source)) continue
      const sourceKind = typeof source.source_kind === 'string' ? source.source_kind : null
      const reuseMode = typeof source.reuse_mode === 'string' ? source.reuse_mode : null
      const selectionReason = typeof source.selection_reason === 'string' ? source.selection_reason : null
      if (typeof source.asset_id === 'string') {
        enqueueEdge({
          from_node_type: 'asset',
          from_node_id: source.asset_id,
          to_node_type: 'image_plan',
          to_node_id: plan.id,
          edge_kind: 'source_selected_for_plan',
          metadata_json: sourceKind
            ? {
                source_kind: sourceKind,
                reuse_mode: reuseMode,
                selection_reason: selectionReason,
              }
            : null,
        })
        linkedSourceCount += 1
      }
      if (typeof source.binding_id === 'string') {
        enqueueEdge({
          from_node_type: 'binding',
          from_node_id: source.binding_id,
          to_node_type: 'image_plan',
          to_node_id: plan.id,
          edge_kind: 'binding_selected_for_plan',
          metadata_json: sourceKind
            ? {
                source_kind: sourceKind,
                reuse_mode: reuseMode,
              }
            : null,
        })
        linkedSourceCount += 1
      }
      if (typeof source.projection_id === 'string') {
        enqueueEdge({
          from_node_type: 'projection',
          from_node_id: source.projection_id,
          to_node_type: 'image_plan',
          to_node_id: plan.id,
          edge_kind: 'projection_selected_for_plan',
          metadata_json: sourceKind
            ? {
                source_kind: sourceKind,
                reuse_mode: reuseMode,
              }
            : null,
        })
        linkedSourceCount += 1
      }
    }

    const generation = isRecord(plan.generation) ? plan.generation : null
    const basedOnProjectionIds = stringArray(
      generation?.based_on_projection_ids ?? generation?.basedOnProjectionIds,
    )
    for (const projectionId of basedOnProjectionIds) {
      enqueueEdge({
        from_node_type: 'projection',
        from_node_id: projectionId,
        to_node_type: 'image_plan',
        to_node_id: plan.id,
        edge_kind: 'plan_generation_based_on_projection',
        metadata_json: {
          generation_mode:
            typeof generation?.mode === 'string'
              ? generation.mode
              : null,
          input_mode:
            typeof generation?.input_mode === 'string'
              ? generation.input_mode
              : typeof generation?.inputMode === 'string'
                ? generation.inputMode
                : null,
        },
      })
      linkedSourceCount += 1
    }
    const jobId = typeof generation?.job_id === 'string'
      ? generation.job_id
      : typeof generation?.jobId === 'string'
        ? generation.jobId
        : null
    if (jobId) {
      enqueueEdge({
        from_node_type: 'image_plan',
        from_node_id: plan.id,
        to_node_type: 'generation_job',
        to_node_id: jobId,
        edge_kind: 'plan_scheduled_generation_job',
        metadata_json: {
          input_mode:
            typeof generation?.input_mode === 'string'
              ? generation.input_mode
              : typeof generation?.inputMode === 'string'
                ? generation.inputMode
                : null,
          provider:
            typeof generation?.provider === 'string'
              ? generation.provider
              : null,
        },
      })
    }
    if (linkedSourceCount === 0) {
      markOrphaned('image_plan', plan.id, 'no_plan_sources_detected', {
        scene_ref: plan.sceneRef as Record<string, unknown>,
      })
    }
  }
  await flushEdges()

  const generationJobs = await prisma.mediaGenerationJobRecord.findMany({
    select: {
      id: true,
      planId: true,
      promptBrief: true,
      generationSpec: true,
      compiledPrompt: true,
      providerRequestSummary: true,
      styleHint: true,
      inputMode: true,
      aspectRatioHint: true,
      basedOnProjectionIds: true,
      outputAssetId: true,
    },
  })
  for (const job of generationJobs) {
    const fallbackSpec = buildLegacyGenerationSpec({
      prompt_brief: job.promptBrief,
      input_mode: job.inputMode as MediaGenerationJob['input_mode'],
      aspect_ratio_hint: job.aspectRatioHint as MediaGenerationJob['aspect_ratio_hint'],
      based_on_projection_ids: stringArray(job.basedOnProjectionIds),
    })
    const compiledPrompt = compileMediaGenerationSpec({
      spec: isStoredGenerationSpec(job.generationSpec) ? job.generationSpec : fallbackSpec,
      style_hint: job.styleHint,
    })
    const updateData: Record<string, unknown> = {}
    if (!isStoredGenerationSpec(job.generationSpec)) {
      updateData.generationSpec = fallbackSpec
    }
    if (!isStoredCompiledPrompt(job.compiledPrompt)) {
      updateData.compiledPrompt = compiledPrompt
    }
    if (typeof job.promptBrief !== 'string' || job.promptBrief.trim().length === 0) {
      updateData.promptBrief = compiledPrompt.rendered_prompt
    }
    if (!isRecord(job.providerRequestSummary)) {
      updateData.providerRequestSummary = {
        compiled_prompt_schema: compiledPrompt.schema_version,
        template_id: compiledPrompt.template_id,
        rendered_length: compiledPrompt.rendered_prompt.length,
        backfilled_by: 'media-lineage-backfill.v1',
      }
    }
    if (Object.keys(updateData).length > 0) {
      summary.generation_jobs_updated += 1
      if (!dryRun) {
        await prisma.mediaGenerationJobRecord.update({
          where: { id: job.id },
          data: updateData,
        })
      }
    }

    if (job.planId) {
      enqueueEdge({
        from_node_type: 'image_plan',
        from_node_id: job.planId,
        to_node_type: 'generation_job',
        to_node_id: job.id,
        edge_kind: 'plan_scheduled_generation_job',
        metadata_json: {
          input_mode: job.inputMode,
          provider: null,
        },
      })
    }
    const basedOnProjectionIds = stringArray(job.basedOnProjectionIds)
    for (const projectionId of basedOnProjectionIds) {
      enqueueEdge({
        from_node_type: 'projection',
        from_node_id: projectionId,
        to_node_type: 'generation_job',
        to_node_id: job.id,
        edge_kind: 'generation_job_based_on_projection',
      })
    }
    if (job.outputAssetId) {
      enqueueEdge({
        from_node_type: 'generation_job',
        from_node_id: job.id,
        to_node_type: 'asset',
        to_node_id: job.outputAssetId,
        edge_kind: 'generation_job_produced_asset',
      })
      const outputSnapshots = snapshotsByAssetId.get(job.outputAssetId) ?? []
      for (const snapshot of outputSnapshots) {
        enqueueEdge({
          from_node_type: 'asset',
          from_node_id: job.outputAssetId,
          to_node_type: 'semantic_snapshot',
          to_node_id: snapshot.id,
          edge_kind: 'generated_asset_described_by_snapshot',
          metadata_json: {
            schema_version: snapshot.schemaVersion,
          },
        })
      }
    }
    if (!job.planId && basedOnProjectionIds.length === 0 && !job.outputAssetId) {
      markOrphaned('generation_job', job.id, 'unlinked_generation_job')
    }
  }
  await flushEdges()

  console.log(
    '[media-lineage-backfill]',
    dryRun ? 'dry-run' : 'applied',
    JSON.stringify(summary, null, 2),
  )
}

main()
  .then(async () => {
    await disconnectPrisma()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('[media-lineage-backfill] failed', error)
    await disconnectPrisma()
    process.exit(1)
  })

import type { MediaLineageEdge as PrismaMediaLineageEdge, PrismaClient } from '@prisma/client'
import type {
  CreateMediaLineageEdgeInput,
  MediaLineageEdge,
  MediaLineageNodeType,
} from '../types.js'
import type { MediaLineageEdgeRepository } from '../media-lineage-edge-repository.js'

export class PgMediaLineageEdgeRepository implements MediaLineageEdgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMediaLineageEdgeInput): Promise<MediaLineageEdge> {
    const row = await this.prisma.mediaLineageEdge.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        fromNodeType: input.from_node_type,
        fromNodeId: input.from_node_id,
        toNodeType: input.to_node_type,
        toNodeId: input.to_node_id,
        edgeKind: input.edge_kind,
        reason: input.reason ?? null,
        schemaVersion: input.schema_version ?? null,
        sceneType: input.scene_type ?? null,
        sceneId: input.scene_id ?? null,
        bindingRole: input.binding_role ?? null,
        sourceSceneType: input.source_scene_type ?? null,
        sourceSceneId: input.source_scene_id ?? null,
        projectionSurface: input.projection_surface ?? null,
        projectionKind: input.projection_kind ?? null,
        sourceKind: input.source_kind ?? null,
        reuseMode: input.reuse_mode ?? null,
        selectionReason: input.selection_reason ?? null,
        generationMode: input.generation_mode ?? null,
        inputMode: input.input_mode ?? null,
        provider: input.provider ?? null,
        visibilityPolicy: input.visibility_policy ?? null,
        extractionStatus: input.extraction_status ?? null,
        surface: input.surface ?? null,
        displayVariant: input.display_variant ?? null,
        postId: input.post_id ?? null,
        mimeType: input.mime_type ?? null,
      },
    })
    return this.toDomain(row)
  }

  async createMany(inputs: CreateMediaLineageEdgeInput[]): Promise<MediaLineageEdge[]> {
    if (inputs.length === 0) return []
    const rows = await this.prisma.$transaction(inputs.map((input) => this.prisma.mediaLineageEdge.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        fromNodeType: input.from_node_type,
        fromNodeId: input.from_node_id,
        toNodeType: input.to_node_type,
        toNodeId: input.to_node_id,
        edgeKind: input.edge_kind,
        reason: input.reason ?? null,
        schemaVersion: input.schema_version ?? null,
        sceneType: input.scene_type ?? null,
        sceneId: input.scene_id ?? null,
        bindingRole: input.binding_role ?? null,
        sourceSceneType: input.source_scene_type ?? null,
        sourceSceneId: input.source_scene_id ?? null,
        projectionSurface: input.projection_surface ?? null,
        projectionKind: input.projection_kind ?? null,
        sourceKind: input.source_kind ?? null,
        reuseMode: input.reuse_mode ?? null,
        selectionReason: input.selection_reason ?? null,
        generationMode: input.generation_mode ?? null,
        inputMode: input.input_mode ?? null,
        provider: input.provider ?? null,
        visibilityPolicy: input.visibility_policy ?? null,
        extractionStatus: input.extraction_status ?? null,
        surface: input.surface ?? null,
        displayVariant: input.display_variant ?? null,
        postId: input.post_id ?? null,
        mimeType: input.mime_type ?? null,
      },
    })))
    return rows.map((row) => this.toDomain(row))
  }

  async findByNode(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]> {
    const rows = await this.prisma.mediaLineageEdge.findMany({
      where: {
        OR: [
          { fromNodeType: nodeType, fromNodeId: nodeId },
          { toNodeType: nodeType, toNodeId: nodeId },
        ],
      },
      orderBy: [{ createdAt: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findOutgoing(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]> {
    const rows = await this.prisma.mediaLineageEdge.findMany({
      where: {
        fromNodeType: nodeType,
        fromNodeId: nodeId,
      },
      orderBy: [{ createdAt: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findIncoming(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]> {
    const rows = await this.prisma.mediaLineageEdge.findMany({
      where: {
        toNodeType: nodeType,
        toNodeId: nodeId,
      },
      orderBy: [{ createdAt: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  private toDomain(row: PrismaMediaLineageEdge): MediaLineageEdge {
    return {
      id: row.id,
      from_node_type: row.fromNodeType as MediaLineageEdge['from_node_type'],
      from_node_id: row.fromNodeId,
      to_node_type: row.toNodeType as MediaLineageEdge['to_node_type'],
      to_node_id: row.toNodeId,
      edge_kind: row.edgeKind,
      reason: row.reason,
      schema_version: row.schemaVersion,
      scene_type: row.sceneType,
      scene_id: row.sceneId,
      binding_role: row.bindingRole as MediaLineageEdge['binding_role'],
      source_scene_type: row.sourceSceneType,
      source_scene_id: row.sourceSceneId,
      projection_surface: row.projectionSurface as MediaLineageEdge['projection_surface'],
      projection_kind: row.projectionKind as MediaLineageEdge['projection_kind'],
      source_kind: row.sourceKind as MediaLineageEdge['source_kind'],
      reuse_mode: row.reuseMode as MediaLineageEdge['reuse_mode'],
      selection_reason: row.selectionReason,
      generation_mode: row.generationMode as MediaLineageEdge['generation_mode'],
      input_mode: row.inputMode as MediaLineageEdge['input_mode'],
      provider: row.provider,
      visibility_policy: row.visibilityPolicy as MediaLineageEdge['visibility_policy'],
      extraction_status: row.extractionStatus as MediaLineageEdge['extraction_status'],
      surface: row.surface as MediaLineageEdge['surface'],
      display_variant: row.displayVariant as MediaLineageEdge['display_variant'],
      post_id: row.postId,
      mime_type: row.mimeType,
      created_at: row.createdAt,
    }
  }
}

import { Prisma, type MediaLineageEdge as PrismaMediaLineageEdge, type PrismaClient } from '@prisma/client'
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
        metadataJson: (input.metadata_json ?? null) as unknown as Prisma.InputJsonValue,
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
        metadataJson: (input.metadata_json ?? null) as unknown as Prisma.InputJsonValue,
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
      metadata_json: row.metadataJson as Record<string, unknown> | null,
      created_at: row.createdAt,
    }
  }
}

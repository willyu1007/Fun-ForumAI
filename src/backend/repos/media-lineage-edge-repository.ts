import type {
  CreateMediaLineageEdgeInput,
  MediaLineageEdge,
  MediaLineageNodeType,
} from './types.js'

export interface MediaLineageEdgeRepository {
  create(input: CreateMediaLineageEdgeInput): Promise<MediaLineageEdge>
  createMany(inputs: CreateMediaLineageEdgeInput[]): Promise<MediaLineageEdge[]>
  findByNode(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]>
  findOutgoing(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]>
  findIncoming(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]>
}

let counter = 0
function cuid(): string {
  return `media_lineage_edge_${Date.now()}_${++counter}`
}

export class InMemoryMediaLineageEdgeRepository implements MediaLineageEdgeRepository {
  private readonly store = new Map<string, MediaLineageEdge>()

  async create(input: CreateMediaLineageEdgeInput): Promise<MediaLineageEdge> {
    const edge: MediaLineageEdge = {
      id: input.id ?? cuid(),
      from_node_type: input.from_node_type,
      from_node_id: input.from_node_id,
      to_node_type: input.to_node_type,
      to_node_id: input.to_node_id,
      edge_kind: input.edge_kind,
      metadata_json: input.metadata_json ?? null,
      created_at: new Date(),
    }
    this.store.set(edge.id, edge)
    return edge
  }

  async createMany(inputs: CreateMediaLineageEdgeInput[]): Promise<MediaLineageEdge[]> {
    return Promise.all(inputs.map((input) => this.create(input)))
  }

  async findByNode(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]> {
    return Array.from(this.store.values())
      .filter((edge) =>
        (edge.from_node_type === nodeType && edge.from_node_id === nodeId)
        || (edge.to_node_type === nodeType && edge.to_node_id === nodeId),
      )
      .sort((left, right) => left.created_at.getTime() - right.created_at.getTime())
  }

  async findOutgoing(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]> {
    return Array.from(this.store.values())
      .filter((edge) => edge.from_node_type === nodeType && edge.from_node_id === nodeId)
      .sort((left, right) => left.created_at.getTime() - right.created_at.getTime())
  }

  async findIncoming(nodeType: MediaLineageNodeType, nodeId: string): Promise<MediaLineageEdge[]> {
    return Array.from(this.store.values())
      .filter((edge) => edge.to_node_type === nodeType && edge.to_node_id === nodeId)
      .sort((left, right) => left.created_at.getTime() - right.created_at.getTime())
  }
}

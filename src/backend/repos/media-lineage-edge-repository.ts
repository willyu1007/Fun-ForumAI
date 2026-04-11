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
      reason: input.reason ?? null,
      schema_version: input.schema_version ?? null,
      scene_type: input.scene_type ?? null,
      scene_id: input.scene_id ?? null,
      binding_role: input.binding_role ?? null,
      source_scene_type: input.source_scene_type ?? null,
      source_scene_id: input.source_scene_id ?? null,
      projection_surface: input.projection_surface ?? null,
      projection_kind: input.projection_kind ?? null,
      source_kind: input.source_kind ?? null,
      reuse_mode: input.reuse_mode ?? null,
      selection_reason: input.selection_reason ?? null,
      generation_mode: input.generation_mode ?? null,
      input_mode: input.input_mode ?? null,
      provider: input.provider ?? null,
      visibility_policy: input.visibility_policy ?? null,
      extraction_status: input.extraction_status ?? null,
      surface: input.surface ?? null,
      display_variant: input.display_variant ?? null,
      post_id: input.post_id ?? null,
      mime_type: input.mime_type ?? null,
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

import type {
  CreateMediaLineageEdgeInput,
  MediaLineageEdge,
  MediaLineageNodeType,
} from '../repos/types.js'
import type { MediaLineageEdgeRepository } from '../repos/media-lineage-edge-repository.js'

export interface MediaLineageTrace {
  center: {
    node_type: MediaLineageNodeType
    node_id: string
  }
  max_depth: number
  incoming: MediaLineageEdge[]
  outgoing: MediaLineageEdge[]
  nodes: Array<{
    node_type: MediaLineageNodeType
    node_id: string
    distance: number
  }>
  edges: MediaLineageEdge[]
}

export interface MediaLineageServiceDeps {
  mediaLineageEdgeRepo: MediaLineageEdgeRepository
}

export class MediaLineageService {
  constructor(private readonly deps: MediaLineageServiceDeps) {}

  recordEdge(input: CreateMediaLineageEdgeInput): Promise<MediaLineageEdge> {
    return this.deps.mediaLineageEdgeRepo.create(input)
  }

  async recordEdges(inputs: CreateMediaLineageEdgeInput[]): Promise<MediaLineageEdge[]> {
    const deduped = dedupeEdges(inputs)
    if (deduped.length === 0) return []
    return this.deps.mediaLineageEdgeRepo.createMany(deduped)
  }

  async traceNode(
    nodeType: MediaLineageNodeType,
    nodeId: string,
    maxDepth = 3,
  ): Promise<MediaLineageTrace> {
    const depth = clampDepth(maxDepth)
    const [incoming, outgoing] = await Promise.all([
      this.deps.mediaLineageEdgeRepo.findIncoming(nodeType, nodeId),
      this.deps.mediaLineageEdgeRepo.findOutgoing(nodeType, nodeId),
    ])
    const queue: Array<{ node_type: MediaLineageNodeType; node_id: string; distance: number }> = [
      {
        node_type: nodeType,
        node_id: nodeId,
        distance: 0,
      },
    ]
    const seenNodes = new Map<string, { node_type: MediaLineageNodeType; node_id: string; distance: number }>()
    const seenEdges = new Map<string, MediaLineageEdge>()
    seenNodes.set(nodeKey(nodeType, nodeId), {
      node_type: nodeType,
      node_id: nodeId,
      distance: 0,
    })

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current.distance >= depth) continue
      const [currentIncoming, currentOutgoing] = await Promise.all([
        this.deps.mediaLineageEdgeRepo.findIncoming(current.node_type, current.node_id),
        this.deps.mediaLineageEdgeRepo.findOutgoing(current.node_type, current.node_id),
      ])
      for (const edge of [...currentIncoming, ...currentOutgoing]) {
        seenEdges.set(edgeKey(edge), edge)
        const nextNodes = [
          {
            node_type: edge.from_node_type,
            node_id: edge.from_node_id,
          },
          {
            node_type: edge.to_node_type,
            node_id: edge.to_node_id,
          },
        ]
        for (const nextNode of nextNodes) {
          const key = nodeKey(nextNode.node_type, nextNode.node_id)
          const nextDistance = current.distance + 1
          const existing = seenNodes.get(key)
          if (existing && existing.distance <= nextDistance) continue
          const entry = { ...nextNode, distance: nextDistance }
          seenNodes.set(key, entry)
          queue.push(entry)
        }
      }
    }

    return {
      center: {
        node_type: nodeType,
        node_id: nodeId,
      },
      max_depth: depth,
      incoming,
      outgoing,
      nodes: Array.from(seenNodes.values()).sort((left, right) => {
        if (left.distance !== right.distance) return left.distance - right.distance
        if (left.node_type !== right.node_type) return left.node_type.localeCompare(right.node_type)
        return left.node_id.localeCompare(right.node_id)
      }),
      edges: Array.from(seenEdges.values()).sort(
        (left, right) => left.created_at.getTime() - right.created_at.getTime(),
      ),
    }
  }

  async hasLineage(nodeType: MediaLineageNodeType, nodeId: string): Promise<boolean> {
    const edges = await this.deps.mediaLineageEdgeRepo.findByNode(nodeType, nodeId)
    return edges.length > 0
  }
}

function clampDepth(value: number): number {
  if (!Number.isFinite(value)) return 3
  return Math.min(5, Math.max(1, Math.trunc(value)))
}

function nodeKey(nodeType: MediaLineageNodeType, nodeId: string): string {
  return `${nodeType}|${nodeId}`
}

function edgeKey(edge: MediaLineageEdge): string {
  return [
    edge.from_node_type,
    edge.from_node_id,
    edge.edge_kind,
    edge.to_node_type,
    edge.to_node_id,
  ].join('|')
}

function dedupeEdges(inputs: CreateMediaLineageEdgeInput[]): CreateMediaLineageEdgeInput[] {
  const seen = new Set<string>()
  const out: CreateMediaLineageEdgeInput[] = []
  for (const input of inputs) {
    const key = [
      input.from_node_type,
      input.from_node_id,
      input.edge_kind,
      input.to_node_type,
      input.to_node_id,
      JSON.stringify({
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
      }),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(input)
  }
  return out
}

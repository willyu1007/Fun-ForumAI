import type {
  AgentRepository,
  CommentRepository,
  CommunityRepository,
  CreatePprSnapshotInput,
  PostRepository,
  RelationRepository,
} from '../../repos/index.js'
import { PPR_TOPIC_FALLBACK, normalizeTopicToken } from '../../allocator/ppr-topic-key.js'

const COMMUNITY_ALL = '__all__'

interface PprSnapshotBuilderDeps {
  agentRepo: AgentRepository
  communityRepo: CommunityRepository
  postRepo: PostRepository
  commentRepo: CommentRepository
  relationRepo?: RelationRepository | null
}

export interface PprSnapshotBuildOptions {
  since: Date
  now?: Date
  alpha?: number
  maxIterations?: number
  topKPerContext?: number
  refreshTtlMs: number
}

interface EdgeIndex {
  agentCommunity: Map<string, Map<string, number>>
  agentTopic: Map<string, Map<string, number>>
  relationOut: Map<string, Map<string, number>>
  activeAgents: string[]
  sourceCommunities: Map<string, string[]>
  sourceTopics: Map<string, string[]>
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function setWeight(index: Map<string, Map<string, number>>, source: string, key: string, delta: number): void {
  const sourceMap = index.get(source) ?? new Map<string, number>()
  sourceMap.set(key, (sourceMap.get(key) ?? 0) + delta)
  index.set(source, sourceMap)
}

function sortedKeysByWeight(map: Map<string, number>, limit: number): string[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key)
}

function maxWeight(map: Map<string, number> | undefined): number {
  if (!map || map.size === 0) return 0
  let max = 0
  for (const value of map.values()) {
    if (value > max) max = value
  }
  return max
}

function normalizeAffinity(map: Map<string, number> | undefined, key: string): number {
  if (!map || map.size === 0) return 0
  const m = maxWeight(map)
  if (m <= 0) return 0
  return clamp((map.get(key) ?? 0) / m, 0, 1)
}

function addAdjacency(
  adjacency: Map<string, Map<string, number>>,
  from: string,
  to: string,
  weight: number,
): void {
  if (weight <= 0) return
  const row = adjacency.get(from) ?? new Map<string, number>()
  row.set(to, (row.get(to) ?? 0) + weight)
  adjacency.set(from, row)
}

function runPersonalizedPageRank(
  sourceNode: string,
  adjacency: Map<string, Map<string, number>>,
  alpha: number,
  maxIterations: number,
): Map<string, number> {
  const nodes = new Set<string>()
  for (const [from, neighbors] of adjacency) {
    nodes.add(from)
    for (const to of neighbors.keys()) {
      nodes.add(to)
    }
  }
  nodes.add(sourceNode)

  const nodeList = Array.from(nodes)
  const nodeIndex = new Map(nodeList.map((node, idx) => [node, idx] as const))
  const n = nodeList.length
  if (n === 0) return new Map()

  const sourceIdx = nodeIndex.get(sourceNode)
  if (sourceIdx === undefined) return new Map()

  const outgoing: Array<Array<[number, number]>> = Array.from({ length: n }, () => [])
  for (const [from, neighbors] of adjacency) {
    const fromIdx = nodeIndex.get(from)
    if (fromIdx === undefined || neighbors.size === 0) continue
    let total = 0
    for (const weight of neighbors.values()) {
      total += weight
    }
    if (total <= 0) continue

    for (const [to, weight] of neighbors.entries()) {
      const toIdx = nodeIndex.get(to)
      if (toIdx === undefined || weight <= 0) continue
      outgoing[fromIdx].push([toIdx, weight / total])
    }
  }

  let current = new Float64Array(n)
  let next = new Float64Array(n)
  current[sourceIdx] = 1

  const teleport = 1 - alpha

  for (let step = 0; step < maxIterations; step += 1) {
    next.fill(0)
    next[sourceIdx] += teleport

    for (let fromIdx = 0; fromIdx < n; fromIdx += 1) {
      const prob = current[fromIdx]
      if (prob <= 0) continue
      const neighbors = outgoing[fromIdx]
      if (neighbors.length === 0) {
        next[sourceIdx] += alpha * prob
        continue
      }
      for (const [toIdx, weight] of neighbors) {
        next[toIdx] += alpha * prob * weight
      }
    }

    const tmp = current
    current = next
    next = tmp
  }

  const result = new Map<string, number>()
  for (let i = 0; i < nodeList.length; i += 1) {
    result.set(nodeList[i], current[i])
  }
  return result
}

export class PprSnapshotBuilder {
  constructor(private readonly deps: PprSnapshotBuilderDeps) {}

  async buildSnapshots(opts: PprSnapshotBuildOptions): Promise<Map<string, CreatePprSnapshotInput[]>> {
    const now = opts.now ?? new Date()
    const alpha = clamp(opts.alpha ?? 0.85, 0.01, 0.99)
    const maxIterations = Math.max(4, Math.trunc(opts.maxIterations ?? 20))
    const topK = Math.max(5, Math.trunc(opts.topKPerContext ?? 40))

    const index = await this.buildEdgeIndex(opts.since)
    if (index.activeAgents.length === 0) {
      return new Map()
    }

    const adjacency = this.buildAdjacency(index)
    const expiresAt = new Date(now.getTime() + opts.refreshTtlMs)

    const result = new Map<string, CreatePprSnapshotInput[]>()

    for (const sourceAgentId of index.activeAgents) {
      const sourceNode = `a:${sourceAgentId}`
      const ppr = runPersonalizedPageRank(sourceNode, adjacency, alpha, maxIterations)
      const contexts = this.resolveContexts(index, sourceAgentId)
      const rows: CreatePprSnapshotInput[] = []

      for (const context of contexts) {
        const ranked = this.rankCandidatesForContext({
          sourceAgentId,
          ppr,
          activeAgents: index.activeAgents,
          communityId: context.communityId,
          topicKey: context.topicKey,
          edgeIndex: index,
        })

        const maxScore = ranked[0]?.score ?? 0
        if (maxScore <= 0) continue

        for (let i = 0; i < Math.min(topK, ranked.length); i += 1) {
          const item = ranked[i]
          rows.push({
            source_agent_id: sourceAgentId,
            candidate_agent_id: item.candidateAgentId,
            community_id: context.communityId,
            topic_key: context.topicKey,
            ppr_score: Number((item.score / maxScore).toFixed(6)),
            rank: i + 1,
            computed_at: now,
            expires_at: expiresAt,
          })
        }
      }

      result.set(sourceAgentId, rows)
    }

    return result
  }

  private resolveContexts(index: EdgeIndex, sourceAgentId: string): Array<{ communityId: string; topicKey: string }> {
    const communities = index.sourceCommunities.get(sourceAgentId) ?? [COMMUNITY_ALL]
    const topics = index.sourceTopics.get(sourceAgentId) ?? [PPR_TOPIC_FALLBACK]

    const contexts = new Map<string, { communityId: string; topicKey: string }>()
    contexts.set(`${COMMUNITY_ALL}:${PPR_TOPIC_FALLBACK}`, {
      communityId: COMMUNITY_ALL,
      topicKey: PPR_TOPIC_FALLBACK,
    })

    for (const communityId of communities.slice(0, 5)) {
      contexts.set(`${communityId}:${PPR_TOPIC_FALLBACK}`, {
        communityId,
        topicKey: PPR_TOPIC_FALLBACK,
      })

      for (const topicKey of topics.slice(0, 6)) {
        contexts.set(`${communityId}:${topicKey}`, {
          communityId,
          topicKey,
        })
      }
    }

    for (const topicKey of topics.slice(0, 6)) {
      contexts.set(`${COMMUNITY_ALL}:${topicKey}`, {
        communityId: COMMUNITY_ALL,
        topicKey,
      })
    }

    return Array.from(contexts.values())
  }

  private rankCandidatesForContext(input: {
    sourceAgentId: string
    ppr: Map<string, number>
    activeAgents: string[]
    communityId: string
    topicKey: string
    edgeIndex: EdgeIndex
  }): Array<{ candidateAgentId: string; score: number }> {
    const ranked: Array<{ candidateAgentId: string; score: number }> = []

    for (const candidateAgentId of input.activeAgents) {
      if (candidateAgentId === input.sourceAgentId) continue

      const base = input.ppr.get(`a:${candidateAgentId}`) ?? 0
      if (base <= 0) continue

      const communityAffinity = input.communityId === COMMUNITY_ALL
        ? 0
        : normalizeAffinity(input.edgeIndex.agentCommunity.get(candidateAgentId), input.communityId)

      const topicAffinity = input.topicKey === PPR_TOPIC_FALLBACK
        ? 0
        : normalizeAffinity(input.edgeIndex.agentTopic.get(candidateAgentId), input.topicKey)

      const score = base * (1 + 0.35 * communityAffinity + 0.35 * topicAffinity)
      if (score <= 0) continue

      ranked.push({ candidateAgentId, score })
    }

    ranked.sort((a, b) => b.score - a.score || a.candidateAgentId.localeCompare(b.candidateAgentId))
    return ranked
  }

  private buildAdjacency(index: EdgeIndex): Map<string, Map<string, number>> {
    const adjacency = new Map<string, Map<string, number>>()

    for (const [agentId, communities] of index.agentCommunity) {
      const sourceNode = `a:${agentId}`
      const max = maxWeight(communities)
      for (const [communityId, weight] of communities.entries()) {
        const normalized = max > 0 ? weight / max : 0
        if (normalized <= 0) continue
        const communityNode = `c:${communityId}`
        addAdjacency(adjacency, sourceNode, communityNode, normalized)
        addAdjacency(adjacency, communityNode, sourceNode, normalized)
      }
    }

    for (const [agentId, topics] of index.agentTopic) {
      const sourceNode = `a:${agentId}`
      const max = maxWeight(topics)
      for (const [topicKey, weight] of topics.entries()) {
        const normalized = max > 0 ? weight / max : 0
        if (normalized <= 0) continue
        const topicNode = `t:${topicKey}`
        addAdjacency(adjacency, sourceNode, topicNode, normalized)
        addAdjacency(adjacency, topicNode, sourceNode, normalized)
      }
    }

    for (const [fromAgentId, edges] of index.relationOut) {
      const fromNode = `a:${fromAgentId}`
      const max = maxWeight(edges)
      for (const [toAgentId, weight] of edges.entries()) {
        if (fromAgentId === toAgentId) continue
        const normalized = max > 0 ? weight / max : 0
        if (normalized <= 0) continue
        addAdjacency(adjacency, fromNode, `a:${toAgentId}`, normalized)
      }
    }

    return adjacency
  }

  private async buildEdgeIndex(since: Date): Promise<EdgeIndex> {
    const activeAgents = await this.collectActiveAgents()
    const activeSet = new Set(activeAgents)
    const agentCommunity = new Map<string, Map<string, number>>()
    const agentTopic = new Map<string, Map<string, number>>()
    const relationOut = new Map<string, Map<string, number>>()

    const sourceCommunities = new Map<string, Set<string>>()
    const sourceTopics = new Map<string, Set<string>>()

    const posts = await this.collectPostsSince(since)

    for (const post of posts) {
      if (!activeSet.has(post.author_agent_id)) continue

      setWeight(agentCommunity, post.author_agent_id, post.community_id, 3)
      this.markSourceSet(sourceCommunities, post.author_agent_id, post.community_id)

      const tags = post.tags
        .map((tag) => normalizeTopicToken(tag))
        .filter((tag) => tag.length > 0)
      const uniqueTags = Array.from(new Set(tags))

      for (const tag of uniqueTags) {
        setWeight(agentTopic, post.author_agent_id, tag, 2)
        this.markSourceSet(sourceTopics, post.author_agent_id, tag)
      }

      const comments = await this.collectCommentsByPostSince(post.id, since)
      for (const comment of comments) {
        if (!activeSet.has(comment.author_agent_id)) continue
        setWeight(agentCommunity, comment.author_agent_id, post.community_id, 1.5)
        this.markSourceSet(sourceCommunities, comment.author_agent_id, post.community_id)

        for (const tag of uniqueTags) {
          setWeight(agentTopic, comment.author_agent_id, tag, 1)
          this.markSourceSet(sourceTopics, comment.author_agent_id, tag)
        }
      }
    }

    if (this.deps.relationRepo) {
      const relations = await this.deps.relationRepo.listRelationsByStates(['effective', 'shadow'], 100_000)
      for (const relation of relations) {
        if (!activeSet.has(relation.from_agent_id) || !activeSet.has(relation.to_agent_id)) continue
        const base = relation.state === 'effective' ? 0.4 : 0.2
        const score = clamp(base + clamp(relation.relation_score, 0, 1), 0.05, 1.4)
        setWeight(relationOut, relation.from_agent_id, relation.to_agent_id, score)
      }
    }

    const defaultCommunities = await this.collectCommunityIds(5)

    return {
      agentCommunity,
      agentTopic,
      relationOut,
      activeAgents,
      sourceCommunities: new Map(
        activeAgents.map((agentId) => {
          const values = sourceCommunities.get(agentId)
          const list = values && values.size > 0
            ? Array.from(values)
            : defaultCommunities.length > 0
              ? defaultCommunities
              : [COMMUNITY_ALL]
          return [agentId, list] as const
        }),
      ),
      sourceTopics: new Map(
        activeAgents.map((agentId) => {
          const topicWeights = agentTopic.get(agentId)
          const weighted = topicWeights ? sortedKeysByWeight(topicWeights, 6) : []
          const fromSource = sourceTopics.get(agentId)
          const merged = new Set<string>([...weighted, ...(fromSource ? Array.from(fromSource) : [])])
          if (merged.size === 0) {
            merged.add(PPR_TOPIC_FALLBACK)
          }
          return [agentId, Array.from(merged)] as const
        }),
      ),
    }
  }

  private async collectActiveAgents(): Promise<string[]> {
    const ids: string[] = []
    let cursor: string | undefined

    while (true) {
      const page = this.deps.agentRepo.findActive({ cursor, limit: 200 })
      if (page.items.length === 0) break

      for (const agent of page.items) {
        ids.push(agent.id)
      }

      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return ids
  }

  private async collectPostsSince(since: Date): Promise<Array<{ id: string; author_agent_id: string; community_id: string; tags: string[]; created_at: Date }>> {
    const posts: Array<{ id: string; author_agent_id: string; community_id: string; tags: string[]; created_at: Date }> = []
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.postRepo.findPublic({ cursor, limit: 300 })
      if (page.items.length === 0) break

      let shouldStop = false
      for (const post of page.items) {
        if (post.created_at < since) {
          shouldStop = true
          continue
        }
        posts.push(post)
      }

      if (shouldStop || !page.next_cursor || page.next_cursor === cursor) {
        break
      }
      cursor = page.next_cursor
    }

    return posts
  }

  private async collectCommentsByPostSince(postId: string, since: Date) {
    const comments: Array<{ id: string; author_agent_id: string; created_at: Date }> = []
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.commentRepo.findByPostAll(postId, { cursor, limit: 300 })
      if (page.items.length === 0) break

      for (const comment of page.items) {
        if (comment.created_at < since) continue
        comments.push(comment)
      }

      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return comments
  }

  private async collectCommunityIds(limit: number): Promise<string[]> {
    const ids: string[] = []
    let cursor: string | undefined

    while (ids.length < limit) {
      const page = this.deps.communityRepo.findAll({ cursor, limit: 100 })
      if (page.items.length === 0) break

      for (const community of page.items) {
        ids.push(community.id)
        if (ids.length >= limit) break
      }

      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return ids
  }

  private markSourceSet(index: Map<string, Set<string>>, agentId: string, value: string): void {
    const set = index.get(agentId) ?? new Set<string>()
    set.add(value)
    index.set(agentId, set)
  }
}

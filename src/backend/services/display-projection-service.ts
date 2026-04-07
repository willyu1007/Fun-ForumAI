import type {
  DiscussionBranchGroup,
  DiscussionForestProjection,
  DisplayAuthorSummary,
  EvidenceRef,
  ReadingGuideProjection,
  TurnDisplayProjection,
} from '../../shared/forum-orchestration.js'
import {
  FORUM_DISCUSSION_FOREST_SCHEMA_VERSION as DISCUSSION_FOREST_SCHEMA_VERSION,
  FORUM_TURN_DISPLAY_PROJECTION_SCHEMA_VERSION as TURN_DISPLAY_PROJECTION_SCHEMA_VERSION,
} from '../../shared/forum-orchestration.js'
import type { PublicStageThreadWithAuthor } from './forum-read-service.js'
import type { SemanticProjectionService } from './semantic-projection-service.js'

export interface DisplayProjectionServiceDeps {
  semanticProjectionService: SemanticProjectionService
}

export class DisplayProjectionService {
  constructor(private readonly deps: DisplayProjectionServiceDeps) {}

  buildDiscussionForest(input: {
    post_id: string
    threads: PublicStageThreadWithAuthor[]
    reading_guide: ReadingGuideProjection
    focus_thread_id?: string | null
    focus_turn_id?: string | null
  }): DiscussionForestProjection {
    const generatedAt = new Date().toISOString()
    const nodes: TurnDisplayProjection[] = []
    const branchGroups: DiscussionBranchGroup[] = []

    for (const thread of input.threads) {
      const threadCapsule = this.deps.semanticProjectionService.buildThreadCapsule(thread)
      const marksByTurnId = new Map(threadCapsule.semantic_marks.map((mark) => [mark.turn_id, mark]))
      const rootNode: TurnDisplayProjection = {
        schema_version: TURN_DISPLAY_PROJECTION_SCHEMA_VERSION,
        id: thread.id,
        entry_kind: 'THREAD',
        post_id: thread.post_id,
        thread_id: thread.id,
        display_parent_id: null,
        display_depth: 0,
        actual_anchor_turn_id: null,
        branch_root_turn_id: null,
        sibling_order: 0,
        collapsed_anchor_chain: [],
        is_late_entry: false,
        placement_reason: 'ROOT_APPEND',
        anchor_preview_source: 'NONE',
        reason_badges: threadCapsule.reason_badges,
        author: toDisplayAuthor(thread.author),
        body: thread.body,
        quoted_excerpt: null,
        evidence_refs: [{ kind: 'THREAD', id: thread.id }],
        created_at: toIsoString(thread.created_at),
        generated_at: generatedAt,
      }
      nodes.push(rootNode)

      const nodeById = new Map<string, TurnDisplayProjection>([[rootNode.id, rootNode]])
      const siblingOrderByParent = new Map<string, number>()
      const turnNodes = thread.turns.map((turn, index) => {
        const previousTurn = index > 0 ? thread.turns[index - 1] ?? null : null
        const semanticMark = marksByTurnId.get(turn.id) ?? null
        const actualAnchorTurnId = semanticMark?.actual_anchor_turn_id ?? turn.anchor_turn_id ?? null
        const actualAnchorNode = actualAnchorTurnId ? nodeById.get(actualAnchorTurnId) ?? null : null

        let displayParentId: string | null = rootNode.id
        let displayDepth: TurnDisplayProjection['display_depth'] = 1
        let branchRootTurnId: string | null = turn.id
        let placementReason: TurnDisplayProjection['placement_reason'] = 'ROOT_APPEND'
        let collapsedAnchorChain: string[] = []

        if (actualAnchorNode) {
          if (actualAnchorNode.display_depth < 2) {
            displayParentId = actualAnchorNode.id
            displayDepth = (actualAnchorNode.display_depth + 1) as 1 | 2
            branchRootTurnId = actualAnchorNode.display_depth === 0
              ? turn.id
              : (actualAnchorNode.branch_root_turn_id ?? actualAnchorNode.id)
            placementReason = previousTurn?.id && previousTurn.id !== actualAnchorNode.id
              ? 'LATE_ENTRY_REATTACH'
              : 'DIRECT_REPLY'
          } else {
            displayParentId = actualAnchorNode.display_parent_id ?? rootNode.id
            displayDepth = 2
            branchRootTurnId = actualAnchorNode.branch_root_turn_id ?? actualAnchorNode.display_parent_id ?? null
            placementReason = previousTurn?.id && previousTurn.id !== actualAnchorNode.id
              ? 'LATE_ENTRY_REATTACH'
              : 'DEPTH_CLAMP'
            collapsedAnchorChain = collectCollapsedAnchorChain(actualAnchorNode, nodeById, displayParentId)
          }
        } else if (actualAnchorTurnId) {
          placementReason = 'LATE_ENTRY_REATTACH'
          collapsedAnchorChain = [actualAnchorTurnId]
        }

        const siblingOrder = incrementSiblingOrder(siblingOrderByParent, displayParentId ?? rootNode.id)
        const node: TurnDisplayProjection = {
          schema_version: TURN_DISPLAY_PROJECTION_SCHEMA_VERSION,
          id: turn.id,
          entry_kind: 'TURN',
          post_id: turn.post_id,
          thread_id: turn.thread_id,
          display_parent_id: displayParentId,
          display_depth: displayDepth,
          actual_anchor_turn_id: actualAnchorTurnId,
          branch_root_turn_id: branchRootTurnId,
          sibling_order: siblingOrder,
          collapsed_anchor_chain: collapsedAnchorChain,
          is_late_entry: Boolean(
            semanticMark?.joined_late
            || (actualAnchorTurnId && previousTurn && previousTurn.id !== actualAnchorTurnId),
          ),
          placement_reason: placementReason,
          anchor_preview_source: semanticMark?.anchor_source ?? (turn.quoted_excerpt ? 'STORED_QUOTE' : 'NONE'),
          reason_badges: semanticMark?.badge_ids ?? [],
          author: toDisplayAuthor(turn.author),
          body: turn.body,
          quoted_excerpt: semanticMark?.quoted_excerpt ?? turn.quoted_excerpt ?? null,
          evidence_refs: dedupeEvidenceRefs([
            { kind: 'TURN', id: turn.id },
            ...(actualAnchorTurnId ? [{ kind: 'TURN', id: actualAnchorTurnId } satisfies EvidenceRef] : []),
          ]),
          created_at: toIsoString(turn.created_at),
          generated_at: generatedAt,
        }
        nodeById.set(node.id, node)
        return node
      })

      nodes.push(...turnNodes)
      branchGroups.push({
        id: `branch:${thread.id}`,
        branch_group_id: `branch:${thread.id}`,
        thread_id: thread.id,
        lead_node_id: rootNode.id,
        display_title: threadCapsule.summary,
        role_hint: threadCapsule.role,
        participant_count: thread.participant_count,
        turn_count: thread.turn_count,
        latest_activity_at: toIsoString(thread.last_activity_at),
        subtree_last_activity_at: toIsoString(thread.last_activity_at),
        node_count: turnNodes.length + 1,
        unresolved_count: threadCapsule.unresolved_points.length,
        reason_badges: threadCapsule.reason_badges,
        evidence_refs: threadCapsule.evidence_refs,
      })
    }

    return {
      schema_version: DISCUSSION_FOREST_SCHEMA_VERSION,
      projection_id: `forest:${input.post_id}:${generatedAt}`,
      post_id: input.post_id,
      focus_thread_id: input.focus_thread_id ?? null,
      focus_turn_id: input.focus_turn_id ?? null,
      reading_guide: input.reading_guide,
      branch_groups: branchGroups,
      nodes,
      latest_activity_cursor: null,
      evidence_refs: dedupeEvidenceRefs([
        ...input.reading_guide.evidence_refs,
        ...branchGroups.flatMap((group) => group.evidence_refs),
      ]),
      generated_at: generatedAt,
    }
  }
}

function toDisplayAuthor(author: {
  id: string
  actor_type: 'agent' | 'human'
  display_name: string
  avatar_url: string | null
  public_identity?: DisplayAuthorSummary['public_identity']
  public_projection?: DisplayAuthorSummary['public_projection']
  public_proof?: DisplayAuthorSummary['public_proof']
  public_bio?: string | null
}): DisplayAuthorSummary {
  return {
    id: author.id,
    actor_type: author.actor_type,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
    public_identity: author.public_identity ?? null,
    public_projection: author.public_projection ?? null,
    public_proof: author.public_proof ?? null,
    public_bio: author.public_bio ?? null,
  }
}

function incrementSiblingOrder(counter: Map<string, number>, parentId: string): number {
  const next = (counter.get(parentId) ?? 0) + 1
  counter.set(parentId, next)
  return next
}

function collectCollapsedAnchorChain(
  anchorNode: TurnDisplayProjection,
  nodeById: Map<string, TurnDisplayProjection>,
  stopAtParentId: string | null,
): string[] {
  const chain: string[] = [anchorNode.id]
  let cursor = anchorNode
  while (cursor.display_parent_id && cursor.display_parent_id !== stopAtParentId) {
    chain.push(cursor.display_parent_id)
    const next = nodeById.get(cursor.display_parent_id)
    if (!next) break
    cursor = next
  }
  return chain
}

function dedupeEvidenceRefs(values: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>()
  const refs: EvidenceRef[] = []
  for (const value of values) {
    const key = `${value.kind}:${value.id}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push(value)
  }
  return refs
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}

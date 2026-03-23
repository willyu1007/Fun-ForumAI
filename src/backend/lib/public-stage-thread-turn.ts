import type {
  PaginatedResult,
  PublicStageThreadTurn,
  PublicStageThread,
  PublicStageTurn,
} from '../repos/types.js'
import type { PublicStageThreadRepository } from '../repos/public-stage-thread-repository.js'
import type { PublicStageTurnRepository } from '../repos/public-stage-turn-repository.js'

export interface PublicStageThreadTurnDeps {
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
}

export function toPublicStageThreadTurnFromThread(thread: PublicStageThread): PublicStageThreadTurn {
  return {
    id: thread.id,
    post_id: thread.post_id,
    thread_id: thread.id,
    entry_kind: 'THREAD',
    anchor_turn_id: null,
    author_agent_id: thread.author_agent_id,
    body: thread.body,
    visibility: thread.visibility,
    state: thread.state,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
  }
}

export function toPublicStageThreadTurnFromTurn(turn: PublicStageTurn): PublicStageThreadTurn {
  return {
    id: turn.id,
    post_id: turn.post_id,
    thread_id: turn.thread_id,
    entry_kind: 'TURN',
    anchor_turn_id: turn.anchor_turn_id,
    author_agent_id: turn.author_agent_id,
    body: turn.body,
    visibility: turn.visibility,
    state: turn.state,
    created_at: turn.created_at,
    updated_at: turn.updated_at,
  }
}

export async function findPublicStageThreadTurnById(
  deps: PublicStageThreadTurnDeps,
  id: string,
): Promise<PublicStageThreadTurn | null> {
  const thread = await deps.publicStageThreadRepo.findById(id)
  if (thread) return toPublicStageThreadTurnFromThread(thread)
  const turn = await deps.publicStageTurnRepo.findById(id)
  return turn ? toPublicStageThreadTurnFromTurn(turn) : null
}

export async function listPublicStageThreadTurnsByPost(
  deps: PublicStageThreadTurnDeps,
  postId: string,
  input?: { includeAll?: boolean },
): Promise<PublicStageThreadTurn[]> {
  const includeAll = input?.includeAll === true
  const threads = includeAll
    ? await collectAllPages((cursor) => deps.publicStageThreadRepo.findByPostAll(postId, { cursor, limit: 500 }))
    : await collectAllPages((cursor) => deps.publicStageThreadRepo.findByPost(postId, { cursor, limit: 500 }))
  const turns = await deps.publicStageTurnRepo.findByThreads(threads.map((thread) => thread.id))
  const visibleTurns = includeAll
    ? turns
    : turns.filter((turn) => isVisibleEntry(turn))

  return sortEntries([
    ...threads.map((thread) => toPublicStageThreadTurnFromThread(thread)),
    ...visibleTurns.map((turn) => toPublicStageThreadTurnFromTurn(turn)),
  ])
}

export async function listPublicStageThreadTurnsByPostsSince(
  deps: PublicStageThreadTurnDeps,
  postIds: string[],
  since: Date,
): Promise<PublicStageThreadTurn[]> {
  const [threads, turns] = await Promise.all([
    deps.publicStageThreadRepo.findByPostsSince(postIds, since),
    deps.publicStageTurnRepo.findByPostsSince(postIds, since),
  ])
  return sortEntries([
    ...threads.map((thread) => toPublicStageThreadTurnFromThread(thread)),
    ...turns.map((turn) => toPublicStageThreadTurnFromTurn(turn)),
  ])
}

export async function listPublicStageThreadTurnsByAuthor(
  deps: PublicStageThreadTurnDeps,
  agentId: string,
): Promise<PublicStageThreadTurn[]> {
  const [threads, turns] = await Promise.all([
    collectAllPages((cursor) => deps.publicStageThreadRepo.findPublicByAuthorAgent(agentId, { cursor, limit: 500 })),
    collectAllPages((cursor) => deps.publicStageTurnRepo.findPublicByAuthorAgent(agentId, { cursor, limit: 500 })),
  ])
  return sortEntries([
    ...threads.map((thread) => toPublicStageThreadTurnFromThread(thread)),
    ...turns.map((turn) => toPublicStageThreadTurnFromTurn(turn)),
  ])
}

export async function countVisiblePublicStageThreadTurnsByPost(
  deps: PublicStageThreadTurnDeps,
  postId: string,
): Promise<number> {
  const entries = await listPublicStageThreadTurnsByPost(deps, postId)
  return entries.length
}

export async function updatePublicStageThreadTurnVisibility(
  deps: PublicStageThreadTurnDeps,
  id: string,
  visibility: PublicStageThreadTurn['visibility'],
): Promise<PublicStageThreadTurn | null> {
  const thread = await deps.publicStageThreadRepo.updateVisibility(id, visibility)
  if (thread) return toPublicStageThreadTurnFromThread(thread)
  const turn = await deps.publicStageTurnRepo.updateVisibility(id, visibility)
  return turn ? toPublicStageThreadTurnFromTurn(turn) : null
}

export async function updatePublicStageThreadTurnState(
  deps: PublicStageThreadTurnDeps,
  id: string,
  state: PublicStageThreadTurn['state'],
): Promise<PublicStageThreadTurn | null> {
  const thread = await deps.publicStageThreadRepo.updateState(id, state)
  if (thread) return toPublicStageThreadTurnFromThread(thread)
  const turn = await deps.publicStageTurnRepo.updateState(id, state)
  return turn ? toPublicStageThreadTurnFromTurn(turn) : null
}

function isVisibleEntry(entry: Pick<PublicStageThreadTurn, 'visibility' | 'state'>): boolean {
  return entry.state === 'APPROVED' && (entry.visibility === 'PUBLIC' || entry.visibility === 'GRAY')
}

async function collectAllPages<T extends { id: string }>(
  fetchPage: (cursor: string | undefined) => Promise<PaginatedResult<T>>,
): Promise<T[]> {
  const items: T[] = []
  let cursor: string | undefined
  while (true) {
    const page = await fetchPage(cursor)
    if (page.items.length === 0) break
    items.push(...page.items)
    if (!page.next_cursor || page.next_cursor === cursor) break
    cursor = page.next_cursor
  }
  return items
}

function sortEntries(entries: PublicStageThreadTurn[]): PublicStageThreadTurn[] {
  return [...entries].sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
}

import type {
  AgentRun,
  DomainEvent,
  Post,
  PublicStageThread,
  PublicStageTurn,
} from '../../repos/index.js'
import { ValidationError } from '../../lib/errors.js'
import {
  buildForumSceneMetadataInput,
} from '../public-scene-runtime.js'
import type { ForumSceneCarrierInput, ForumWriteContext } from './types.js'

export async function createScenePost(
  context: ForumWriteContext,
  input: {
    post: Parameters<import('../../repos/index.js').PostRepository['create']>[0]
    scene: ForumSceneCarrierInput
    event: Parameters<import('../../repos/index.js').EventRepository['create']>[0]
    agent_run: Parameters<import('../../repos/index.js').AgentRunRepository['create']>[0]
  },
): Promise<{ post: Post; event: DomainEvent; agentRun: AgentRun }> {
  if (!context.deps.publicSceneWriteRepo) {
    throw new ValidationError('Public scene write repository is not configured')
  }

  return context.deps.publicSceneWriteRepo.createPost({
    post: input.post,
    scene_metadata: buildForumSceneMetadataInput({
      community_id: input.post.community_id,
      target_type: 'POST',
      payload: input.scene,
    }),
    event: input.event,
    agent_run: input.agent_run,
  })
}

export async function createSceneThread(
  context: ForumWriteContext,
  input: {
    community_id: string
    thread: Parameters<import('../../repos/index.js').PublicStageThreadRepository['create']>[0]
    scene: ForumSceneCarrierInput
    event: Parameters<import('../../repos/index.js').EventRepository['create']>[0]
  }): Promise<{ thread: PublicStageThread; event: DomainEvent }> {
  if (!context.deps.publicSceneWriteRepo) {
    throw new ValidationError('Public scene write repository is not configured')
  }

  return context.deps.publicSceneWriteRepo.createThread({
    thread: input.thread,
    scene_metadata: buildForumSceneMetadataInput({
      community_id: input.community_id,
      target_type: 'THREAD',
      post_id: input.thread.post_id,
      payload: input.scene,
    }),
    event: input.event,
  })
}

export async function createSceneThreadTurn(
  context: ForumWriteContext,
  input: {
    community_id: string
    turn: Parameters<import('../../repos/index.js').PublicStageTurnRepository['create']>[0]
    scene: ForumSceneCarrierInput
    event: Parameters<import('../../repos/index.js').EventRepository['create']>[0]
  }): Promise<{ turn: PublicStageTurn; event: DomainEvent }> {
  if (!context.deps.publicSceneWriteRepo) {
    throw new ValidationError('Public scene write repository is not configured')
  }

  return context.deps.publicSceneWriteRepo.createThreadTurn({
    turn: input.turn,
    scene_metadata: buildForumSceneMetadataInput({
      community_id: input.community_id,
      target_type: 'TURN',
      post_id: input.turn.post_id,
      payload: input.scene,
    }),
    event: input.event,
  })
}

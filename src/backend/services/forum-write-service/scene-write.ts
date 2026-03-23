import type {
  AgentRun,
  Comment,
  DomainEvent,
  Post,
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

export async function createSceneComment(
  context: ForumWriteContext,
  input: {
    community_id: string
    comment: Parameters<import('../../repos/index.js').CommentRepository['create']>[0]
    scene: ForumSceneCarrierInput
    event: Parameters<import('../../repos/index.js').EventRepository['create']>[0]
  }): Promise<{ comment: Comment; event: DomainEvent }> {
  if (!context.deps.publicSceneWriteRepo) {
    throw new ValidationError('Public scene write repository is not configured')
  }

  return context.deps.publicSceneWriteRepo.createComment({
    comment: input.comment,
    scene_metadata: buildForumSceneMetadataInput({
      community_id: input.community_id,
      target_type: input.comment.parent_comment_id ? 'TURN' : 'THREAD',
      post_id: input.comment.post_id,
      payload: input.scene,
    }),
    event: input.event,
  })
}

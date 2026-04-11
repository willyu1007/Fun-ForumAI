import type { PostModerationMetadata } from './moderation-context.js'

export interface Post {
  id: string
  community_id: string
  author_agent_id: string
  title: string
  body: string
  tags: string[]
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  moderation_metadata: PostModerationMetadata | null
  created_at: Date
  updated_at: Date
}

export type PublicActorType = 'agent' | 'human'

export interface PublicStageAuthorRef {
  author_actor_type: PublicActorType
  author_agent_id: string | null
  author_user_id: string | null
}

export interface PublicStageThreadTurn extends PublicStageAuthorRef {
  id: string
  post_id: string
  thread_id: string
  entry_kind: 'THREAD' | 'TURN'
  anchor_turn_id: string | null
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: Date
  updated_at: Date
}

export type PublicStageThreadState = 'OPEN' | 'PEAKED' | 'CLOSED' | 'SPINOFF'

export interface RouteHandoff {
  route_type: 'SPINOFF' | 'AFTERSHOW' | 'PRIVATE' | 'AUDIENCE'
  route_state: string
  reason_code: string
  handoff_label: string
  handoff_payload: Record<string, unknown> | null
  cta: Record<string, unknown> | null
}

export interface PublicStageThread {
  id: string
  post_id: string
  community_id: string
  author_actor_type: PublicActorType
  author_agent_id: string | null
  author_user_id: string | null
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  thread_state: PublicStageThreadState
  reply_budget: number
  active_route: RouteHandoff | null
  created_at: Date
  updated_at: Date
}

export interface PublicStageTurn {
  id: string
  thread_id: string
  post_id: string
  author_actor_type: PublicActorType
  author_agent_id: string | null
  author_user_id: string | null
  turn_index: number
  anchor_turn_id: string | null
  anchor_intent: string | null
  quoted_excerpt: string | null
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: Date
  updated_at: Date
}

export type VoteTargetType = 'POST' | 'THREAD' | 'TURN' | 'MESSAGE'
export type HumanVoteTargetType = 'POST' | 'THREAD' | 'TURN'

export interface Vote {
  id: string
  voter_agent_id: string
  target_type: VoteTargetType
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  weight: number
  created_at: Date
}

export interface HumanVote {
  id: string
  voter_user_id: string
  target_type: HumanVoteTargetType
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  created_at: Date
}

export interface HumanAgentFollow {
  id: string
  user_id: string
  agent_id: string
  created_at: Date
}

export interface PostMedia {
  id: string
  post_id: string
  asset_id: string
  media_url: string
  mime_type: string
  created_at: Date
}

export interface CreatePostInput {
  id?: string
  community_id: string
  author_agent_id: string
  title: string
  body: string
  tags?: string[]
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  moderation_metadata?: PostModerationMetadata | null
}

export interface CreatePublicStageThreadInput {
  id?: string
  post_id: string
  community_id: string
  author_actor_type?: PublicActorType
  author_agent_id?: string | null
  author_user_id?: string | null
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  thread_state?: PublicStageThreadState
  reply_budget?: number
  active_route?: RouteHandoff | null
}

export interface CreatePublicStageTurnInput {
  id?: string
  thread_id: string
  post_id: string
  author_actor_type?: PublicActorType
  author_agent_id?: string | null
  author_user_id?: string | null
  turn_index: number
  anchor_turn_id?: string | null
  anchor_intent?: string | null
  quoted_excerpt?: string | null
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface UpsertVoteInput {
  voter_agent_id: string
  target_type: VoteTargetType
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  weight?: number
}

export interface UpsertHumanVoteInput {
  voter_user_id: string
  target_type: HumanVoteTargetType
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
}

export interface FollowAgentInput {
  user_id: string
  agent_id: string
}

export interface CreatePostMediaInput {
  post_id: string
  asset_id: string
  media_url: string
  mime_type: string
}

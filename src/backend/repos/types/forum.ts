export interface Post {
  id: string
  community_id: string
  author_agent_id: string
  title: string
  body: string
  tags: string[]
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  moderation_metadata: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface Comment {
  id: string
  post_id: string
  parent_comment_id: string | null
  author_agent_id: string
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: Date
  updated_at: Date
}

export interface Vote {
  id: string
  voter_agent_id: string
  target_type: 'POST' | 'COMMENT' | 'MESSAGE'
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  weight: number
  created_at: Date
}

export interface HumanVote {
  id: string
  voter_user_id: string
  target_type: 'POST' | 'COMMENT'
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
  moderation_metadata?: Record<string, unknown> | null
}

export interface CreateCommentInput {
  id?: string
  post_id: string
  parent_comment_id?: string | null
  author_agent_id: string
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface UpsertVoteInput {
  voter_agent_id: string
  target_type: 'POST' | 'COMMENT' | 'MESSAGE'
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  weight?: number
}

export interface UpsertHumanVoteInput {
  voter_user_id: string
  target_type: 'POST' | 'COMMENT'
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

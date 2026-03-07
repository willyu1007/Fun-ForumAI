export interface ApiResponse<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: 'user' | 'admin'
}

export interface AuthResult {
  user: AuthUser
  token: string
}

export interface FeedPost {
  id: string
  title: string
  body: string
  community_id: string
  created_at: string
}

export interface Community {
  id: string
  name: string
  slug: string
}

export interface Room {
  id: string
  name: string
  status: 'active' | 'cooling' | 'archived'
}

export interface ChatMessage {
  id: string
  room_id: string
  body: string
  author_id: string
  created_at: string
}

export interface Agent {
  id: string
  display_name: string
  status: string
}

export interface PrivateSession {
  id: string
  agent_id: string
  status: 'ACTIVE' | 'ENDED' | 'ARCHIVED'
}

export interface PrivateMessage {
  id: string
  session_id: string
  author_type: 'HUMAN' | 'AGENT'
  content: string
  created_at: string
}

export interface AgentXpInfo {
  xp: number
  xp_per_growth_point: number
  growth_points_total: number
  growth_points_spent: number
  growth_points_available: number
}

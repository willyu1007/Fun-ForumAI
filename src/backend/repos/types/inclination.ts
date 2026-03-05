export type InclinationSourceType = 'URL' | 'UPLOAD'
export type InclinationAssetStatus = 'PENDING' | 'CONSUMED' | 'CANCELLED' | 'REPLACED' | 'FAILED'

export interface AgentInclinationVisionSummary {
  theme: string
  scene: string
  mood: string
  discussion_points: string[]
}

export interface AgentInclinationAsset {
  id: string
  agent_id: string
  owner_user_id: string
  source_type: InclinationSourceType
  origin_url: string | null
  storage_key: string | null
  media_url: string
  mime_type: string
  file_size_bytes: number
  owner_note: string | null
  vision_summary: AgentInclinationVisionSummary
  status: InclinationAssetStatus
  consumed_post_id: string | null
  consumed_at: Date | null
  created_at: Date
}

export interface CreateAgentInclinationAssetInput {
  id?: string
  agent_id: string
  owner_user_id: string
  source_type: InclinationSourceType
  origin_url?: string | null
  storage_key?: string | null
  media_url: string
  mime_type: string
  file_size_bytes: number
  owner_note?: string | null
  vision_summary: AgentInclinationVisionSummary
  status?: InclinationAssetStatus
}

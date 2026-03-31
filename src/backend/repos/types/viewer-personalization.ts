export type ViewerPublicActorType = 'USER' | 'VISITOR'

export type ViewerPublicViewTargetKind =
  | 'home_post'
  | 'highlight_post'
  | 'featured_agent'
  | 'controversy_post'
  | 'wildcard_cameo'
  | 'post_detail'
  | 'aftershow_detail'
  | 'agent_relation_summary'

export interface ViewerPublicViewEvent {
  id: string
  actor_type: ViewerPublicActorType
  actor_id: string
  viewer_user_id: string | null
  viewer_agent_id: string | null
  source_surface: string
  source_shelf: string | null
  source_position: number | null
  target_kind: ViewerPublicViewTargetKind
  target_id: string
  target_agent_id: string | null
  community_id: string | null
  storyline_id: string | null
  is_t4: boolean
  note_template_id: string | null
  occurred_at: Date
  created_at: Date
  updated_at: Date
}

export interface CreateViewerPublicViewEventInput {
  actor_type: ViewerPublicActorType
  actor_id: string
  viewer_user_id?: string | null
  viewer_agent_id?: string | null
  source_surface: string
  source_shelf?: string | null
  source_position?: number | null
  target_kind: ViewerPublicViewTargetKind
  target_id: string
  target_agent_id?: string | null
  community_id?: string | null
  storyline_id?: string | null
  is_t4?: boolean
  note_template_id?: string | null
  occurred_at?: Date
}

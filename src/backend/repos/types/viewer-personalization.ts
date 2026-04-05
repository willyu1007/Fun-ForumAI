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

export type ViewerPublicParticipationMode =
  import('../../../shared/semantic-taxonomy.js').PublicParticipationMode
export type ViewerContentKind =
  import('../../../shared/semantic-taxonomy.js').ContentKind
export type ViewerEditorialShelfId =
  import('../../../shared/semantic-taxonomy.js').EditorialShelfId
export type ViewerStorylineState =
  import('../../../shared/semantic-taxonomy.js').StorylineState
export type ViewerFormatKind =
  import('../../../shared/semantic-taxonomy.js').FormatKind

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
  community_family: import('../../../shared/semantic-taxonomy.js').CommunityFamily | null
  public_participation_mode: ViewerPublicParticipationMode | null
  content_kind: ViewerContentKind | null
  editorial_shelf_id: ViewerEditorialShelfId | null
  storyline_state: ViewerStorylineState | null
  format_kind: ViewerFormatKind | null
  is_t4: boolean
  note_template_id: string | null
  cover_mode: string | null
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
  community_family?: import('../../../shared/semantic-taxonomy.js').CommunityFamily | null
  public_participation_mode?: ViewerPublicParticipationMode | null
  content_kind?: ViewerContentKind | null
  editorial_shelf_id?: ViewerEditorialShelfId | null
  storyline_state?: ViewerStorylineState | null
  format_kind?: ViewerFormatKind | null
  is_t4?: boolean
  note_template_id?: string | null
  cover_mode?: string | null
  occurred_at?: Date
}

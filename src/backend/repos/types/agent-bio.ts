export type AgentBioPresenceBucket =
  | 'emerging'
  | 'warming'
  | 'steady'
  | 'reflective'
  | 'quiet'

export type AgentBioRefreshKind =
  | 'bootstrap'
  | 'major'
  | 'minor_presence'

export type AgentBioRenderStatus =
  | 'rendered'
  | 'deduped'
  | 'conflict'
  | 'privacy_blocked'

export interface AgentWorldviewState {
  agent_id: string
  worldview_version: number
  phase_revision: number
  source_fingerprint: string
  refresh_reason: string
  presence_bucket: AgentBioPresenceBucket
  worldview_json: Record<string, unknown>
  last_major_refreshed_at: Date | null
  last_minor_refreshed_at: Date | null
  last_compiled_at: Date
  created_at: Date
  updated_at: Date
}

export interface AgentBioProjection {
  agent_id: string
  worldview_version: number
  phase_revision: number
  public_bio: string | null
  owner_bio: string | null
  private_header_bio: string | null
  presence_note: string | null
  render_fingerprint: string
  render_policy_json: Record<string, unknown>
  refreshed_at: Date
  created_at: Date
  updated_at: Date
}

export interface AgentBioRenderLog {
  id: string
  agent_id: string
  refresh_kind: AgentBioRefreshKind
  refresh_reason: string
  dedup_key: string
  worldview_version: number
  phase_revision: number
  source_fingerprint: string
  render_fingerprint: string
  status: AgentBioRenderStatus
  public_persisted: boolean
  note_json: Record<string, unknown> | null
  created_at: Date
}

export interface SaveAgentWorldviewStateInput {
  agent_id: string
  worldview_version: number
  phase_revision: number
  source_fingerprint: string
  refresh_reason: string
  presence_bucket: AgentBioPresenceBucket
  worldview_json: Record<string, unknown>
  last_major_refreshed_at?: Date | null
  last_minor_refreshed_at?: Date | null
  last_compiled_at: Date
  expected_worldview_version?: number
  expected_phase_revision?: number
}

export interface SaveAgentBioProjectionInput {
  agent_id: string
  worldview_version: number
  phase_revision: number
  public_bio?: string | null
  owner_bio?: string | null
  private_header_bio?: string | null
  presence_note?: string | null
  render_fingerprint: string
  render_policy_json: Record<string, unknown>
  refreshed_at: Date
}

export interface CreateAgentBioRenderLogInput {
  agent_id: string
  refresh_kind: AgentBioRefreshKind
  refresh_reason: string
  dedup_key: string
  worldview_version: number
  phase_revision: number
  source_fingerprint: string
  render_fingerprint: string
  status: AgentBioRenderStatus
  public_persisted: boolean
  note_json?: Record<string, unknown> | null
}

export interface CommitAgentBioRefreshInput {
  worldview: SaveAgentWorldviewStateInput
  projection: SaveAgentBioProjectionInput
  render_log: CreateAgentBioRenderLogInput
}

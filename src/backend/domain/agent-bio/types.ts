import type { VoiceLineId } from '../../../shared/agent-persona-catalog.js'
import type { AgentBioPresenceBucket } from '../../repos/types.js'

export type BioSurface = 'public' | 'owner' | 'private_header'
export type BioRhetoricFamily =
  | 'stance'
  | 'phase_shadow'
  | 'side_profile'
  | 'contrast'

export interface AgentBioPresenceState {
  bucket: AgentBioPresenceBucket
  score: number
  note_seed: string
  last_touch_at: string | null
}

export interface AgentBioWorldviewModel {
  identity: {
    display_name: string
    persona_seed_label: string
    home_voice_line_id: VoiceLineId
    voice_line_label: string
    visible_style: string
    interests: string[]
    mood: string | null
  }
  projection: {
    public_projection_hint: string | null
    banter_style: string | null
    top_scene: string | null
    signature_moves: string[]
  }
  system_identity?: {
    agent_kind: 'owner' | 'system'
    program_role: string | null
    visibility_role: string | null
    home_community: string | null
    stance_axis: string | null
    humor_axis: string | null
    empathy_axis: string | null
    narrative_axis: string | null
    signature_topics: string[]
    signature_relationships: string[]
    role_promise: string | null
    viewer_hook_style: string | null
    forbidden_tones: string[]
    private_lane_policy: string | null
  }
  public_history: {
    badges: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
    tagline: string | null
    top_chronicle_summaries: string[]
  }
  owner_history: {
    chronicle_summaries: string[]
    private_memory_summaries: string[]
    dominant_private_sentiment: string | null
  }
  relations: {
    following_effective: number
    followers_effective: number
    mutual_effective: number
    recent_state_tags: string[]
  }
  persona_state: {
    maturity: string | null
    confidence: number | null
    drift_score: number | null
  }
  presence: AgentBioPresenceState
  source_clauses: {
    public_safe: string[]
    owner_only: string[]
    private_header: string[]
    private_guard: string[]
  }
}

export interface AgentBioCandidate {
  surface: BioSurface
  text: string
  score: number
  reasons: string[]
  rhetoric_family: BioRhetoricFamily | null
  origin: 'llm' | 'fallback' | 'carry_forward'
}

export interface AgentBioRenderDiagnostics {
  mode: 'llm' | 'fallback' | 'carry_forward_minor'
  prompt_ref: {
    id: string
    version: number
  } | null
  llm_provider_id: string | null
  llm_model_id: string | null
  parse_success: boolean | null
  error: string | null
  recent_major_families: BioRhetoricFamily[]
  selected_families: Partial<Record<BioSurface, BioRhetoricFamily>>
  candidate_rejections: Array<{
    surface: BioSurface
    rhetoric_family: BioRhetoricFamily | null
    reasons: string[]
    origin: AgentBioCandidate['origin']
    preview: string
  }>
  privacy_violations: string[]
}

export interface AgentBioRenderSet {
  public_bio: string | null
  owner_bio: string | null
  private_header_bio: string | null
  presence_note: string | null
  render_policy_json: Record<string, unknown>
  render_fingerprint: string
  privacy_blocked: boolean
  diagnostics: AgentBioRenderDiagnostics
}

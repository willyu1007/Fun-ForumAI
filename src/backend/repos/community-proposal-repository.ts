import type {
  CommunityMergeRecommendation,
  CommunityProposal,
  CommunityProposalEvent,
  CreateCommunityProposalEventInput,
  CreateCommunityProposalInput,
  UpdateCommunityProposalInput,
  UpsertCommunityMergeRecommendationInput,
} from './types.js'
import {
  resolveCommunityInteractionContract,
} from '../../shared/semantic-taxonomy.js'

export interface CommunityProposalRepository {
  createProposal(input: CreateCommunityProposalInput): Promise<CommunityProposal>
  updateProposal(id: string, input: UpdateCommunityProposalInput): Promise<CommunityProposal | null>
  findProposalById(id: string): Promise<CommunityProposal | null>
  listProposals(opts?: { status?: CommunityProposal['status'] }): Promise<CommunityProposal[]>

  upsertRecommendation(
    input: UpsertCommunityMergeRecommendationInput,
  ): Promise<CommunityMergeRecommendation>
  findRecommendationByProposalId(proposalId: string): Promise<CommunityMergeRecommendation | null>

  createEvent(input: CreateCommunityProposalEventInput): Promise<CommunityProposalEvent>
  listEventsByProposalId(proposalId: string): Promise<CommunityProposalEvent[]>
}

let counter = 0
function cuid(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now()}_${counter}`
}

export class InMemoryCommunityProposalRepository implements CommunityProposalRepository {
  private proposals = new Map<string, CommunityProposal>()
  private recommendationsByProposalId = new Map<string, CommunityMergeRecommendation>()
  private eventsByProposalId = new Map<string, CommunityProposalEvent[]>()

  async createProposal(input: CreateCommunityProposalInput): Promise<CommunityProposal> {
    const now = new Date()
    const interaction = resolveCommunityInteractionContract({
      public_participation_mode: input.public_participation_mode,
      audience_signal_ingestion: input.audience_signal_ingestion,
      agent_human_response_mode: input.agent_human_response_mode,
    })
    const proposal: CommunityProposal = {
      id: cuid('community_proposal'),
      submitted_by_user_id: input.submitted_by_user_id,
      name: input.name,
      slug_candidate: input.slug_candidate,
      description: input.description,
      premise_text: input.premise_text,
      target_audience: input.target_audience ?? null,
      scene_types: input.scene_types ?? [],
      proposed_community_family: input.proposed_community_family,
      publication_review_profile_id: input.publication_review_profile_id,
      launch_wave: input.launch_wave ?? null,
      public_participation_mode: interaction.public_participation_mode,
      audience_signal_ingestion: interaction.audience_signal_ingestion,
      agent_human_response_mode: interaction.agent_human_response_mode,
      source_community_id: input.source_community_id ?? null,
      status: input.status ?? 'SUBMITTED',
      incubation_visibility_mode: input.incubation_visibility_mode ?? null,
      resulting_community_id: input.resulting_community_id ?? null,
      merged_into_community_id: input.merged_into_community_id ?? null,
      reviewed_by_user_id: input.reviewed_by_user_id ?? null,
      reviewed_at: input.reviewed_at ?? null,
      last_action: input.last_action ?? null,
      last_action_reason: input.last_action_reason ?? null,
      created_at: now,
      updated_at: now,
    }
    this.proposals.set(proposal.id, proposal)
    return proposal
  }

  async updateProposal(id: string, input: UpdateCommunityProposalInput): Promise<CommunityProposal | null> {
    const proposal = this.proposals.get(id)
    if (!proposal) return null
    if (input.status !== undefined) proposal.status = input.status
    if (input.proposed_community_family !== undefined) {
      proposal.proposed_community_family = input.proposed_community_family
    }
    if (input.publication_review_profile_id !== undefined) {
      proposal.publication_review_profile_id = input.publication_review_profile_id
    }
    if (input.launch_wave !== undefined) {
      proposal.launch_wave = input.launch_wave
    }
    if (
      input.public_participation_mode !== undefined
      || input.audience_signal_ingestion !== undefined
      || input.agent_human_response_mode !== undefined
    ) {
      const interaction = resolveCommunityInteractionContract({
        public_participation_mode: input.public_participation_mode ?? proposal.public_participation_mode,
        audience_signal_ingestion: input.audience_signal_ingestion ?? proposal.audience_signal_ingestion,
        agent_human_response_mode: input.agent_human_response_mode ?? proposal.agent_human_response_mode,
      })
      proposal.public_participation_mode = interaction.public_participation_mode
      proposal.audience_signal_ingestion = interaction.audience_signal_ingestion
      proposal.agent_human_response_mode = interaction.agent_human_response_mode
    }
    if (input.incubation_visibility_mode !== undefined) {
      proposal.incubation_visibility_mode = input.incubation_visibility_mode
    }
    if (input.resulting_community_id !== undefined) {
      proposal.resulting_community_id = input.resulting_community_id
    }
    if (input.merged_into_community_id !== undefined) {
      proposal.merged_into_community_id = input.merged_into_community_id
    }
    if (input.reviewed_by_user_id !== undefined) {
      proposal.reviewed_by_user_id = input.reviewed_by_user_id
    }
    if (input.reviewed_at !== undefined) {
      proposal.reviewed_at = input.reviewed_at
    }
    if (input.last_action !== undefined) {
      proposal.last_action = input.last_action
    }
    if (input.last_action_reason !== undefined) {
      proposal.last_action_reason = input.last_action_reason
    }
    proposal.updated_at = new Date()
    this.proposals.set(id, proposal)
    return proposal
  }

  async findProposalById(id: string): Promise<CommunityProposal | null> {
    return this.proposals.get(id) ?? null
  }

  async listProposals(opts?: { status?: CommunityProposal['status'] }): Promise<CommunityProposal[]> {
    return Array.from(this.proposals.values())
      .filter((proposal) => (opts?.status ? proposal.status === opts.status : true))
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
  }

  async upsertRecommendation(
    input: UpsertCommunityMergeRecommendationInput,
  ): Promise<CommunityMergeRecommendation> {
    const existing = this.recommendationsByProposalId.get(input.proposal_id)
    const now = new Date()
    const next: CommunityMergeRecommendation = {
      id: existing?.id ?? cuid('community_merge_recommendation'),
      proposal_id: input.proposal_id,
      duplicate_of_community_id: input.duplicate_of_community_id ?? null,
      recommended_as_lane_community_id: input.recommended_as_lane_community_id ?? null,
      recommended_as_seasonal: input.recommended_as_seasonal ?? true,
      incubation_visibility_mode: input.incubation_visibility_mode ?? 'GRAY',
      overlap_score: input.overlap_score ?? 0,
      rationale: input.rationale ?? [],
      decision_context: input.decision_context ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    this.recommendationsByProposalId.set(input.proposal_id, next)
    return next
  }

  async findRecommendationByProposalId(proposalId: string): Promise<CommunityMergeRecommendation | null> {
    return this.recommendationsByProposalId.get(proposalId) ?? null
  }

  async createEvent(input: CreateCommunityProposalEventInput): Promise<CommunityProposalEvent> {
    const event: CommunityProposalEvent = {
      id: cuid('community_proposal_event'),
      proposal_id: input.proposal_id,
      actor_type: input.actor_type,
      actor_id: input.actor_id,
      event_type: input.event_type,
      payload_json: input.payload_json ?? null,
      created_at: new Date(),
    }
    const list = this.eventsByProposalId.get(input.proposal_id) ?? []
    list.push(event)
    this.eventsByProposalId.set(input.proposal_id, list)
    return event
  }

  async listEventsByProposalId(proposalId: string): Promise<CommunityProposalEvent[]> {
    return [...(this.eventsByProposalId.get(proposalId) ?? [])]
      .sort((left, right) => left.created_at.getTime() - right.created_at.getTime())
  }
}

import { describe, expect, it } from 'vitest'
import { InMemorySearchDocRepository } from '../search-doc-repository.js'

function buildAgentDoc(input: {
  agent_id: string
  display_name: string
  searchable_text?: string
}) {
  return {
    agent_id: input.agent_id,
    display_name: input.display_name,
    avatar_url: null,
    status: 'ACTIVE',
    model: 'qwen-flash',
    persona_seed_code: 'scholar',
    persona_seed_label: '学者型',
    home_voice_line_id: 'qwen-social-v1',
    home_voice_line_label: 'Qwen Social v1',
    identity_contract_source: 'contract_v1',
    public_tagline: null,
    public_bio: null,
    public_badges: [],
    public_badges_text: '',
    active_membership_count: 0,
    active_community_ids: [],
    active_communities: [],
    active_community_names_text: '',
    follower_count: 0,
    public_activity_score: 0,
    public_projection_hint: null,
    top_chronicle_text: '',
    representative_post_text: '',
    representative_thread_turn_text: '',
    social_signal_text: '',
    searchable_text: input.searchable_text ?? input.display_name,
  }
}

describe('InMemorySearchDocRepository', () => {
  it('filters fuzzy multi-token matches that only share a common prefix', async () => {
    const repo = new InMemorySearchDocRepository()
    await repo.upsertAgentDoc(
      buildAgentDoc({
        agent_id: 'agent-target',
        display_name: 'SearchE2E search-real-123 target',
      }),
    )
    await repo.upsertAgentDoc(
      buildAgentDoc({
        agent_id: 'agent-distractor',
        display_name: 'SearchE2E search-real-456 alpha',
        searchable_text:
          'SearchE2E search-real-456 alpha Dialogue Stitch Connected fragmented viewpoints',
      }),
    )

    const page = await repo.searchAgentDocs({
      query: 'SearchE2E search-real-123 target',
      limit: 20,
    })

    expect(page.items.map((item) => item.doc.agent_id)).toEqual(['agent-target'])
    await expect(repo.countAgentDocs('SearchE2E search-real-123 target')).resolves.toBe(1)
  })

  it('keeps single-token typo-tolerant fuzzy matching', async () => {
    const repo = new InMemorySearchDocRepository()
    await repo.upsertAgentDoc(
      buildAgentDoc({
        agent_id: 'agent-alpha',
        display_name: 'alpha composer',
      }),
    )

    const page = await repo.searchAgentDocs({
      query: 'alphx',
      limit: 20,
    })

    expect(page.items.map((item) => item.doc.agent_id)).toEqual(['agent-alpha'])
  })

  it('matches agents on public bio text', async () => {
    const repo = new InMemorySearchDocRepository()
    await repo.upsertAgentDoc({
      ...buildAgentDoc({
        agent_id: 'agent-bio',
        display_name: 'Night Host',
        searchable_text: 'Night Host 会顺着梗把场子再抬半格',
      }),
      public_bio: '会顺着梗把场子再抬半格。',
    })

    const page = await repo.searchAgentDocs({
      query: '抬半格',
      limit: 20,
    })

    expect(page.items.map((item) => item.doc.agent_id)).toEqual(['agent-bio'])
    expect(page.items[0]?.doc.public_bio).toContain('抬半格')
  })
})

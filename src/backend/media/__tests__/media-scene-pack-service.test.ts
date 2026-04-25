import { describe, expect, it } from 'vitest'
import { InMemoryMediaScenePackRepository } from '../../repos/media-scene-pack-repository.js'
import { MediaScenePackService } from '../media-scene-pack-service.js'
import { BUILTIN_MEDIA_SCENE_PACKS } from '../media-scene-pack-seeds.js'
import { buildMediaSemanticSummary } from '../../test-utils/media-fixtures.js'

function createService() {
  return new MediaScenePackService({
    repo: new InMemoryMediaScenePackRepository(),
  })
}

describe('MediaScenePackService', () => {
  it('seeds 25 unique active scene packs with active versions', async () => {
    const service = createService()
    const packs = await service.listScenePacks()

    expect(packs).toHaveLength(25)
    expect(new Set(packs.map((pack) => pack.scene_id)).size).toBe(25)
    expect(packs.map((pack) => pack.scene_id).sort()).toEqual(
      BUILTIN_MEDIA_SCENE_PACKS.map((pack) => pack.scene_id).sort(),
    )
    expect(packs.every((pack) => pack.status === 'active' && pack.active_version_record)).toBe(true)
  })

  it('routes and compiles preview prompts through the selected scene pack', async () => {
    const service = createService()

    const route = await service.previewRoute({
      text: 'A travel itinerary scrapbook for a city route, map fragments, tickets, and day plan.',
    })
    expect(route.candidates[0]?.scene_id).toBe('itinerary_scrapbook_collage')

    const compile = await service.previewCompile({
      scene_id: 'itinerary_scrapbook_collage',
      text: 'A city trip route with map, tickets, coffee stop, and evening venue.',
      aspect_ratio_hint: '4:5',
    })
    expect(compile.compiled_prompt.template_id).toBe('scene-pack-prompt-compiler')
    expect(compile.compiled_prompt.scene_pack_ref).toEqual(expect.objectContaining({
      scene_id: 'itinerary_scrapbook_collage',
      version: 1,
    }))
    expect(compile.compiled_prompt.rendered_prompt).toContain('scene_pack: itinerary_scrapbook_collage@1')
    expect(compile.compiled_prompt.rendered_prompt).toContain('pack_system:')
  })

  it('creates draft versions and activates exactly one active version', async () => {
    const service = createService()
    const draft = await service.createDraftVersion({
      scene_id: 'desktop_workflow_photo',
      patch: {
        prompt_system:
          'Photograph a focused desktop workflow with concrete documents, tools, work-in-progress evidence, and quiet realistic lighting.',
      },
      created_by_user_id: 'admin-1',
    })
    expect(draft.status).toBe('draft')
    expect(draft.version).toBe(2)

    await service.updateDraftVersion({
      scene_id: 'desktop_workflow_photo',
      version: draft.version,
      patch: {
        quality_gate: {
          must_have: ['desktop workflow', 'work-in-progress evidence'],
          reject_if: ['generic stock-photo look', 'fake app logo'],
        },
      },
      updated_by_user_id: 'admin-1',
    })

    const activated = await service.activateVersion({
      scene_id: 'desktop_workflow_photo',
      version: draft.version,
    })
    expect(activated.active_version).toBe(2)
    expect(activated.active_version_record?.version).toBe(2)
    expect(activated.versions.filter((version) => version.status === 'active')).toHaveLength(1)
    expect(activated.versions.find((version) => version.version === 1)?.status).toBe('released')
  })

  it('audits generated snapshots without blocking generation output', async () => {
    const service = createService()
    const compile = await service.previewCompile({
      scene_id: 'fact_stack_news_card',
      text: 'A neutral explainer card with stacked facts and grounded context.',
    })
    const audit = service.auditGeneratedSnapshot({
      compiled_prompt: compile.compiled_prompt,
      snapshot: {
        id: 'snapshot-1',
        schema_version: 'visual_core.v1',
        summary: buildMediaSemanticSummary({
          scene: 'neutral editorial card',
          composition: 'stacked fact blocks over a grounded background cue',
          public_safe_summary: 'A neutral fact-stack card with clear hierarchy.',
          salient_entities: ['fact blocks', 'editorial card'],
          discussion_points: ['grounded context'],
        }),
      },
    })

    expect(audit.schema_version).toBe('scene-pack-quality-audit.v1')
    expect(audit.scene_pack_ref?.scene_id).toBe('fact_stack_news_card')
    expect(['pass', 'warn']).toContain(audit.status)
  })
})

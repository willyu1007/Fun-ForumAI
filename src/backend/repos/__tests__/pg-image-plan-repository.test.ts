import { describe, expect, it, vi } from 'vitest'
import { PgImagePlanRepository } from '../pg/pg-image-plan-repository.js'

function makeImagePlanRow() {
  return {
    id: 'plan-1',
    directiveId: 'directive-1',
    schemaVersion: 'image-plan.v1',
    sceneRef: { surface: 'post' },
    status: 'ready',
    decision: 'reuse',
    reason: 'recent match',
    runtime: { planner: 'test' },
    display: { attachments: [] },
    generation: { mode: 'none', input_mode: 'reference', status: 'not_requested', aspect_ratio_hint: null },
    selectedSources: [{ asset_id: 'asset-1' }],
    plannerAudit: { source: 'test' },
    createdAt: new Date('2026-04-10T00:00:00.000Z'),
    updatedAt: new Date('2026-04-10T00:00:00.000Z'),
  }
}

describe('PgImagePlanRepository', () => {
  it('builds a valid selected-source query without leaking sql fragment objects', async () => {
    const queryRaw = vi.fn(async () => [{ id: 'plan-1' }])
    const findMany = vi.fn(async () => [makeImagePlanRow()])
    const repo = new PgImagePlanRepository({
      $queryRaw: queryRaw,
      imagePlanRecord: { findMany },
    } as never)
    const since = new Date('2026-04-10T00:10:00.000Z')

    const result = await repo.listRecentBySelectedSourceAssetId('asset-1', {
      since,
      limit: 2,
    })

    expect(queryRaw).toHaveBeenCalled()
    const calls = queryRaw.mock.calls as unknown[][]
    const query = calls[0]?.[0] as unknown as {
      strings: string[]
      values: unknown[]
    }
    const sqlText = query.strings.join('?')

    expect(sqlText).toContain('WHERE EXISTS')
    expect(sqlText).toContain('jsonb_array_elements(selected_sources) AS source(value)')
    expect(sqlText).toContain("value ->> 'asset_id' = ")
    expect(sqlText).toContain('AND created_at >= ')
    expect(sqlText).not.toContain('[object Object]')
    expect(query.values).toEqual(['asset-1', since, 2])
    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['plan-1'] },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
    expect(result[0]?.id).toBe('plan-1')
  })
})

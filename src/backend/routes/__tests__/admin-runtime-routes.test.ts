import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import {
  adminToken,
  app,
  setupFeatureFlagGuard,
  userToken,
  withFeatureFlags,
} from './e2e-helpers.js'
import {
  agentRunRepo,
  llmConnectivityDiagnosticService,
  runtimeInfraSnapshotService,
  runtimeOperationRecordService,
  usageLedgerRepo,
} from '../../container.js'
import {
  parseRuntimeCloseoutFanoutOptions,
  resolveRuntimeCloseoutCandidateIds,
} from '../admin/runtime-closeout-fanout.js'
import {
  decodeRuntimeOperationCursor,
  encodeRuntimeOperationCursor,
  parseRuntimeOperationFilters,
} from '../admin/runtime-operation-records-filters.js'

setupFeatureFlagGuard()

describe('admin runtime closeout fanout helpers', () => {
  it('defaults to a single agent attempt unless fanout is explicitly enabled', () => {
    expect(parseRuntimeCloseoutFanoutOptions({})).toEqual({
      allowAgentFanout: false,
      maxAgentAttempts: 1,
    })
    expect(parseRuntimeCloseoutFanoutOptions({ max_agent_attempts: 3 })).toEqual({
      allowAgentFanout: false,
      maxAgentAttempts: 1,
    })
  })

  it('enables bounded agent fanout only when explicitly requested', () => {
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: 3,
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 3,
    })
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: '99',
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 5,
    })
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: 0,
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 1,
    })
  })

  it('limits candidate ids to the requested max attempts', () => {
    const ids = resolveRuntimeCloseoutCandidateIds({
      agentId: '',
      activeAgentIds: ['agent-a', 'agent-b', 'agent-c'],
      options: {
        allowAgentFanout: true,
        maxAgentAttempts: 2,
      },
    })

    expect(ids).toEqual(['agent-a', 'agent-b'])
  })

  it('bypasses active-agent discovery when agent_id is provided', () => {
    const ids = resolveRuntimeCloseoutCandidateIds({
      agentId: 'agent-fixed',
      activeAgentIds: ['agent-a', 'agent-b'],
      options: {
        allowAgentFanout: true,
        maxAgentAttempts: 5,
      },
    })

    expect(ids).toEqual(['agent-fixed'])
  })
})

// T-301 admin runtime operation records helpers
describe('parseRuntimeOperationFilters', () => {
  it('parses comma-separated severity / source / status into typed arrays', () => {
    const { filters, validationErrors } = parseRuntimeOperationFilters({
      severity: 'warn,error',
      source: 'runtime_loop,agent_executor',
      status: 'failed,retried',
    })
    expect(validationErrors).toEqual([])
    expect(filters.severity).toEqual(['warn', 'error'])
    expect(filters.source).toEqual(['runtime_loop', 'agent_executor'])
    expect(filters.status).toEqual(['failed', 'retried'])
  })

  it('rejects unknown severity / source / status values without crashing', () => {
    const { filters, validationErrors } = parseRuntimeOperationFilters({
      severity: 'fatal',
      source: 'unknown_source',
      status: 'flagged',
    })
    expect(validationErrors.map((e) => e.path).sort()).toEqual(['severity', 'source', 'status'])
    expect(filters.severity).toBeUndefined()
    expect(filters.source).toBeUndefined()
    expect(filters.status).toBeUndefined()
  })

  it('parses entity filter only when both entity_type and entity_id are present', () => {
    expect(
      parseRuntimeOperationFilters({ entity_type: 'post', entity_id: 'p1' }).filters.entity,
    ).toEqual({ type: 'post', id: 'p1' })
    expect(
      parseRuntimeOperationFilters({ entity_type: 'post' }).validationErrors,
    ).toContainEqual({ path: 'entity_type', message: 'entity_type and entity_id must both be provided' })
    expect(
      parseRuntimeOperationFilters({ entity_type: 'unknown', entity_id: 'x' }).validationErrors[0]?.path,
    ).toBe('entity_type')
  })

  it('caps limit at 100 and rejects non-positive values', () => {
    expect(parseRuntimeOperationFilters({ limit: '500' }).filters.limit).toBe(100)
    expect(parseRuntimeOperationFilters({ limit: '20' }).filters.limit).toBe(20)
    const errs = parseRuntimeOperationFilters({ limit: '0' }).validationErrors
    expect(errs[0]?.path).toBe('limit')
  })

  it('parses since/until ISO timestamps', () => {
    const { filters, validationErrors } = parseRuntimeOperationFilters({
      since: '2026-04-25T00:00:00Z',
      until: '2026-04-26T00:00:00Z',
    })
    expect(validationErrors).toEqual([])
    expect(filters.since?.toISOString()).toBe('2026-04-25T00:00:00.000Z')
    expect(filters.until?.toISOString()).toBe('2026-04-26T00:00:00.000Z')
  })

  it('rejects invalid since/until timestamps', () => {
    const errs = parseRuntimeOperationFilters({ since: 'not-a-date' }).validationErrors
    expect(errs[0]?.path).toBe('since')
  })
})

describe('runtime operation cursor helpers', () => {
  it('round-trips an occurred_at + id pair through base64url', () => {
    const at = new Date('2026-04-27T12:34:56.789Z')
    const cursor = encodeRuntimeOperationCursor({ occurred_at: at, id: 'rec-1' })
    const decoded = decodeRuntimeOperationCursor(cursor)
    expect(decoded).not.toBeNull()
    expect(decoded!.occurred_at.toISOString()).toBe('2026-04-27T12:34:56.789Z')
    expect(decoded!.id).toBe('rec-1')
  })

  it('returns null for malformed cursors', () => {
    expect(decodeRuntimeOperationCursor('not-base64!!')).toBeNull()
    expect(decodeRuntimeOperationCursor(Buffer.from('garbage').toString('base64url'))).toBeNull()
    expect(
      decodeRuntimeOperationCursor(Buffer.from(JSON.stringify({ at: 'bad', id: 'x' })).toString('base64url')),
    ).toBeNull()
  })

  it('exposes the parsed cursor through parseRuntimeOperationFilters', () => {
    const cursor = encodeRuntimeOperationCursor({ occurred_at: new Date('2026-04-27T00:00:00Z'), id: 'rec-1' })
    const { filters, validationErrors } = parseRuntimeOperationFilters({ cursor })
    expect(validationErrors).toEqual([])
    expect(filters.before).toBeDefined()
    expect(filters.before!.id).toBe('rec-1')
  })
})

describe('admin runtime operation records endpoints', () => {
  it('requires admin auth and the backend UI flag', async () => {
    await withFeatureFlags({ adminRuntimeRecordsUi: true }, async () => {
      const unauthorized = await request(app).get('/v1/admin/runtime/operation-records')
      expect(unauthorized.status).toBe(401)

      const forbidden = await request(app)
        .get('/v1/admin/runtime/operation-records')
        .set('Authorization', `Bearer ${userToken}`)
      expect(forbidden.status).toBe(403)
    })

    await withFeatureFlags({ adminRuntimeRecordsUi: false }, async () => {
      const disabled = await request(app)
        .get('/v1/admin/runtime/operation-records')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(disabled.status).toBe(403)
      expect(disabled.body.error.code).toBe('FORBIDDEN')
    })
  })

  it('lists records with deterministic cursor pagination and no false cursor on an exact page', async () => {
    await withFeatureFlags({
      adminRuntimeRecordsUi: true,
      runtimeOperationRecordsWrite: true,
    }, async () => {
      const traceWithMore = `t301-route-more-${Date.now()}`
      await runtimeOperationRecordService.record({
        id: `${traceWithMore}-1`,
        occurred_at: new Date('2026-04-27T00:00:01.000Z'),
        severity: 'error',
        source: 'runtime_loop',
        operation: 'older',
        status: 'failed',
        trace_id: traceWithMore,
      })
      await runtimeOperationRecordService.record({
        id: `${traceWithMore}-2`,
        occurred_at: new Date('2026-04-27T00:00:02.000Z'),
        severity: 'error',
        source: 'runtime_loop',
        operation: 'middle',
        status: 'failed',
        trace_id: traceWithMore,
      })
      await runtimeOperationRecordService.record({
        id: `${traceWithMore}-3`,
        occurred_at: new Date('2026-04-27T00:00:03.000Z'),
        severity: 'error',
        source: 'runtime_loop',
        operation: 'newer',
        status: 'failed',
        trace_id: traceWithMore,
      })

      const firstPage = await request(app)
        .get('/v1/admin/runtime/operation-records')
        .query({ trace_id: traceWithMore, limit: 2 })
        .set('Authorization', `Bearer ${adminToken}`)
      expect(firstPage.status).toBe(200)
      expect(firstPage.body.data.records.map((row: { id: string }) => row.id)).toEqual([
        `${traceWithMore}-3`,
        `${traceWithMore}-2`,
      ])
      expect(firstPage.body.data.next_cursor).toEqual(expect.any(String))

      const traceExact = `t301-route-exact-${Date.now()}`
      await runtimeOperationRecordService.record({
        id: `${traceExact}-1`,
        occurred_at: new Date('2026-04-27T00:01:01.000Z'),
        severity: 'warn',
        source: 'system',
        operation: 'first',
        status: 'failed',
        trace_id: traceExact,
      })
      await runtimeOperationRecordService.record({
        id: `${traceExact}-2`,
        occurred_at: new Date('2026-04-27T00:01:02.000Z'),
        severity: 'warn',
        source: 'system',
        operation: 'second',
        status: 'failed',
        trace_id: traceExact,
      })

      const exactPage = await request(app)
        .get('/v1/admin/runtime/operation-records')
        .query({ trace_id: traceExact, limit: 2 })
        .set('Authorization', `Bearer ${adminToken}`)
      expect(exactPage.status).toBe(200)
      expect(exactPage.body.data.records).toHaveLength(2)
      expect(exactPage.body.data.next_cursor).toBeNull()
    })
  })

  it('returns detail references stitched from AgentRun and LLM usage ledger', async () => {
    await withFeatureFlags({
      adminRuntimeRecordsUi: true,
      runtimeOperationRecordsWrite: true,
    }, async () => {
      const traceId = `runtime:t301-detail-${Date.now()}:agent-1`
      const run = agentRunRepo.create({
        agent_id: 'agent-1',
        trigger_event_id: 'evt-t301-detail',
        input_digest: 'parse_failed|test',
        token_cost: 9,
        latency_ms: 14,
      })
      await usageLedgerRepo.insert({
        trace_id: traceId,
        agent_id: 'agent-1',
        intent: 'forum_reply',
        visibility: 'visible',
        scene: 'forum_post',
        prompt_ref: { id: 'agent-forum-reply', version: 1 },
        render_decision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'qwen-social-forum-reply-base',
          providerId: 'dashscope-openai',
          modelId: 'qwen3.5-plus',
          region: 'cn-beijing',
          endpointId: 'dashscope-cn-beijing',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-forum-reply',
          promptVersion: 1,
        },
        success: false,
        provider_id: 'dashscope-openai',
        model_id: 'qwen3.5-plus',
        profile_id: 'qwen-social-forum-reply-base',
        policy_id: 'visible-forum_reply-base',
        billing_class: 'visible_standard',
        error_code: 'InvalidRequestError',
        latency_ms: 22,
        created_at: new Date().toISOString(),
      })

      const record = await runtimeOperationRecordService.record({
        severity: 'warn',
        source: 'agent_executor',
        operation: 'parse_output',
        status: 'failed',
        trace_id: traceId,
        linked_llm_trace_id: traceId,
        linked_agent_run_id: run.id,
        error_code: 'parse_failed',
      })

      const detail = await request(app)
        .get(`/v1/admin/runtime/operation-records/${record!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(detail.status).toBe(200)
      expect(detail.body.data.references.agent_run).toMatchObject({
        id: run.id,
        agent_id: 'agent-1',
        trigger_event_id: 'evt-t301-detail',
      })
      expect(detail.body.data.references.llm_ledger).toEqual([
        expect.objectContaining({
          trace_id: traceId,
          provider_id: 'dashscope-openai',
          model_id: 'qwen3.5-plus',
          error_code: 'InvalidRequestError',
        }),
      ])
    })
  })

  it('proxies infra snapshot and LLM connectivity diagnostics through admin endpoints', async () => {
    await withFeatureFlags({ adminRuntimeRecordsUi: true }, async () => {
      const snapshotSpy = vi.spyOn(runtimeInfraSnapshotService, 'snapshot').mockResolvedValue({
        generated_at: '2026-04-27T00:00:00.000Z',
        poll_interval_ms: 15_000,
        overall_status: 'warn',
        sections: {
          process: { status: 'ok', summary: 'ok' },
          http: { status: 'unknown', summary: 'missing counters' },
          postgres: { status: 'critical', error_code: 'postgres_ping_failed' },
          redisQueue: { status: 'skipped' },
          sse: { status: 'ok' },
          llm: { status: 'ok' },
          storageMedia: { status: 'unknown' },
        },
      })
      const listSpy = vi.spyOn(llmConnectivityDiagnosticService, 'list').mockReturnValue({
        manual_tests_auto_polled: false,
        rows: [
          {
            route_id: 'profile|provider|model|region|endpoint',
            provider_id: 'provider',
            model_id: 'model',
            model_name: 'model',
            model_version: null,
            profile_id: 'profile',
            voice_line_id: 'qwen-social-v1',
            policy_id: 'policy',
            intent: 'forum_reply',
            visibility: 'visible',
            tier: 'base',
            credential_pool_id: 'pool',
            adapter_id: 'adapter',
            endpoint_id: 'endpoint',
            region: 'region',
            admission: 'admitted',
            shadow_dimensions: [],
          },
        ],
      })
      const testSpy = vi.spyOn(llmConnectivityDiagnosticService, 'test').mockResolvedValue({
        results: [
          {
            route_id: 'profile|provider|model|region|endpoint',
            status: 'ok',
            latency_ms: 12,
            tested_at: '2026-04-27T00:00:01.000Z',
            error_code: null,
            error_message_redacted: null,
          },
        ],
      })

      const infra = await request(app)
        .get('/v1/admin/runtime/infra-snapshot')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(infra.status).toBe(200)
      expect(infra.body.data.sections.postgres.status).toBe('critical')

      const list = await request(app)
        .get('/v1/admin/runtime/llm-connectivity')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(list.status).toBe(200)
      expect(list.body.data.rows[0]).toMatchObject({
        route_id: 'profile|provider|model|region|endpoint',
        adapter_id: 'adapter',
      })

      const tested = await request(app)
        .post('/v1/admin/runtime/llm-connectivity/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ route_ids: ['profile|provider|model|region|endpoint'] })
      expect(tested.status).toBe(200)
      expect(tested.body.data.results[0].status).toBe('ok')
      expect(testSpy).toHaveBeenCalledWith({
        scope: undefined,
        route_ids: ['profile|provider|model|region|endpoint'],
      })

      snapshotSpy.mockRestore()
      listSpy.mockRestore()
      testSpy.mockRestore()
    })
  })
})

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeRecordsPage } from '../RuntimeRecordsPage'
import {
  useAdminRuntimeInfraSnapshot,
  useAdminRuntimeLlmConnectivity,
  useAdminRuntimeLlmConnectivityTest,
  useAdminRuntimeOperationRecord,
  useAdminRuntimeOperationRecords,
} from '@/api/hooks/admin'
import { useAuth } from '@/shared/hooks/use-auth'
import type {
  InfraSnapshotData,
  LlmConnectivityRow,
  LlmConnectivityTestResult,
  RuntimeOperationRecord,
} from '@/api/types'

const capabilityState = vi.hoisted(() => ({
  adminRuntimeRecordsUiEnabled: true,
}))

vi.mock('@/shared/config/frontend-capabilities', () => ({
  get adminRuntimeRecordsUiEnabled() {
    return capabilityState.adminRuntimeRecordsUiEnabled
  },
  FRONTEND_LAUNCH_CAPABILITIES: {
    get adminRuntimeRecordsUi() {
      return capabilityState.adminRuntimeRecordsUiEnabled
    },
  },
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/api/hooks/admin', () => ({
  useAdminRuntimeOperationRecords: vi.fn(),
  useAdminRuntimeOperationRecord: vi.fn(),
  useAdminRuntimeInfraSnapshot: vi.fn(),
  useAdminRuntimeLlmConnectivity: vi.fn(),
  useAdminRuntimeLlmConnectivityTest: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)
const useAdminRuntimeOperationRecordsMock = vi.mocked(useAdminRuntimeOperationRecords)
const useAdminRuntimeOperationRecordMock = vi.mocked(useAdminRuntimeOperationRecord)
const useAdminRuntimeInfraSnapshotMock = vi.mocked(useAdminRuntimeInfraSnapshot)
const useAdminRuntimeLlmConnectivityMock = vi.mocked(useAdminRuntimeLlmConnectivity)
const useAdminRuntimeLlmConnectivityTestMock = vi.mocked(useAdminRuntimeLlmConnectivityTest)
let llmConnectivityMutateAsyncMock: ReturnType<typeof vi.fn>

const now = '2026-04-27T08:00:00.000Z'

const baseRecord: RuntimeOperationRecord = {
  id: 'record-1',
  occurred_at: now,
  severity: 'error',
  source: 'agent_executor',
  operation: 'parse_output',
  status: 'failed',
  trace_id: 'runtime:event-1:agent-1',
  correlation_id: null,
  event_id: 'event-1',
  agent_id: 'agent-1',
  community_id: 'community-1',
  post_id: null,
  room_id: null,
  session_id: null,
  message_id: null,
  linked_agent_run_id: 'agent-run-1',
  linked_llm_trace_id: 'runtime:event-1:agent-1',
  linked_risk_event_id: null,
  duration_ms: 35,
  error_code: 'parse_failed',
  error_message_redacted: 'LLM output could not be parsed',
  retry_count: null,
  payload_json: { parse_success: false },
  created_at: now,
}

const infraSnapshot: InfraSnapshotData = {
  generated_at: now,
  poll_interval_ms: 15_000,
  overall_status: 'warn',
  sections: {
    process: { status: 'ok', summary: 'pid 123' },
    http: { status: 'ok', latency_ms: 2, summary: 'ok' },
    postgres: {
      status: 'critical',
      latency_ms: 15,
      summary: 'unavailable',
      error_message_redacted: 'connect ECONNREFUSED',
    },
    redisQueue: { status: 'skipped', summary: 'not configured' },
    sse: { status: 'ok', summary: 'local backend' },
    llm: { status: 'warn', summary: 'one route failed' },
    storageMedia: { status: 'unknown', summary: 'not checked' },
  },
}

const llmRow: LlmConnectivityRow = {
  route_id: 'route-1',
  provider_id: 'dashscope-openai',
  model_id: 'qwen-plus',
  model_name: 'Qwen Plus',
  model_version: '2026-04',
  profile_id: 'qwen-social-proactive-opening-base',
  voice_line_id: 'qwen-social-v1',
  policy_id: 'visible-proactive_opening-base',
  intent: 'proactive_opening',
  visibility: 'visible',
  tier: 'base',
  credential_pool_id: 'dashscope-visible-default',
  adapter_id: 'openai-chat-completions-v1',
  endpoint_id: 'dashscope-cn-beijing',
  region: 'cn-beijing',
  admission: 'admitted',
  shadow_dimensions: [],
}

const llmResult: LlmConnectivityTestResult = {
  route_id: 'route-1',
  status: 'ok',
  latency_ms: 42,
  tested_at: now,
  error_code: null,
  error_message_redacted: null,
}

function installDefaultMocks(options: {
  identity?: 'admin' | 'user' | null
  records?: RuntimeOperationRecord[]
  writeEnabled?: boolean
  infraError?: boolean
  llmRows?: LlmConnectivityRow[]
} = {}) {
  useAuthMock.mockReturnValue({
    currentIdentity: options.identity ?? 'admin',
  } as never)
  useAdminRuntimeOperationRecordsMock.mockReturnValue({
    data: {
      data: {
        records: options.records ?? [baseRecord],
        next_cursor: null,
        filters: {},
        write_enabled: options.writeEnabled ?? true,
        retention_policy: {
          error_critical_days: 30,
          warn_days: 14,
          info_days: 7,
          governance_linked: '90d',
        },
      },
    },
    isError: false,
  } as never)
  useAdminRuntimeOperationRecordMock.mockImplementation((id) => ({
    data: id
      ? {
          data: {
            record: baseRecord,
            references: {
              agent_run: { id: 'agent-run-1', agent_id: 'agent-1' },
              llm_ledger: [{ trace_id: 'runtime:event-1:agent-1', success: false }],
            },
            payload_summary: {
              payload: { parse_success: false },
              redaction_meta: null,
            },
          },
        }
      : undefined,
    isPending: false,
    isError: false,
  } as never))
  useAdminRuntimeInfraSnapshotMock.mockReturnValue({
    data: options.infraError ? undefined : { data: infraSnapshot },
    isError: options.infraError ?? false,
  } as never)
  useAdminRuntimeLlmConnectivityMock.mockReturnValue({
    data: {
      data: {
        rows: options.llmRows ?? [llmRow],
        manual_tests_auto_polled: false,
      },
    },
    isError: false,
  } as never)
  llmConnectivityMutateAsyncMock = vi.fn(async () => ({ data: { results: [llmResult] } }))
  useAdminRuntimeLlmConnectivityTestMock.mockReturnValue({
    mutateAsync: llmConnectivityMutateAsyncMock,
    isPending: false,
  } as never)
}

describe('RuntimeRecordsPage', () => {
  beforeEach(() => {
    capabilityState.adminRuntimeRecordsUiEnabled = true
    installDefaultMocks()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('gates the page by admin identity and frontend launch flag', () => {
    installDefaultMocks({ identity: 'user' })
    render(<RuntimeRecordsPage />)
    expect(screen.getByText('请先以管理员身份登录。')).toBeTruthy()

    cleanup()
    capabilityState.adminRuntimeRecordsUiEnabled = false
    installDefaultMocks({ identity: 'admin' })
    render(<RuntimeRecordsPage />)
    expect(screen.getByText(/运行记录控制台功能未启用/)).toBeTruthy()
  })

  it('renders filters, partial infra failures, detail stitching, and LLM manual results', async () => {
    render(<RuntimeRecordsPage />)

    expect(screen.getByText('write_enabled=true')).toBeTruthy()
    expect(screen.getByText('connect ECONNREFUSED')).toBeTruthy()
    expect(screen.getByText('qwen-social-proactive-opening-base')).toBeTruthy()
    expect(screen.getByText('parse_output')).toBeTruthy()

    const traceFilter = screen.getAllByRole('textbox')[0]
    fireEvent.change(traceFilter, { target: { value: 'runtime:event-1' } })
    expect(useAdminRuntimeOperationRecordsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ trace_id: 'runtime:event-1' }),
      expect.objectContaining({ enabled: true }),
    )

    fireEvent.click(screen.getByText('parse_output'))
    expect(await screen.findByText('运行记录详情')).toBeTruthy()
    expect(screen.getAllByText(/agent-run-1/).length).toBeGreaterThan(0)
    expect(screen.getByText(/llm_ledger/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '测试' }))
    await waitFor(() => {
      expect(llmConnectivityMutateAsyncMock).toHaveBeenCalledWith({
        route_ids: ['route-1'],
      })
    })
    expect(await screen.findByText(/42ms/)).toBeTruthy()
    expect(screen.getAllByText('ok').length).toBeGreaterThan(0)
  })

  it('renders empty and disabled states', () => {
    installDefaultMocks({
      records: [],
      writeEnabled: false,
      infraError: true,
      llmRows: [],
    })
    render(<RuntimeRecordsPage />)

    expect(screen.getByText('write_enabled=false')).toBeTruthy()
    expect(screen.getByText('Failed to load infra snapshot.')).toBeTruthy()
    expect(screen.getByText('暂无 admitted 路由。')).toBeTruthy()
    expect(screen.getByText(/后端写 flag/)).toBeTruthy()
    expect(screen.getByText('没有匹配的运行记录。')).toBeTruthy()
  })
})

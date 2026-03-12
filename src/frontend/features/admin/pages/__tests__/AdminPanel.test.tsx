import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPanel } from '../AdminPanel'
import type {
  ComplaintTicket,
  ReviewCaseDetail,
  ReviewEvidenceExport,
} from '@/api/types'
import {
  useAssignModerationCase,
  useClaimModerationTask,
  useGovernanceAction,
  useHealth,
  useIdentityReviews,
  useModerationCase,
  useModerationEvidenceExport,
  useModerationQueue,
  useReleaseModerationCase,
  useReopenModerationCase,
  useResolveIdentityReview,
  useResolveModerationCase,
  useTransferModerationCase,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('../components/RuntimeDashboard', () => ({
  RuntimeDashboard: () => <div>Runtime dashboard stub</div>,
}))

vi.mock('@/api/hooks', () => ({
  useAssignModerationCase: vi.fn(),
  useClaimModerationTask: vi.fn(),
  useGovernanceAction: vi.fn(),
  useHealth: vi.fn(),
  useIdentityReviews: vi.fn(),
  useModerationCase: vi.fn(),
  useModerationEvidenceExport: vi.fn(),
  useModerationQueue: vi.fn(),
  useReleaseModerationCase: vi.fn(),
  useReopenModerationCase: vi.fn(),
  useResolveIdentityReview: vi.fn(),
  useResolveModerationCase: vi.fn(),
  useTransferModerationCase: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useAssignModerationCaseMock = vi.mocked(useAssignModerationCase)
const useClaimModerationTaskMock = vi.mocked(useClaimModerationTask)
const useGovernanceActionMock = vi.mocked(useGovernanceAction)
const useHealthMock = vi.mocked(useHealth)
const useIdentityReviewsMock = vi.mocked(useIdentityReviews)
const useModerationCaseMock = vi.mocked(useModerationCase)
const useModerationEvidenceExportMock = vi.mocked(useModerationEvidenceExport)
const useModerationQueueMock = vi.mocked(useModerationQueue)
const useReleaseModerationCaseMock = vi.mocked(useReleaseModerationCase)
const useReopenModerationCaseMock = vi.mocked(useReopenModerationCase)
const useResolveIdentityReviewMock = vi.mocked(useResolveIdentityReview)
const useResolveModerationCaseMock = vi.mocked(useResolveModerationCase)
const useTransferModerationCaseMock = vi.mocked(useTransferModerationCase)
const useAuthMock = vi.mocked(useAuth)

const linkedComplaint: ComplaintTicket = {
  id: 'complaint-1',
  reporter_user_id: 'user-1',
  target_type: 'post',
  target_id: 'post-1',
  complaint_type: 'PRIVACY_REQUEST',
  reason_code: 'privacy_request',
  detail_text: 'contains personal data',
  attachments: [{ ref: 'attachment-1', type: 'image' }],
  status: 'LINKED',
  linked_case_id: 'case-1',
  resolution: null,
  created_at: '2026-03-12T10:00:00.000Z',
  updated_at: '2026-03-12T10:05:00.000Z',
}

const caseDetail: ReviewCaseDetail = {
  case: {
    id: 'case-1',
    case_type: 'COMPLAINT',
    queue: 'PRIVACY',
    status: 'IN_REVIEW',
    priority: 95,
    summary_text: 'Privacy complaint',
    risk_summary: { complaint_type: 'PRIVACY_REQUEST' },
    opened_reason: 'user_report',
    opened_by: 'user-1',
    primary_target_type: 'post',
    primary_target_id: 'post-1',
    assigned_to_user_id: 'operator-1',
    sla_due_at: '2026-03-13T10:00:00.000Z',
    claimed_by_user_id: 'operator-1',
    claimed_at: '2026-03-12T10:10:00.000Z',
    linked_policy_snapshot_id: null,
    linked_complaint_ticket_id: linkedComplaint.id,
    linked_appeal_request_id: null,
    resolution_action: null,
    resolved_by_user_id: null,
    resolution_note: null,
    resolved_at: null,
    created_at: '2026-03-12T10:00:00.000Z',
    updated_at: '2026-03-12T10:10:00.000Z',
  },
  targets: [{
    id: 'target-1',
    case_id: 'case-1',
    target_type: 'post',
    target_id: 'post-1',
    relation_type: 'PRIMARY',
    channel: 'report',
    meta: { source: 'post_detail' },
    community_id: 'community-1',
    agent_id: null,
    user_id: 'user-1',
    room_id: null,
    session_id: null,
    message_id: null,
    created_at: '2026-03-12T10:00:00.000Z',
  }],
  evidence: [{
    id: 'evidence-1',
    case_id: 'case-1',
    snapshot_type: 'complaint_ticket',
    payload: { complaint_id: linkedComplaint.id },
    content: { body: 'contains personal data' },
    context: { reporter_user_id: 'user-1' },
    policy_hits: { rules: ['privacy_request'] },
    prompt_memory: { memory_excerpt: 'sensitive data' },
    topic_signals: null,
    action_history: { actor_user_id: 'operator-1' },
    evidence_package: {
      content: { body: 'contains personal data' },
      context: { reporter_user_id: 'user-1' },
    },
    created_at: '2026-03-12T10:00:00.000Z',
  }],
  tasks: [{
    id: 'task-1',
    case_id: 'case-1',
    queue: 'PRIVACY',
    task_type: 'INITIAL_REVIEW',
    status: 'ASSIGNED',
    assignee_user_id: 'operator-1',
    claim_token: 'claim-token-1',
    claimed_by_user_id: 'operator-1',
    claimed_at: '2026-03-12T10:10:00.000Z',
    assigned_role: 'privacy_reviewer',
    due_at: '2026-03-13T10:00:00.000Z',
    resolution_code: null,
    operator_note: null,
    completed_at: null,
    created_at: '2026-03-12T10:00:00.000Z',
    updated_at: '2026-03-12T10:10:00.000Z',
  }],
  linked_complaint: linkedComplaint,
  linked_appeal: null,
}

const operatorExport: ReviewEvidenceExport = {
  case: caseDetail.case,
  linked_complaint: linkedComplaint,
  linked_appeal: null,
  targets: caseDetail.targets,
  tasks: caseDetail.tasks,
  action_logs: [],
  redaction_level: 'operator',
  redaction_notes: [],
  evidence: [{
    id: 'evidence-1',
    snapshot_type: 'complaint_ticket',
    evidence_package: {
      content: { body: 'contains personal data' },
      prompt_memory: { memory_excerpt: 'sensitive data' },
    },
    created_at: '2026-03-12T10:00:00.000Z',
  }],
  exported_at: '2026-03-12T10:20:00.000Z',
}

const shareExport: ReviewEvidenceExport = {
  ...operatorExport,
  redaction_level: 'share',
  redaction_notes: ['share export 已隐藏原文、prompt/memory 与用户标识。'],
  linked_complaint: {
    ...linkedComplaint,
    reporter_user_id: '[REDACTED]',
    detail_text: '[REDACTED]',
  },
  evidence: [{
    id: 'evidence-1',
    snapshot_type: 'complaint_ticket',
    evidence_package: {
      content: { redacted: true },
      prompt_memory: { redacted: true },
      context: { reporter_user_id: '[REDACTED]' },
    },
    created_at: '2026-03-12T10:20:00.000Z',
  }],
}

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuthMock.mockReturnValue({
      currentIdentity: 'admin',
      user: { id: 'admin-1' },
    } as never)
    useHealthMock.mockReturnValue({
      data: {
        data: {
          status: 'ok',
          uptime: 123,
        },
      },
    } as never)
    useGovernanceActionMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never)
    useModerationQueueMock.mockReturnValue({
      data: {
        data: [{
          id: 'case-1',
          case_type: 'COMPLAINT',
          queue: 'PRIVACY',
          status: 'IN_REVIEW',
          priority: 95,
          summary_text: 'Privacy complaint',
          assigned_to_user_id: 'operator-1',
        }],
      },
    } as never)
    useIdentityReviewsMock.mockReturnValue({
      data: { data: [] },
    } as never)
    useAssignModerationCaseMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useClaimModerationTaskMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useTransferModerationCaseMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useReleaseModerationCaseMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useResolveModerationCaseMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useReopenModerationCaseMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useResolveIdentityReviewMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useModerationCaseMock.mockImplementation((caseId) => (
      caseId
        ? { data: { data: caseDetail } }
        : { data: undefined }
    ) as never)
    useModerationEvidenceExportMock.mockImplementation((caseId, redaction = 'operator') => (
      caseId
        ? {
            data: { data: redaction === 'share' ? shareExport : operatorExport },
            refetch: vi.fn().mockResolvedValue({
              data: { data: redaction === 'share' ? shareExport : operatorExport },
            }),
          }
        : { data: undefined, refetch: vi.fn() }
    ) as never)
  })

  it('renders queue SOP copy, supports release, and switches evidence export redaction', async () => {
    const releaseMutate = vi.fn()
    useReleaseModerationCaseMock.mockReturnValue({
      mutate: releaseMutate,
      isPending: false,
    } as never)

    render(<AdminPanel />)

    const queueButton = screen.getByText('COMPLAINT · Privacy complaint').closest('button')
    expect(queueButton).toBeTruthy()
    fireEvent.click(queueButton!)

    expect(screen.getByText('Queue Playbook')).toBeTruthy()
    expect(screen.getByText('优先确认个人信息范围与暴露面，能删字段就不要放大处置。')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('转派备注（选填）'), {
      target: { value: 'return to pool' },
    })
    fireEvent.click(screen.getByRole('button', { name: '释放回队列' }))

    expect(releaseMutate).toHaveBeenCalledWith({
      case_id: 'case-1',
      operator_note: 'return to pool',
    })

    const exportTab = screen.getByRole('tab', { name: '导出' })
    fireEvent.mouseDown(exportTab)
    fireEvent.click(exportTab)

    const selects = document.querySelectorAll('select')
    expect(selects.length).toBeGreaterThan(2)

    fireEvent.change(selects[2]!, {
      target: { value: 'share' },
    })

    await waitFor(() => {
      expect(useModerationEvidenceExportMock).toHaveBeenLastCalledWith('case-1', 'share')
    })

    expect(screen.getByText('share export 已隐藏原文、prompt/memory 与用户标识。')).toBeTruthy()
    expect(screen.getByText((_, node) => node?.textContent === 'redaction share')).toBeTruthy()
  })
})

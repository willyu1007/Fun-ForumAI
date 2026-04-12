import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPanel } from '../AdminPanel'
import type { ComplaintTicket, ReviewCaseDetail, ReviewEvidenceExport } from '@/api/types'
import {
  useAdminAgentRiskProfile,
  useAdminCommunityProposals,
  useAdminHotTopicAlerts,
  useAdminHotTopicDashboard,
  useAdminLaunchProgrammingOps,
  useAdminHotTopicPostDistribution,
  useAdminHotTopicRoomControl,
  useAdminWarmupSuiteDetail,
  useAdminWarmupSuites,
  useApplyCommunityProposalAction,
  useApplyCommunityHotTopicPolicy,
  useArchiveAdminWarmupSuite,
  useAssignModerationCase,
  useClaimModerationTask,
  useCreateAdminWarmupSuite,
  useCreateDisclosureCapOverride,
  useDisclosureCaps,
  useExecuteAdminWarmupGovernanceBatch,
  useGovernanceAction,
  useHealth,
  useIdentityReviews,
  useModerationCase,
  useModerationEvidenceExport,
  useModerationQueue,
  usePreviewAdminWarmupGovernanceBatch,
  useRebuildAdminWarmupSuite,
  useReleaseDisclosureCapOverride,
  useReleaseModerationCase,
  useReopenModerationCase,
  useReviewAdminWarmupSuite,
  useRetryAdminWarmupSuite,
  useResolveIdentityReview,
  useResolveModerationCase,
  useRefreshCommunityProposalRecommendation,
  useTransferModerationCase,
  useCommunities,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('../components/RuntimeDashboard', () => ({
  RuntimeDashboard: () => <div>Runtime dashboard stub</div>,
}))

vi.mock('../admin-panel/InviteCodesTab', () => ({
  InviteCodesTab: () => <div>Invite codes tab stub</div>,
}))

vi.mock('../admin-panel/AdminUsersTab', () => ({
  AdminUsersTab: () => <div>Admin users tab stub</div>,
}))

vi.mock('../admin-panel/WarmupGovernanceTab', () => ({
  WarmupGovernanceTab: () => <div>Warmup tab stub</div>,
}))

vi.mock('@/api/hooks', () => ({
  useAdminAgentRiskProfile: vi.fn(),
  useAdminCommunityProposals: vi.fn(),
  useAdminHotTopicAlerts: vi.fn(),
  useAdminHotTopicDashboard: vi.fn(),
  useAdminLaunchProgrammingOps: vi.fn(),
  useAdminHotTopicPostDistribution: vi.fn(),
  useAdminHotTopicRoomControl: vi.fn(),
  useAdminWarmupSuiteDetail: vi.fn(),
  useAdminWarmupSuites: vi.fn(),
  useApplyCommunityProposalAction: vi.fn(),
  useApplyCommunityHotTopicPolicy: vi.fn(),
  useArchiveAdminWarmupSuite: vi.fn(),
  useAssignModerationCase: vi.fn(),
  useClaimModerationTask: vi.fn(),
  useCreateAdminWarmupSuite: vi.fn(),
  useCreateDisclosureCapOverride: vi.fn(),
  useDisclosureCaps: vi.fn(),
  useExecuteAdminWarmupGovernanceBatch: vi.fn(),
  useGovernanceAction: vi.fn(),
  useHealth: vi.fn(),
  useIdentityReviews: vi.fn(),
  useModerationCase: vi.fn(),
  useModerationEvidenceExport: vi.fn(),
  useModerationQueue: vi.fn(),
  usePreviewAdminWarmupGovernanceBatch: vi.fn(),
  useRebuildAdminWarmupSuite: vi.fn(),
  useReleaseDisclosureCapOverride: vi.fn(),
  useReleaseModerationCase: vi.fn(),
  useReopenModerationCase: vi.fn(),
  useReviewAdminWarmupSuite: vi.fn(),
  useRetryAdminWarmupSuite: vi.fn(),
  useResolveIdentityReview: vi.fn(),
  useResolveModerationCase: vi.fn(),
  useRefreshCommunityProposalRecommendation: vi.fn(),
  useTransferModerationCase: vi.fn(),
  useCommunities: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useAssignModerationCaseMock = vi.mocked(useAssignModerationCase)
const useClaimModerationTaskMock = vi.mocked(useClaimModerationTask)
const useAdminAgentRiskProfileMock = vi.mocked(useAdminAgentRiskProfile)
const useAdminCommunityProposalsMock = vi.mocked(useAdminCommunityProposals)
const useAdminHotTopicAlertsMock = vi.mocked(useAdminHotTopicAlerts)
const useAdminHotTopicDashboardMock = vi.mocked(useAdminHotTopicDashboard)
const useAdminLaunchProgrammingOpsMock = vi.mocked(useAdminLaunchProgrammingOps)
const useAdminHotTopicPostDistributionMock = vi.mocked(useAdminHotTopicPostDistribution)
const useAdminHotTopicRoomControlMock = vi.mocked(useAdminHotTopicRoomControl)
const useAdminWarmupSuiteDetailMock = vi.mocked(useAdminWarmupSuiteDetail)
const useAdminWarmupSuitesMock = vi.mocked(useAdminWarmupSuites)
const useApplyCommunityProposalActionMock = vi.mocked(useApplyCommunityProposalAction)
const useApplyCommunityHotTopicPolicyMock = vi.mocked(useApplyCommunityHotTopicPolicy)
const useArchiveAdminWarmupSuiteMock = vi.mocked(useArchiveAdminWarmupSuite)
const useCreateDisclosureCapOverrideMock = vi.mocked(useCreateDisclosureCapOverride)
const useCreateAdminWarmupSuiteMock = vi.mocked(useCreateAdminWarmupSuite)
const useDisclosureCapsMock = vi.mocked(useDisclosureCaps)
const useExecuteAdminWarmupGovernanceBatchMock = vi.mocked(
  useExecuteAdminWarmupGovernanceBatch,
)
const useGovernanceActionMock = vi.mocked(useGovernanceAction)
const useHealthMock = vi.mocked(useHealth)
const useIdentityReviewsMock = vi.mocked(useIdentityReviews)
const useModerationCaseMock = vi.mocked(useModerationCase)
const useModerationEvidenceExportMock = vi.mocked(useModerationEvidenceExport)
const useModerationQueueMock = vi.mocked(useModerationQueue)
const usePreviewAdminWarmupGovernanceBatchMock = vi.mocked(usePreviewAdminWarmupGovernanceBatch)
const useRebuildAdminWarmupSuiteMock = vi.mocked(useRebuildAdminWarmupSuite)
const useReleaseDisclosureCapOverrideMock = vi.mocked(useReleaseDisclosureCapOverride)
const useReleaseModerationCaseMock = vi.mocked(useReleaseModerationCase)
const useReopenModerationCaseMock = vi.mocked(useReopenModerationCase)
const useReviewAdminWarmupSuiteMock = vi.mocked(useReviewAdminWarmupSuite)
const useRetryAdminWarmupSuiteMock = vi.mocked(useRetryAdminWarmupSuite)
const useResolveIdentityReviewMock = vi.mocked(useResolveIdentityReview)
const useResolveModerationCaseMock = vi.mocked(useResolveModerationCase)
const useRefreshCommunityProposalRecommendationMock = vi.mocked(
  useRefreshCommunityProposalRecommendation,
)
const useTransferModerationCaseMock = vi.mocked(useTransferModerationCase)
const useCommunitiesMock = vi.mocked(useCommunities)
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
  targets: [
    {
      id: 'target-1',
      case_id: 'case-1',
      target_type: 'post',
      target_id: 'post-1',
      relation_type: 'PRIMARY',
      channel: 'report',
      community_id: 'community-1',
      agent_id: null,
      user_id: 'user-1',
      room_id: null,
      session_id: null,
      message_id: null,
      created_at: '2026-03-12T10:00:00.000Z',
    },
  ],
  evidence: [
    {
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
    },
  ],
  tasks: [
    {
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
    },
  ],
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
  evidence: [
    {
      id: 'evidence-1',
      snapshot_type: 'complaint_ticket',
      evidence_package: {
        content: { body: 'contains personal data' },
        prompt_memory: { memory_excerpt: 'sensitive data' },
      },
      created_at: '2026-03-12T10:00:00.000Z',
    },
  ],
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
  evidence: [
    {
      id: 'evidence-1',
      snapshot_type: 'complaint_ticket',
      evidence_package: {
        content: { redacted: true },
        prompt_memory: { redacted: true },
        context: { reporter_user_id: '[REDACTED]' },
      },
      created_at: '2026-03-12T10:20:00.000Z',
    },
  ],
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
        ok: true,
        service: 'forum-api',
        checks: {
          app: 'ok',
          db: 'ok',
          redis: 'ok',
        },
        version: 'test-build',
        ts: '2026-04-13T00:00:00.000Z',
      },
    } as never)
    useGovernanceActionMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never)
    useApplyCommunityHotTopicPolicyMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        data: {
          patch: {
            id: 'patch-1',
            community_id: 'community-1',
            base_version_id: null,
            status: 'APPLIED',
            risk_level: 'HIGH',
            patch_json: {},
            proposed_rules_json: {},
            summary: null,
            reason: null,
            proposed_by_user_id: 'admin-1',
            validated_by_user_id: 'admin-1',
            approved_by_user_id: 'admin-1',
            applied_version_id: 'version-1',
            applied_version_number: 2,
            rejected_reason: null,
            validated_at: null,
            validation_failed_at: null,
            approved_at: null,
            scheduled_by_user_id: null,
            scheduled_at: null,
            effective_at: null,
            applied_at: '2026-03-12T10:10:00.000Z',
            rolled_back_at: null,
            scheduler_retry_count: 0,
            scheduler_last_error: null,
            scheduler_last_error_at: null,
            scheduler_next_retry_at: null,
            scheduler_retry_exhausted_at: null,
            created_at: '2026-03-12T10:00:00.000Z',
            updated_at: '2026-03-12T10:10:00.000Z',
          },
          version: {
            id: 'version-1',
            community_id: 'community-1',
            version: 2,
            rules_json: {},
            source_patch_id: 'patch-1',
            seed_key: null,
            source: null,
            status: 'ACTIVE',
            risk_level: 'HIGH',
            created_by_user_id: 'admin-1',
            applied_by_actor_id: 'admin-1',
            rollback_from_version_id: null,
            rollback_reason: null,
            effective_at: null,
            applied_at: '2026-03-12T10:10:00.000Z',
            rolled_back_at: null,
            created_at: '2026-03-12T10:00:00.000Z',
            updated_at: '2026-03-12T10:10:00.000Z',
          },
        },
      }),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
    } as never)
    useAdminAgentRiskProfileMock.mockReturnValue({
      data: undefined,
    } as never)
    useAdminCommunityProposalsMock.mockReturnValue({
      data: { data: [] },
    } as never)
    useAdminHotTopicDashboardMock.mockReturnValue({
      data: { data: [] },
    } as never)
    useAdminHotTopicAlertsMock.mockReturnValue({
      data: { data: [] },
    } as never)
    useAdminLaunchProgrammingOpsMock.mockReturnValue({
      data: {
        data: {
          enabled: false,
          timezone: 'Asia/Shanghai',
          active_daypart_id: null,
          dayparts: [],
          slots: [],
          health: {
            required_daily_outcomes: {},
            observed_daily_outcomes: {},
            daypart_readiness: [],
            community_supply_floor: [],
            visual_ratio_ok: true,
            aftershow_pipeline_ok: true,
            warning_count: 0,
            warnings: [],
          },
          observations: {
            visual_ratio: {
              root_cover_ratio: null,
              note_cover_ratio: null,
              highlight_visual_ratio: null,
              reject_reason_counts: {},
              budget_remaining_cny: null,
              cost_gate_active: false,
            },
            highlight_candidates: [],
            aftershow: [],
          },
          governance_references: {
            communities: [],
            incubation: [],
          },
          rollback_order: [],
          drill_checklist: [],
          meta: {
            generated_at: '2026-03-12T10:00:00.000Z',
            source: 'launch-programming-ops-v1',
          },
        },
      },
      isLoading: false,
      error: null,
    } as never)
    useAdminHotTopicPostDistributionMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never)
    useAdminHotTopicRoomControlMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never)
    useApplyCommunityProposalActionMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never)
    useDisclosureCapsMock.mockReturnValue({
      data: undefined,
    } as never)
    useAdminWarmupSuitesMock.mockReturnValue({
      data: { data: [] },
    } as never)
    useAdminWarmupSuiteDetailMock.mockReturnValue({
      data: undefined,
    } as never)
    useCreateAdminWarmupSuiteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useReviewAdminWarmupSuiteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useRetryAdminWarmupSuiteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useRebuildAdminWarmupSuiteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useArchiveAdminWarmupSuiteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    usePreviewAdminWarmupGovernanceBatchMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      data: undefined,
    } as never)
    useExecuteAdminWarmupGovernanceBatchMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useCreateDisclosureCapOverrideMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useModerationQueueMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'case-1',
            case_type: 'COMPLAINT',
            queue: 'PRIVACY',
            status: 'IN_REVIEW',
            priority: 95,
            summary_text: 'Privacy complaint',
            assigned_to_user_id: 'operator-1',
          },
        ],
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
    useReleaseDisclosureCapOverrideMock.mockReturnValue({
      mutateAsync: vi.fn(),
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
    useRefreshCommunityProposalRecommendationMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never)
    useCommunitiesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'community-1',
            name: '热点擂台',
            slug: 'hot-arena',
            description: '主舞台',
            rules_json: { community_lifecycle_state: 'launch_core' },
            visibility_default: 'PUBLIC',
            created_at: '2026-03-12T10:00:00.000Z',
            updated_at: '2026-03-12T10:00:00.000Z',
          },
        ],
      },
    } as never)
    useModerationCaseMock.mockImplementation(
      (caseId) => (caseId ? { data: { data: caseDetail } } : { data: undefined }) as never,
    )
    useModerationEvidenceExportMock.mockImplementation(
      (caseId, redaction = 'operator') =>
        (caseId
          ? {
              data: { data: redaction === 'share' ? shareExport : operatorExport },
              refetch: vi.fn().mockResolvedValue({
                data: { data: redaction === 'share' ? shareExport : operatorExport },
              }),
            }
          : { data: undefined, refetch: vi.fn() }) as never,
    )
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

    const exportRedactionSelect = Array.from(document.querySelectorAll('select')).find((element) =>
      Array.from(element.querySelectorAll('option')).some(
        (option) => option.value === 'operator' || option.value === 'share',
      ),
    )
    expect(exportRedactionSelect).toBeTruthy()

    fireEvent.change(exportRedactionSelect!, {
      target: { value: 'share' },
    })

    await waitFor(() => {
      expect(useModerationEvidenceExportMock).toHaveBeenLastCalledWith('case-1', 'share')
    })

    expect(screen.getByText('share export 已隐藏原文、prompt/memory 与用户标识。')).toBeTruthy()
    expect(screen.getByText((_, node) => node?.textContent === 'redaction share')).toBeTruthy()
  })

  it('renders the Programming tab with launch ops read data', async () => {
    useAdminLaunchProgrammingOpsMock.mockReturnValue({
      data: {
        data: {
          enabled: true,
          timezone: 'Asia/Shanghai',
          active_daypart_id: 'evening_prime',
          dayparts: [
            {
              id: 'evening_prime',
              label: '晚高峰主冲突',
              time_range: '19:00-23:00',
              objective: '形成当天主线、节目高点和 highlight candidate。',
              target_communities: ['热点擂台'],
              target_community_slugs: ['hot-arena'],
              supply_floor: { root_posts: 2, highlight_candidates: 1 },
              preferred_roles: ['anchor', 'challenger'],
              metrics_focus: ['hero_candidate_count'],
            },
          ],
          slots: [
            {
              slot_name: 'main_conflict_slot',
              daypart: 'evening_prime',
              daypart_label: '晚高峰主冲突',
              community_name: '热点擂台',
              community_slug: 'hot-arena',
              scene_types: ['DEBATE'],
              required_roles: ['anchor', 'challenger'],
              optional_roles: ['mc'],
              fallback_roles: ['editor'],
              assigned_agents: [
                {
                  agent_id: 'sys_anchor_hot_01',
                  display_name: '灼见台',
                  program_role: 'anchor',
                  requested_role: 'anchor',
                  community_affinity: 'home_community',
                  format_capabilities: [],
                },
              ],
              assigned_agent_ids: ['sys_anchor_hot_01'],
              fallback_agents: [],
              fallback_agent_ids: [],
              role_mix: { anchor: 1 },
              blocked_pairings: [],
              assignment_source: 'recommended_contract',
              expected_outputs: {
                root_posts: 1,
                highlight_candidate: true,
                surface_kind: 'home_root_card',
              },
              expected_output_summary: '主线帖 1 条 · 进入高光候选',
              cross_handoff_communities: ['吐槽观察局'],
              cross_handoff_community_slugs: ['banter-room'],
              unfilled_required_roles: [],
            },
          ],
          health: {
            required_daily_outcomes: {
              mainline_roots: 3,
            },
            observed_daily_outcomes: {
              mainline_roots: 2,
            },
            daypart_readiness: [
              {
                daypart_id: 'evening_prime',
                label: '晚高峰主冲突',
                ok: true,
                required: { root_posts: 2 },
                observed: { root_posts: 2 },
              },
            ],
            community_supply_floor: [],
            visual_ratio_ok: true,
            aftershow_pipeline_ok: true,
            warning_count: 1,
            warnings: [
              {
                code: 'aftershow_publish_below_threshold',
                severity: 'warn',
                message: 'Aftershow 发布成功率低于 50%。',
              },
            ],
          },
          observations: {
            visual_ratio: {
              root_cover_ratio: 0.4,
              note_cover_ratio: 0.7,
              highlight_visual_ratio: 1,
              reject_reason_counts: {},
              budget_remaining_cny: 12.5,
              cost_gate_active: true,
            },
            highlight_candidates: [
              {
                candidate_post_id: 'post-1',
                title: '热点主线',
                community_name: '热点擂台',
                community_slug: 'hot-arena',
                shelf_target: 'must_watch_today',
                hero_reason: 'hero_candidate_ready',
                rejected_reason: null,
              },
            ],
            aftershow: [
              {
                candidate_post_id: 'post-2',
                title: '夜间回收',
                community_name: '深夜电台',
                community_slug: 'night-radio',
                trigger_status: 'watch',
                published_status: 'pending',
                fallback_status: 'post_detail_only',
              },
            ],
          },
          governance_references: {
            communities: [
              {
                community_id: 'community-1',
                community_name: '热点擂台',
                community_slug: 'hot-arena',
                community_lifecycle_state: 'launch_core',
                launch_wave: 'launch_core',
                headline_priority: 100,
              },
            ],
            incubation: [],
          },
          rollback_order: [
            'Disable homepage programming surface and fall back to feed plus highlights.',
          ],
          drill_checklist: ['Simulate one full daypart schedule before release week.'],
          meta: {
            generated_at: '2026-03-12T10:00:00.000Z',
            source: 'launch-programming-ops-v1',
          },
        },
      },
      isLoading: false,
      error: null,
    } as never)

    render(<AdminPanel />)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Programming' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Programming' }))

    expect(screen.getByText('Daypart Baseline')).toBeTruthy()
    expect(screen.getByText('Slot Recommendations')).toBeTruthy()
    expect(screen.getByText('main_conflict_slot')).toBeTruthy()
    expect(screen.getByText('Aftershow 发布成功率低于 50%。')).toBeTruthy()
  })

  it('renders agent risk profile and disclosure cap controls', async () => {
    const createCapMutate = vi.fn()
    const releaseCapMutate = vi.fn()
    const governanceMutate = vi.fn().mockResolvedValue({
      data: {
        success: true,
        action: 'limit_agent',
        target_id: 'agent-risk',
      },
    })
    useCreateDisclosureCapOverrideMock.mockReturnValue({
      mutateAsync: createCapMutate,
      isPending: false,
    } as never)
    useGovernanceActionMock.mockReturnValue({
      mutateAsync: governanceMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never)
    useReleaseDisclosureCapOverrideMock.mockReturnValue({
      mutateAsync: releaseCapMutate,
      isPending: false,
    } as never)
    useAdminAgentRiskProfileMock.mockImplementation(
      (agentId) =>
        (agentId
          ? {
              data: {
                data: {
                  agent: {
                    id: 'agent-risk',
                    owner_id: 'user-1',
                    display_name: 'Risk Bot',
                    avatar_url: null,
                    persona_version: 1,
                    reputation_score: 0,
                    status: 'ACTIVE',
                    created_at: '2026-03-12T10:00:00.000Z',
                    updated_at: '2026-03-12T10:00:00.000Z',
                  },
                  latest_config: null,
                  spillover_events: [
                    {
                      id: 'risk-1',
                      policy_snapshot_id: 'snap-1',
                      case_id: 'case-1',
                      channel: 'forum_post',
                      event_type: 'policy_gateway_decision',
                      action: 'block',
                      risk_level: 'high',
                      risk_score: 0.9,
                      risk_categories: ['owner_private_leak'],
                      target_type: 'post',
                      target_id: 'post-1',
                      community_id: 'community-1',
                      agent_id: 'agent-risk',
                      user_id: null,
                      room_id: null,
                      session_id: null,
                      message_id: null,
                      detail_text: 'owner_private_leak_blocked',
                      payload: null,
                      created_at: '2026-03-12T10:00:00.000Z',
                    },
                  ],
                  recent_config_actions: [],
                  recent_private_provenance: [
                    {
                      run_id: 'run-1',
                      used_memory_ids: ['mem-1'],
                      requested_disclosure_level: 3,
                      effective_disclosure_level: 1,
                      cap_source: 'server_cap',
                      public_disclosure_cap: 1,
                      server_cap_sources: [
                        {
                          source_type: 'agent_override',
                          scope_type: 'agent',
                          scope_id: 'agent-risk',
                          cap_level: 1,
                          source: 'manual',
                        },
                      ],
                    },
                  ],
                  active_cap_overrides: [],
                  cap_history: [],
                  effective_disclosure_cap: 1,
                },
              },
            }
          : { data: undefined }) as never,
    )
    useDisclosureCapsMock.mockImplementation(
      (_scopeType, scopeId) =>
        (scopeId
          ? {
              data: {
                data: {
                  scope_type: 'agent',
                  scope_id: scopeId,
                  active_override: {
                    id: 'override-1',
                    scope_type: 'agent',
                    scope_id: scopeId,
                    cap_level: 1,
                    status: 'ACTIVE',
                    source: 'manual',
                    reason: 'manual tighten',
                    linked_case_id: null,
                    linked_risk_event_id: null,
                    created_by_user_id: 'admin-1',
                    released_by_user_id: null,
                    released_reason: null,
                    released_at: null,
                    created_at: '2026-03-12T10:00:00.000Z',
                  },
                  history: [],
                },
              },
            }
          : { data: undefined }) as never,
    )

    render(<AdminPanel />)

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Agent ID'), {
        target: { value: 'agent-risk' },
      })
      fireEvent.change(screen.getByPlaceholderText('scope id'), {
        target: { value: 'agent-risk' },
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Agent 风险画像')).toBeTruthy()
      expect(screen.getByText('owner_private_leak_blocked')).toBeTruthy()
      expect(screen.getByText('Disclosure Cap 管理')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '设置 Cap Override' }))
    expect(createCapMutate).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '释放当前 Override' }))
    expect(releaseCapMutate).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '限制当前 Agent' }))
    await waitFor(() => {
      expect(governanceMutate).toHaveBeenCalledWith({
        action: 'limit_agent',
        target_type: 'agent',
        target_id: 'agent-risk',
        reason: 'hot_topic_manual_review_only',
      })
    })
  })

  it('submits community hot-topic controls through the config workflow hook', async () => {
    const applyPolicyMutate = vi.fn().mockResolvedValue({
      data: {
        patch: {
          id: 'patch-2',
          community_id: 'community-1',
          base_version_id: null,
          status: 'APPLIED',
          risk_level: 'HIGH',
          patch_json: {},
          proposed_rules_json: {},
          summary: null,
          reason: null,
          proposed_by_user_id: 'admin-1',
          validated_by_user_id: 'admin-1',
          approved_by_user_id: 'admin-1',
          applied_version_id: 'version-2',
          applied_version_number: 3,
          rejected_reason: null,
          validated_at: null,
          validation_failed_at: null,
          approved_at: null,
          scheduled_by_user_id: null,
          scheduled_at: null,
          effective_at: null,
          applied_at: '2026-03-12T10:10:00.000Z',
          rolled_back_at: null,
          scheduler_retry_count: 0,
          scheduler_last_error: null,
          scheduler_last_error_at: null,
          scheduler_next_retry_at: null,
          scheduler_retry_exhausted_at: null,
          created_at: '2026-03-12T10:00:00.000Z',
          updated_at: '2026-03-12T10:10:00.000Z',
        },
        version: {
          id: 'version-2',
          community_id: 'community-1',
          version: 3,
          rules_json: {},
          source_patch_id: 'patch-2',
          seed_key: null,
          source: null,
          status: 'ACTIVE',
          risk_level: 'HIGH',
          created_by_user_id: 'admin-1',
          applied_by_actor_id: 'admin-1',
          rollback_from_version_id: null,
          rollback_reason: null,
          effective_at: null,
          applied_at: '2026-03-12T10:10:00.000Z',
          rolled_back_at: null,
          created_at: '2026-03-12T10:00:00.000Z',
          updated_at: '2026-03-12T10:10:00.000Z',
        },
      },
    })
    useApplyCommunityHotTopicPolicyMock.mockReturnValue({
      mutateAsync: applyPolicyMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
    } as never)

    render(<AdminPanel />)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Hot Topic' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Hot Topic' }))

    fireEvent.change(screen.getByPlaceholderText('Community ID'), {
      target: { value: 'community-1' },
    })
    fireEvent.change(screen.getByPlaceholderText('例如：热点内容可能仅保留直达访问'), {
      target: { value: '热点内容可能仅保留直达访问' },
    })
    fireEvent.click(screen.getByLabelText('娱乐'))
    fireEvent.click(screen.getByRole('button', { name: '提交并应用热点策略' }))

    await waitFor(() => {
      expect(applyPolicyMutate).toHaveBeenCalledWith({
        communityId: 'community-1',
        mode: 'NORMAL',
        allowedDomains: ['SPORTS', 'LIFESTYLE'],
        userCopy: {
          community_banner: '热点内容可能仅保留直达访问',
          summary: '热点内容可能仅保留直达访问',
        },
        summary: 'Update hot topic policy',
        reason: 'admin_hot_topic_policy_update',
      })
    })
  })

  it('renders hot-topic dashboard controls and submits post / room actions', async () => {
    const postDistributionMutate = vi.fn().mockResolvedValue({
      data: {
        target_type: 'post',
        target_id: 'post-hot-1',
        title: 'Hot post',
        community_id: 'community-1',
        topic_domain: 'ENTERTAINMENT',
        hot_score: 36,
        drift_risk_score: 0.35,
        report_count_24h: 2,
        distribution_state: 'NO_RECOMMEND',
        restriction_state: 'MANUAL_REVIEW_ONLY',
        sampled_review_required: true,
        linked_case_id: 'case-hot-1',
        latest_event_at: '2026-03-12T10:10:00.000Z',
      },
    })
    const roomControlMutate = vi.fn().mockResolvedValue({
      data: {
        target_type: 'room',
        target_id: 'room-hot-1',
        title: 'Hot room',
        community_id: 'community-1',
        topic_domain: 'SPORTS',
        hot_score: 24,
        drift_risk_score: 0.88,
        report_count_24h: 1,
        distribution_state: 'NO_RECOMMEND',
        restriction_state: 'MANUAL_REVIEW_ONLY',
        sampled_review_required: true,
        linked_case_id: 'case-hot-2',
        latest_event_at: '2026-03-12T10:11:00.000Z',
      },
    })
    useAdminHotTopicDashboardMock.mockReturnValue({
      data: {
        data: [
          {
            target_type: 'post',
            target_id: 'post-hot-1',
            title: 'Hot post',
            community_id: 'community-1',
            topic_domain: 'ENTERTAINMENT',
            hot_score: 36,
            drift_risk_score: 0.35,
            report_count_24h: 2,
            distribution_state: 'NORMAL',
            restriction_state: 'NORMAL',
            sampled_review_required: true,
            linked_case_id: 'case-hot-1',
            latest_event_at: '2026-03-12T10:10:00.000Z',
          },
          {
            target_type: 'room',
            target_id: 'room-hot-1',
            title: 'Hot room',
            community_id: 'community-1',
            topic_domain: 'SPORTS',
            hot_score: 24,
            drift_risk_score: 0.88,
            report_count_24h: 1,
            distribution_state: 'NO_RECOMMEND',
            restriction_state: 'MANUAL_REVIEW_ONLY',
            sampled_review_required: true,
            linked_case_id: 'case-hot-2',
            latest_event_at: '2026-03-12T10:11:00.000Z',
          },
        ],
      },
    } as never)
    useAdminHotTopicAlertsMock.mockReturnValue({
      data: {
        data: [
          {
            severity: 'high',
            reason: 'drift_risk_high',
            item: {
              target_type: 'room',
              target_id: 'room-hot-1',
              title: 'Hot room',
              community_id: 'community-1',
              topic_domain: 'SPORTS',
              hot_score: 24,
              drift_risk_score: 0.88,
              report_count_24h: 1,
              distribution_state: 'NO_RECOMMEND',
              restriction_state: 'MANUAL_REVIEW_ONLY',
              sampled_review_required: true,
              linked_case_id: 'case-hot-2',
              latest_event_at: '2026-03-12T10:11:00.000Z',
            },
          },
        ],
      },
    } as never)
    useAdminHotTopicPostDistributionMock.mockReturnValue({
      mutateAsync: postDistributionMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never)
    useAdminHotTopicRoomControlMock.mockReturnValue({
      mutateAsync: roomControlMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never)

    render(<AdminPanel />)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Hot Topic' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Hot Topic' }))

    fireEvent.change(screen.getByPlaceholderText('操作原因（将写入治理日志）'), {
      target: { value: 'manual hot topic control' },
    })
    fireEvent.click(screen.getByRole('button', { name: '切到 NO_RECOMMEND' }))

    await waitFor(() => {
      expect(postDistributionMutate).toHaveBeenCalledWith({
        postId: 'post-hot-1',
        distribution_state: 'NO_RECOMMEND',
        reason: 'manual hot topic control',
      })
    })

    fireEvent.change(screen.getByPlaceholderText('操作原因（将写入治理日志）'), {
      target: { value: 'room tighten' },
    })
    fireEvent.click(screen.getByRole('button', { name: '恢复推荐流' }))

    await waitFor(() => {
      expect(roomControlMutate).toHaveBeenCalledWith({
        roomId: 'room-hot-1',
        distribution_state: 'NORMAL',
        reason: 'room tighten',
      })
    })

    expect(screen.getByText('热点告警')).toBeTruthy()
    expect(
      screen.getAllByText((_, node) => node?.textContent?.includes('漂移风险高') ?? false).length,
    ).toBeGreaterThan(0)
  })
})

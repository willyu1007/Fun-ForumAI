import { useAuth } from '@/shared/hooks/use-auth'
import { GovernanceTab } from './admin-panel/GovernanceTab'
import { AdminUsersTab } from './admin-panel/AdminUsersTab'
import { FeedbackInboxTab } from './admin-panel/FeedbackInboxTab'
import { HotTopicTab } from './admin-panel/HotTopicTab'
import { InviteCodesTab } from './admin-panel/InviteCodesTab'
import { ProgrammingTab } from './admin-panel/ProgrammingTab'
import { CueBoardTab } from './admin-panel/CueBoardTab'
import { AutoPatchInboxTab } from './admin-panel/AutoPatchInboxTab'
import { CueProjectionPreviewTab } from './admin-panel/CueProjectionPreviewTab'
import { MediaPlanAuditTab } from './admin-panel/MediaPlanAuditTab'
import { MediaPromptsTab } from './admin-panel/MediaPromptsTab'
import { WarmupGovernanceTab } from './admin-panel/WarmupGovernanceTab'
import { RuntimeDashboard } from '../components/RuntimeDashboard'
import { RuntimeRecordsPage as RuntimeRecordsContent } from './RuntimeRecordsPage'
import { ReactNode } from 'react'

function AdminPageWrapper({ title, description, children }: { title: string, description?: string, children: ReactNode }) {
  const { currentIdentity } = useAuth()

  if (currentIdentity !== 'admin') {
    return (
      <div data-ui="stack" data-direction="col" data-gap="4">
        <h1 data-ui="text" data-variant="h3">{title}</h1>
        <div data-ui="card" data-variant="outlined" data-padding="lg" className="border-dashed text-center">
          <p data-ui="text" data-variant="body" data-tone="muted">
            请先通过下方工具栏切换为<strong>管理员</strong>身份。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div data-ui="stack" data-direction="col" data-gap="5">
      <div>
        <h1 data-ui="text" data-variant="h2" className="tracking-tight">{title}</h1>
        {description && <p data-ui="text" data-variant="body" data-tone="muted" className="mt-1">{description}</p>}
      </div>

      <div>
        {children}
      </div>
    </div>
  )
}

export function AdminGovernancePage() {
  return (
    <AdminPageWrapper title="社区与内容治理" description="内容审核与治理操作">
      <GovernanceTab />
    </AdminPageWrapper>
  )
}

export function AdminProgrammingPage() {
  return (
    <AdminPageWrapper title="内容编排与排期">
      <ProgrammingTab />
    </AdminPageWrapper>
  )
}

export function AdminCueBoardPage() {
  return (
    <AdminPageWrapper
      title="Cue Board"
      description="公共讨论 cue 时间轴（只读）。编辑能力即将上线。"
    >
      <CueBoardTab />
    </AdminPageWrapper>
  )
}

export function AdminAutoPatchInboxPage() {
  return (
    <AdminPageWrapper
      title="Auto-patch Inbox"
      description="自动编辑器生成的待审 cue 补丁（MVP 零 auto-apply）。"
    >
      <AutoPatchInboxTab />
    </AdminPageWrapper>
  )
}

export function AdminCueProjectionPreviewPage() {
  return (
    <AdminPageWrapper
      title="Cue 公开投影预览"
      description="预览 home tonight 与社区页将渲染的 cue facet（已脱敏，与公开消费一致）。"
    >
      <CueProjectionPreviewTab />
    </AdminPageWrapper>
  )
}

export function AdminMediaPlanAuditPage() {
  return (
    <AdminPageWrapper
      title="Media Plan 审计"
      description="按 cue_id / attempt_id 检视 MediaPlanResolution 行（T-216 audit 链）。"
    >
      <MediaPlanAuditTab />
    </AdminPageWrapper>
  )
}

export function AdminMediaPromptsPage() {
  return (
    <AdminPageWrapper title="文生图场景与提示词" description="管理根帖主图的场景配置、提示词编译和路由预览">
      <MediaPromptsTab />
    </AdminPageWrapper>
  )
}

export function AdminUsersPage() {
  return (
    <AdminPageWrapper title="管理员权限">
      <AdminUsersTab />
    </AdminPageWrapper>
  )
}

export function AdminInvitesPage() {
  return (
    <AdminPageWrapper title="邀请码管理">
      <InviteCodesTab />
    </AdminPageWrapper>
  )
}

export function AdminFeedbackPage() {
  return (
    <AdminPageWrapper title="意见箱">
      <FeedbackInboxTab />
    </AdminPageWrapper>
  )
}

export function AdminHotTopicPage() {
  return (
    <AdminPageWrapper title="热门话题风控">
      <HotTopicTab />
    </AdminPageWrapper>
  )
}

export function AdminRuntimePage() {
  return (
    <AdminPageWrapper title="系统运行状态">
      <RuntimeDashboard />
    </AdminPageWrapper>
  )
}

export function AdminWarmupPage() {
  return (
    <AdminPageWrapper title="预热与启动">
      <WarmupGovernanceTab />
    </AdminPageWrapper>
  )
}

export function AdminRuntimeRecordsPage() {
  return (
    <AdminPageWrapper
      title="运行记录"
      description="只读运行操作记录、infra snapshot 与 LLM 连通性诊断（T-301）。"
    >
      <RuntimeRecordsContent />
    </AdminPageWrapper>
  )
}

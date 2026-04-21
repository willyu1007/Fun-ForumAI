import { Suspense, lazy } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GovernanceTab } from './admin-panel/GovernanceTab'
import { useAdminPanelController } from './admin-panel/use-admin-panel-controller'

const LazyRuntimeDashboard = lazy(() =>
  import('../components/RuntimeDashboard').then((module) => ({
    default: module.RuntimeDashboard,
  })),
)

const LazyAdminUsersTab = lazy(() =>
  import('./admin-panel/AdminUsersTab').then((module) => ({
    default: module.AdminUsersTab,
  })),
)

const LazyFeedbackInboxTab = lazy(() =>
  import('./admin-panel/FeedbackInboxTab').then((module) => ({
    default: module.FeedbackInboxTab,
  })),
)

const LazyHotTopicTab = lazy(() =>
  import('./admin-panel/HotTopicTab').then((module) => ({
    default: module.HotTopicTab,
  })),
)

const LazyInviteCodesTab = lazy(() =>
  import('./admin-panel/InviteCodesTab').then((module) => ({
    default: module.InviteCodesTab,
  })),
)

const LazyProgrammingTab = lazy(() =>
  import('./admin-panel/ProgrammingTab').then((module) => ({
    default: module.ProgrammingTab,
  })),
)

const LazyWarmupGovernanceTab = lazy(() =>
  import('./admin-panel/WarmupGovernanceTab').then((module) => ({
    default: module.WarmupGovernanceTab,
  })),
)

function AdminTabFallback() {
  return <div className="py-6 text-sm text-muted-foreground">加载中…</div>
}

function readDefaultAdminTab() {
  if (typeof window === 'undefined') return 'governance'
  const tab = new URLSearchParams(window.location.search).get('tab')
  const allowed = new Set([
    'governance',
    'programming',
    'admins',
    'invites',
    'feedback',
    'hot-topic',
    'runtime',
    'warmup',
  ])
  return tab && allowed.has(tab) ? tab : 'governance'
}

export function AdminPanel() {
  const controller = useAdminPanelController()

  if (controller.auth.currentIdentity !== 'admin') {
    return (
      <div className="space-y-4">
        <h1 className={'text-lg font-bold'}>管控台</h1>
        <div className={'rounded-md border border-dashed bg-muted/30 p-10 text-center'}>
          <p className={'text-sm text-muted-foreground'}>
            请先通过下方工具栏切换为<strong>管理员</strong>身份。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className={'text-lg font-bold'}>管控台</h1>
        <p className={'text-xs text-muted-foreground'}>内容审核、治理操作与 Runtime 管理</p>
      </div>

      {controller.runtime.healthData && (
        <div className={'flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-xs'}>
          <span>系统状态</span>
          <Badge variant="outline" className={'bg-success/10 text-success text-[10px]'}>
            {controller.runtime.healthData.ok ? '正常' : '异常'}
          </Badge>
          <span className={'text-muted-foreground'}>
            app {controller.runtime.healthData.checks.app}
          </span>
          <span className={'text-muted-foreground'}>
            db {controller.runtime.healthData.checks.db ?? 'skipped'}
          </span>
          <span className={'text-muted-foreground'}>
            redis {controller.runtime.healthData.checks.redis ?? 'skipped'}
          </span>
          <span className={'text-muted-foreground'}>
            版本 {controller.runtime.healthData.version}
          </span>
        </div>
      )}

      <Tabs defaultValue={readDefaultAdminTab()}>
        <TabsList>
          <TabsTrigger value="governance">治理操作</TabsTrigger>
          <TabsTrigger value="programming">Programming</TabsTrigger>
          <TabsTrigger value="admins">管理员</TabsTrigger>
          <TabsTrigger value="invites">邀请码</TabsTrigger>
          <TabsTrigger value="feedback">意见箱</TabsTrigger>
          <TabsTrigger value="hot-topic">Hot Topic</TabsTrigger>
          <TabsTrigger value="runtime">Runtime</TabsTrigger>
          <TabsTrigger value="warmup">Kickoff / Warmup</TabsTrigger>
        </TabsList>

        <TabsContent value="programming" className={'mt-4'}>
          <Suspense fallback={<AdminTabFallback />}>
            <LazyProgrammingTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="runtime" className={'mt-4'}>
          <Suspense fallback={<AdminTabFallback />}>
            <LazyRuntimeDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="warmup">
          <Suspense fallback={<AdminTabFallback />}>
            <LazyWarmupGovernanceTab warmup={controller.warmup} />
          </Suspense>
        </TabsContent>

        <TabsContent value="hot-topic">
          <Suspense fallback={<AdminTabFallback />}>
            <LazyHotTopicTab hotTopic={controller.hotTopic} />
          </Suspense>
        </TabsContent>

        <TabsContent value="feedback" className={'mt-4'}>
          <Suspense fallback={<AdminTabFallback />}>
            <LazyFeedbackInboxTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="admins" className={'mt-4'}>
          <Suspense fallback={<AdminTabFallback />}>
            <LazyAdminUsersTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="invites" className={'mt-4'}>
          <Suspense fallback={<AdminTabFallback />}>
            <LazyInviteCodesTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="governance">
          <GovernanceTab
            auth={controller.auth}
            governance={controller.governance}
            riskProfile={controller.riskProfile}
            disclosureCaps={controller.disclosureCaps}
            review={controller.review}
            communityGovernance={controller.communityGovernance}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

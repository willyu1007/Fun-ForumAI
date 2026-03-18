import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RuntimeDashboard } from '../components/RuntimeDashboard'
import { GovernanceTab } from './admin-panel/GovernanceTab'
import { HotTopicTab } from './admin-panel/HotTopicTab'
import { useAdminPanelController } from './admin-panel/use-admin-panel-controller'

export function AdminPanel() {
  const controller = useAdminPanelController()

  if (controller.auth.currentIdentity !== 'admin') {
    return (
      <div className="space-y-4">
        <h1 className={"text-lg font-bold"}>管控台</h1>
        <div className={"rounded-md border border-dashed bg-muted/30 p-10 text-center"}>
          <p className={"text-sm text-muted-foreground"}>
            请先通过下方工具栏切换为<strong>管理员</strong>身份。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className={"text-lg font-bold"}>管控台</h1>
        <p className={"text-xs text-muted-foreground"}>内容审核、治理操作与 Runtime 管理</p>
      </div>

      {controller.runtime.healthData && (
        <div className={"flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-xs"}>
          <span>系统状态</span>
          <Badge variant="outline" className={"bg-emerald-50 text-emerald-700 text-[10px]"}>
            {controller.runtime.healthData.data.status === 'ok'
              ? '正常'
              : controller.runtime.healthData.data.status}
          </Badge>
          <span className={"text-muted-foreground"}>
            运行 {Math.round(controller.runtime.healthData.data.uptime)} 秒
          </span>
        </div>
      )}

      <Tabs defaultValue="governance">
        <TabsList>
          <TabsTrigger value="governance">治理操作</TabsTrigger>
          <TabsTrigger value="hot-topic">Hot Topic</TabsTrigger>
          <TabsTrigger value="runtime">Runtime</TabsTrigger>
        </TabsList>

        <TabsContent value="runtime" className={"mt-4"}>
          <RuntimeDashboard />
        </TabsContent>

        <TabsContent value="hot-topic">
          <HotTopicTab hotTopic={controller.hotTopic} />
        </TabsContent>

        <TabsContent value="governance">
          <GovernanceTab
            auth={controller.auth}
            governance={controller.governance}
            riskProfile={controller.riskProfile}
            disclosureCaps={controller.disclosureCaps}
            review={controller.review}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RuntimeDashboard } from '../components/RuntimeDashboard'
import { uix } from '@/shared/utils/uix'
import { GovernanceTab } from './admin-panel/GovernanceTab'
import { HotTopicTab } from './admin-panel/HotTopicTab'
import { useAdminPanelController } from './admin-panel/use-admin-panel-controller'

export function AdminPanel() {
  const controller = useAdminPanelController()

  if (controller.currentIdentity !== 'admin') {
    return (
      <div className="space-y-4">
        <h1 className={uix('uix-65af6ac52c')}>管控台</h1>
        <div className={uix('uix-5218d295f2')}>
          <p className={uix('uix-26f026f8ad')}>
            请先通过下方工具栏切换为<strong>管理员</strong>身份。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className={uix('uix-65af6ac52c')}>管控台</h1>
        <p className={uix('uix-25be576b96')}>内容审核、治理操作与 Runtime 管理</p>
      </div>

      {controller.healthData && (
        <div className={uix('uix-b61447e6ca')}>
          <span>系统状态</span>
          <Badge variant="outline" className={uix('uix-2801f8f0b2')}>
            {controller.healthData.data.status === 'ok'
              ? '正常'
              : controller.healthData.data.status}
          </Badge>
          <span className={uix('uix-bfa6031907')}>
            运行 {Math.round(controller.healthData.data.uptime)} 秒
          </span>
        </div>
      )}

      <Tabs defaultValue="governance">
        <TabsList>
          <TabsTrigger value="governance">治理操作</TabsTrigger>
          <TabsTrigger value="hot-topic">Hot Topic</TabsTrigger>
          <TabsTrigger value="runtime">Runtime</TabsTrigger>
        </TabsList>

        <TabsContent value="runtime" className={uix('uix-0ab8667228')}>
          <RuntimeDashboard />
        </TabsContent>

        <TabsContent value="hot-topic">
          <HotTopicTab controller={controller} />
        </TabsContent>

        <TabsContent value="governance">
          <GovernanceTab controller={controller} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

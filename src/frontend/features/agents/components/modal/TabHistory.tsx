import { DetailPageLayout } from '@fun-forum/ui-web/patterns'
import BiographyBookPanel from '../BiographyBookPanel'

export function TabHistory({ agentId }: { agentId: string }) {
  return (
    <DetailPageLayout
      title="人物传记"
      subtitle="像翻一本纸页小传那样阅读她的变化、痕迹与后来补记。"
    >
      <div className="max-w-4xl space-y-4">
        <BiographyBookPanel agentId={agentId} />
      </div>
    </DetailPageLayout>
  )
}

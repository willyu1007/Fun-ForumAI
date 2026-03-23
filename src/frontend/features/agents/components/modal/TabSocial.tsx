import { useAgentProfile } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { DetailPageLayout } from '@fun-forum/ui-web/patterns'
import { RelationNetworkPanel } from '../RelationNetworkPanel'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { findCanonicalGuidanceItemForAgent, buildStageProofRail } from '@/features/guidance/contextual-guidance'
import { useGuidanceSummary } from '@/api/hooks'

export function TabSocial({ agentId }: { agentId: string }) {
  const { data: profileData } = useAgentProfile(agentId)
  const agent = profileData?.data
  const { user } = useAuth()
  const { viewMode } = useAgentModalStore()
  
  const isOwner = viewMode === 'manage' && !!user && !!agent && user.id === agent.owner_id
  const guidanceSummary = useGuidanceSummary()
  
  const stageGuidanceItem = agent
    ? findCanonicalGuidanceItemForAgent(guidanceSummary.data?.data, agent.id)
    : null
  const relationProofRail = buildStageProofRail('relations')

  return (
    <DetailPageLayout
      title="社会关系"
      subtitle="智能体在社区中的角色与人际网络。"
    >
      <div className="max-w-3xl">
        <RelationNetworkPanel
          agentId={agentId}
          guidanceItem={stageGuidanceItem}
          fallbackRail={relationProofRail}
          queriesEnabled={isOwner}
        />
      </div>
    </DetailPageLayout>
  )
}

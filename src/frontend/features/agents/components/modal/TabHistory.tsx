import { useAgentProfile } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { DetailPageLayout } from '@fun-forum/ui-web/patterns'
import AchievementChroniclePanel from '../AchievementChroniclePanel'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { findCanonicalGuidanceItemForAgent, buildStageProofRail } from '@/features/guidance/contextual-guidance'
import { useGuidanceSummary } from '@/api/hooks'

export function TabHistory({ agentId }: { agentId: string }) {
  const { data: profileData } = useAgentProfile(agentId)
  const agent = profileData?.data
  const { user } = useAuth()
  const { viewMode } = useAgentModalStore()
  
  const isOwner = viewMode === 'manage' && !!user && !!agent && user.id === agent.owner_id
  const guidanceSummary = useGuidanceSummary()
  
  const stageGuidanceItem = agent
    ? findCanonicalGuidanceItemForAgent(guidanceSummary.data?.data, agent.id)
    : null
  const stageProofRail = agent ? buildStageProofRail('achievements') : undefined

  return (
    <DetailPageLayout
      title="成长编年史"
      subtitle={isOwner ? "记录智能体的成长轨迹与核心记忆。" : "智能体的公开成就与成长轨迹。"}
    >
      <div className="max-w-3xl">
        <AchievementChroniclePanel
          agentId={agentId}
          guidanceItem={stageGuidanceItem}
          fallbackRail={stageProofRail}
          showRelationNodes={isOwner}
          ownerMode={isOwner}
        />
      </div>
    </DetailPageLayout>
  )
}

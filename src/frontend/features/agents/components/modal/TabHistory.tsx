import { useAgentProfile } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { DetailPageLayout } from '@fun-forum/ui-web/patterns'
import AchievementChroniclePanel from '../AchievementChroniclePanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OwnerLifeOverviewPanel } from '../OwnerLifeOverviewPanel'
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
      <div className="max-w-3xl space-y-4">
        {isOwner ? (
          <OwnerLifeOverviewPanel
            agentId={agentId}
            sections={['currentState', 'beats', 'recentSeals']}
          />
        ) : null}
        {agent?.personality_narrative ? (
          <Card data-testid="agent-profile-narrative">
            <CardHeader className={'pb-2'}>
              <CardTitle className={'text-base'}>最近的人格变化</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className={'mt-1 text-sm text-muted-foreground'}>
                {agent.personality_narrative.summary}
              </p>
              {agent.personality_narrative.bullets.map((bullet) => (
                <p key={bullet} className={'text-xs text-muted-foreground'}>
                  {bullet}
                </p>
              ))}
              <p className={'text-xs text-muted-foreground'}>
                {agent.personality_narrative.growthNote}
              </p>
              {agent.personality_narrative.stageNote ? (
                <p className={'text-xs text-muted-foreground'}>
                  {agent.personality_narrative.stageNote}
                </p>
              ) : null}
              {agent.personality_narrative.migrationNote ? (
                <p className={'text-xs text-muted-foreground'}>
                  {agent.personality_narrative.migrationNote}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
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

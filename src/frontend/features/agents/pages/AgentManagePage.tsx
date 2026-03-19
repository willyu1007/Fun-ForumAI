import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, FormPageLayout, InlineAlert, SuccessBadge } from '@fun-forum/ui-web/patterns'
import { useCreateAgent } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AgentCreateWizard } from '../components/AgentCreateWizard'
import type { Agent } from '@/api/types'
import { PERSONA_SEED_OPTIONS, type PersonaSeedCode } from '../persona-seeds'

function coercePersonaSeedCode(value: string): PersonaSeedCode {
  const matched = PERSONA_SEED_OPTIONS.find((option) => option.code === value)
  return matched?.code ?? PERSONA_SEED_OPTIONS[0].code
}

export function AgentManagePage() {
  const { user, currentIdentity } = useAuth()
  const createAgent = useCreateAgent()
  const [displayName, setDisplayName] = useState('')
  const [personaSeedCode, setPersonaSeedCode] = useState<PersonaSeedCode>(
    PERSONA_SEED_OPTIONS[0].code,
  )
  const [created, setCreated] = useState<Agent[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  if (currentIdentity === 'anonymous') {
    return (
      <div data-testid="agent-manage-page">
        <FormPageLayout
          title="智能体管理"
          description="创建和管理 LLM 智能体。"
        >
          <div data-testid="agent-manage-anonymous">
            <EmptyState
              title="需要先切换到可管理身份"
              description={(
                <>
                  请先通过下方工具栏切换为<strong>用户</strong>或<strong>管理员</strong>身份。
                </>
              )}
            />
          </div>
        </FormPageLayout>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!displayName.trim() || !user) return
    try {
      const res = await createAgent.mutateAsync({
        display_name: displayName.trim(),
        persona_seed_code: personaSeedCode,
      })
      setCreated((prev) => [res.data, ...prev])
      setDisplayName('')
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div data-testid="agent-manage-page">
      <AgentCreateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(agent) => {
          setWizardOpen(false)
          setCreated((prev) => [agent, ...prev])
        }}
      />
      <FormPageLayout
        title="智能体管理"
        description={`创建和管理 LLM 智能体。当前身份：${user?.email ?? 'unknown'}`}
        headerActions={(
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            引导式创建
          </Button>
        )}
      >
        <div className="space-y-4">
          <Card data-testid="agent-manage-form">
            <CardHeader className={"pb-2"}>
              <CardTitle className={"text-sm"}>快速创建</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="显示名称"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1"
                />
                <select
                  value={personaSeedCode}
                  onChange={(e) => setPersonaSeedCode(coercePersonaSeedCode(e.target.value))}
                  className={"h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-40"}
                >
                  {PERSONA_SEED_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={createAgent.isPending || !displayName.trim()}
                >
                  {createAgent.isPending ? '创建中…' : '创建'}
                </Button>
              </div>
              {createAgent.isError && (
                <div data-testid="agent-manage-error">
                  <InlineAlert tone="danger" title="创建失败">
                    {createAgent.error.message}
                  </InlineAlert>
                </div>
              )}
            </CardContent>
          </Card>

          {created.length > 0 && (
            <section data-testid="agent-manage-created">
              <h2 className={"mb-2 text-sm font-semibold"}>刚刚创建</h2>
              <div className="space-y-1">
                {created.map((agent) => (
                  <div
                    key={agent.id}
                    className={"flex items-center justify-between rounded-md border bg-card px-3 py-2"}
                  >
                    <div>
                      <Link
                        to={`/agents/${agent.id}`}
                        className={"text-sm font-medium hover:text-primary hover:underline"}
                      >
                        {agent.display_name}
                      </Link>
                      <p className={"text-[10px] text-muted-foreground"}>
                        {agent.persona_seed_label ?? '未命名模板'} ·{' '}
                        {agent.home_voice_line_label ?? 'Qwen Social v1'} · {agent.id}
                      </p>
                    </div>
                    <SuccessBadge className="text-[10px]">活跃</SuccessBadge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </FormPageLayout>
    </div>
  )
}

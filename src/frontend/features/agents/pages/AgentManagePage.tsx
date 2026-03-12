import { useState } from 'react'
import { Link } from 'react-router'
import { useCreateAgent } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AgentCreateWizard } from '../components/AgentCreateWizard'
import type { Agent } from '@/api/types'
import { PERSONA_SEED_OPTIONS, type PersonaSeedCode } from '../persona-seeds'
import { uix } from '@/shared/utils/uix'
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
      <div className="space-y-4">
        <h1 className={uix('uix-65af6ac52c')}>智能体管理</h1>
        <div className={uix('uix-5218d295f2')}>
          <p className={uix('uix-26f026f8ad')}>
            请先通过下方工具栏切换为<strong>用户</strong>或<strong>管理员</strong>身份。
          </p>
        </div>
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
    <div className="space-y-4">
      <div>
        <h1 className={uix('uix-65af6ac52c')}>智能体管理</h1>
        <p className={uix('uix-25be576b96')}>创建和管理 LLM 智能体。当前身份：{user?.email}</p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => setWizardOpen(true)}>
          引导式创建
        </Button>
      </div>

      <AgentCreateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(agent) => {
          setWizardOpen(false)
          setCreated((prev) => [agent, ...prev])
        }}
      />

      <Card>
        <CardHeader className={uix('uix-f4cc511ff0')}>
          <CardTitle className={uix('uix-fc7473ca09')}>快速创建</CardTitle>
        </CardHeader>
        <CardContent>
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
              className={uix('uix-ebe1542709')}
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
            <p className={uix('uix-24449fdcf8')}>{createAgent.error.message}</p>
          )}
        </CardContent>
      </Card>

      {created.length > 0 && (
        <section>
          <h2 className={uix('uix-673a51ffad')}>刚刚创建</h2>
          <div className="space-y-1">
            {created.map((agent) => (
              <div key={agent.id} className={uix('uix-81af913189')}>
                <div>
                  <Link to={`/agents/${agent.id}`} className={uix('uix-9845912366')}>
                    {agent.display_name}
                  </Link>
                  <p className={uix('uix-abda0153e3')}>
                    {agent.persona_seed_label ?? '未命名模板'} ·{' '}
                    {agent.home_voice_line_label ?? 'Qwen Social v1'} · {agent.id}
                  </p>
                </div>
                <Badge variant="outline" className={uix('uix-2801f8f0b2')}>
                  活跃
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

import { useAgentTraits, useTraitDefinitions, useEquipTrait, useUnequipTrait } from '@/api/hooks'
import type { AgentTraitInfo, TraitDefinition } from '@/api/types'
import { uix } from '@/shared/utils/uix'
interface TraitPanelProps {
  agentId: string
  isOwner?: boolean
}
export default function TraitPanel({ agentId, isOwner = false }: TraitPanelProps) {
  const { data: traitsRes, isLoading: traitsLoading } = useAgentTraits(agentId)
  const { data: defsRes, isLoading: defsLoading } = useTraitDefinitions()
  const equip = useEquipTrait(agentId)
  const unequip = useUnequipTrait(agentId)
  if (traitsLoading || defsLoading) {
    return <div className={uix('uix-839cdd2e7e')}>加载特质中…</div>
  }
  const traits: AgentTraitInfo[] = traitsRes?.data ?? []
  const defs: TraitDefinition[] = defsRes?.data ?? []
  const defMap = new Map(defs.map((d) => [d.code, d]))
  const equipped = traits.filter((t) => t.status === 'equipped' && t.category === 'adjustable')
  const system = traits.filter((t) => t.category === 'system')
  const equippedCodes = new Set(
    traits.filter((t) => t.status === 'equipped').map((t) => t.trait_code),
  )
  const candidates = defs.filter((d) => d.category === 'adjustable' && !equippedCodes.has(d.code))
  return (
    <div className={uix('uix-63142bb52e')}>
      <div className="flex items-center justify-between">
        <h3 className={uix('uix-e83a7042bc')}>特质管理</h3>
        <span className={uix('uix-25be576b96')}>按行为条件解锁与装备</span>
      </div>

      {system.length > 0 && (
        <Section title="系统特质">
          {system.map((t) => {
            const def = defMap.get(t.trait_code)
            return (
              <Badge key={t.id} variant="system">
                <span className={uix('uix-618162408e')}>⚙️</span>
                {def?.emoji} {def?.name ?? t.trait_code}
              </Badge>
            )
          })}
        </Section>
      )}

      <Section title="已装备">
        {equipped.length === 0 && <span className={uix('uix-25be576b96')}>暂无已装备特质</span>}
        {equipped.map((t) => {
          const def = defMap.get(t.trait_code)
          return (
            <Badge key={t.id} variant="equipped">
              {def?.emoji} {def?.name ?? t.trait_code}
              {isOwner && (
                <button
                  className={uix('uix-57d22d46ef')}
                  disabled={unequip.isPending}
                  onClick={() => unequip.mutate(t.trait_code)}
                >
                  ✕
                </button>
              )}
            </Badge>
          )
        })}
      </Section>

      {isOwner && (
        <Section title="候选">
          {candidates.length === 0 && <span className={uix('uix-25be576b96')}>无可用候选特质</span>}
          {candidates.map((d) => (
            <Badge key={d.code} variant="candidate">
              {d.emoji} {d.name}
              <button
                className={uix('uix-0d42dcaf77')}
                disabled={equip.isPending}
                onClick={() => equip.mutate(d.code)}
              >
                +
              </button>
            </Badge>
          ))}
        </Section>
      )}
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={uix('uix-6a8eda6259')}>{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
const variantClasses = {
  system: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  equipped: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  candidate: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
} as const
function Badge({
  variant,
  children,
}: {
  variant: keyof typeof variantClasses
  children: React.ReactNode
}) {
  return (
    <span className={`${uix('uix-pill-badge-base')} ${variantClasses[variant]}`}>{children}</span>
  )
}

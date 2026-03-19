import { useAgentTraits, useTraitDefinitions, useEquipTrait, useUnequipTrait } from '@/api/hooks'
import type { AgentTraitInfo, TraitDefinition } from '@/api/types'
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
    return <div className={"animate-pulse text-sm text-muted-foreground"}>加载特质中…</div>
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
    <div className={"rounded-xl border bg-card p-5 space-y-4"}>
      <div className="flex items-center justify-between">
        <h3 className={"font-semibold"}>特质管理</h3>
        <span className={"text-xs text-muted-foreground"}>按行为条件解锁与装备</span>
      </div>

      {system.length > 0 && (
        <Section title="系统特质">
          {system.map((t) => {
            const def = defMap.get(t.trait_code)
            return (
              <Badge key={t.id} variant="system">
                <span className={"mr-1"}>⚙️</span>
                {def?.emoji} {def?.name ?? t.trait_code}
              </Badge>
            )
          })}
        </Section>
      )}

      <Section title="已装备">
        {equipped.length === 0 && <span className={"text-xs text-muted-foreground"}>暂无已装备特质</span>}
        {equipped.map((t) => {
          const def = defMap.get(t.trait_code)
          return (
            <Badge key={t.id} variant="equipped">
              {def?.emoji} {def?.name ?? t.trait_code}
              {isOwner && (
                <button
                  className={"ml-1.5 rounded px-1 text-xs hover:bg-accent/20 disabled:opacity-50"}
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
          {candidates.length === 0 && <span className={"text-xs text-muted-foreground"}>无可用候选特质</span>}
          {candidates.map((d) => (
            <Badge key={d.code} variant="candidate">
              {d.emoji} {d.name}
              <button
                className={"ml-1.5 rounded px-1 text-xs hover:bg-secondary/80 disabled:opacity-50"}
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
      <p className={"mb-1.5 text-xs font-medium text-muted-foreground"}>{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
const variantClasses = {
  system: 'bg-success/10 text-success',
  equipped: 'bg-accent/10 text-accent',
  candidate: 'bg-secondary text-secondary-foreground',
} as const
function Badge({
  variant,
  children,
}: {
  variant: keyof typeof variantClasses
  children: React.ReactNode
}) {
  return (
    <span className={`${"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"} ${variantClasses[variant]}`}>{children}</span>
  )
}

import {
  useAgentTraits,
  useTraitDefinitions,
  useEquipTrait,
  useUnequipTrait,
} from '@/api/hooks'
import type { AgentTraitInfo, TraitDefinition } from '@/api/types'

interface TraitPanelProps {
  agentId: string
  traitSlots: number
}

export default function TraitPanel({ agentId, traitSlots }: TraitPanelProps) {
  const { data: traitsRes, isLoading: traitsLoading } = useAgentTraits(agentId)
  const { data: defsRes, isLoading: defsLoading } = useTraitDefinitions()
  const equip = useEquipTrait(agentId)
  const unequip = useUnequipTrait(agentId)

  if (traitsLoading || defsLoading) {
    return <div className="animate-pulse text-sm text-muted-foreground">加载特质中…</div>
  }

  const traits: AgentTraitInfo[] = traitsRes?.data ?? []
  const defs: TraitDefinition[] = defsRes?.data ?? []
  const defMap = new Map(defs.map((d) => [d.code, d]))

  const equipped = traits.filter((t) => t.status === 'equipped' && t.category === 'adjustable')
  const system = traits.filter((t) => t.category === 'system')
  const equippedCodes = new Set(traits.filter((t) => t.status === 'equipped').map((t) => t.trait_code))

  const candidates = defs.filter(
    (d) => d.category === 'adjustable' && !equippedCodes.has(d.code),
  )

  const usedSlots = equipped.length

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">特质管理</h3>
        <span className="text-xs text-muted-foreground">
          特质槽: {usedSlots}/{traitSlots}
        </span>
      </div>

      {system.length > 0 && (
        <Section title="系统特质">
          {system.map((t) => {
            const def = defMap.get(t.trait_code)
            return (
              <Badge key={t.id} variant="system">
                <span className="mr-1">⚙️</span>
                {def?.emoji} {def?.name ?? t.trait_code}
              </Badge>
            )
          })}
        </Section>
      )}

      <Section title="已装备">
        {equipped.length === 0 && (
          <span className="text-xs text-muted-foreground">暂无已装备特质</span>
        )}
        {equipped.map((t) => {
          const def = defMap.get(t.trait_code)
          return (
            <Badge key={t.id} variant="equipped">
              {def?.emoji} {def?.name ?? t.trait_code}
              <button
                className="ml-1.5 rounded px-1 text-xs hover:bg-violet-200 dark:hover:bg-violet-800 disabled:opacity-50"
                disabled={unequip.isPending}
                onClick={() => unequip.mutate(t.trait_code)}
              >
                ✕
              </button>
            </Badge>
          )
        })}
      </Section>

      <Section title="候选">
        {candidates.length === 0 && (
          <span className="text-xs text-muted-foreground">无可用候选特质</span>
        )}
        {candidates.map((d) => (
          <Badge key={d.code} variant="candidate">
            {d.emoji} {d.name}
            <button
              className="ml-1.5 rounded px-1 text-xs hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              disabled={equip.isPending || usedSlots >= traitSlots}
              onClick={() => equip.mutate(d.code)}
            >
              +
            </button>
          </Badge>
        ))}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</p>
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
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}

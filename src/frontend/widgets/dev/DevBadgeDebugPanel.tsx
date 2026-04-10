import { useState } from 'react'
import { AlertCircle, Medal, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useBadgeDebugCatalog } from '@/api/hooks/dev'
import type {
  BadgeDebugCatalogItem,
  BadgeDebugConsistencyCheck,
  BadgeDebugSemanticContract,
  BadgeSurfacePolicy,
} from '@/api/types'

function readSourceLabel(sourceKind: BadgeDebugCatalogItem['source_kind']) {
  switch (sourceKind) {
    case 'system_display':
      return '系统'
    case 'default_display':
      return '默认'
    case 'achievement':
      return '成就'
  }
}

function BadgeIcon({ item }: { item: BadgeDebugCatalogItem }) {
  if (item.icon_src) {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
        <img src={item.icon_src} alt="" aria-hidden="true" className="size-full object-contain p-1" />
      </span>
    )
  }
  return (
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground">
      <Medal className="size-3.5" />
    </span>
  )
}

function joinOrFallback(values: string[] | undefined, fallback = '无') {
  if (!values || values.length === 0) return fallback
  return values.join(', ')
}

function readCheckTone(status: BadgeDebugConsistencyCheck['status']) {
  switch (status) {
    case 'pass':
      return 'text-emerald-600'
    case 'warn':
      return 'text-amber-600'
    case 'fail':
      return 'text-red-600'
  }
}

function SectionToggle({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border/40">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown className={`size-3 shrink-0 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {count != null && (
          <span className="text-[10px] text-muted-foreground">{count}</span>
        )}
      </button>
      {open && children}
    </div>
  )
}

interface DevBadgeDebugPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DevBadgeDebugPanel({ open, onOpenChange }: DevBadgeDebugPanelProps) {
  const badgeCatalog = useBadgeDebugCatalog(open)
  const items = badgeCatalog.data?.data ?? []
  const consistencyChecks = (badgeCatalog.data?.meta?.consistency_checks ?? []) as BadgeDebugConsistencyCheck[]
  const semanticContract = (badgeCatalog.data?.meta?.semantic_contract ?? null) as BadgeDebugSemanticContract | null
  const surfacePolicies = (badgeCatalog.data?.meta?.surface_policies ?? []) as BadgeSurfacePolicy[]

  const [expandedBadge, setExpandedBadge] = useState<string | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="w-full p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm">Launch 徽章校验台</SheetTitle>
            <Badge variant="outline" className="text-[10px]">
              {badgeCatalog.isLoading ? '...' : `${items.length} 枚`}
            </Badge>
          </div>
          <SheetDescription className="sr-only">launch 徽章定义与一致性检查</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          {badgeCatalog.isLoading ? (
            <div className="px-4 py-6 text-xs text-muted-foreground">正在读取勋章目录…</div>
          ) : badgeCatalog.error ? (
            <div className="flex items-start gap-3 px-4 py-6 text-xs text-foreground/80">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">读取失败</p>
                <p className="text-muted-foreground">
                  {badgeCatalog.error instanceof Error ? badgeCatalog.error.message : '未知错误'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <SectionToggle title="一致性检查" count={consistencyChecks.length} defaultOpen>
                <div className="space-y-0.5 px-4 pb-3">
                  {consistencyChecks.map((check) => (
                    <div key={check.key} className="flex items-baseline gap-2 py-1">
                      <span className={`text-[11px] font-medium ${readCheckTone(check.status)}`}>
                        {check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '✗'}
                      </span>
                      <span className="text-xs text-foreground">{check.label}</span>
                      <span className="text-[11px] text-muted-foreground">— {check.detail}</span>
                    </div>
                  ))}
                </div>
              </SectionToggle>

              {semanticContract && (
                <SectionToggle title="Semantic SoT">
                  <div className="space-y-1.5 px-4 pb-3">
                    <KV label="Identity" value={semanticContract.public_identity_role} />
                    <KV label="Projection" value={semanticContract.public_projection_role} />
                    <KV label="Proof" value={semanticContract.public_proof_role} />
                    <KV label="可选采用" value={joinOrFallback(semanticContract.optional_adopters)} />
                    {semanticContract.boundary_outputs.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Boundary Outputs</p>
                        {semanticContract.boundary_outputs.map((field) => (
                          <div key={field.field} className="text-[11px] text-foreground/80">
                            <span className="font-medium">{field.field}</span>
                            <span className="text-muted-foreground"> ({field.status}) — {field.note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SectionToggle>
              )}

              <SectionToggle title="Surface Policy" count={surfacePolicies.length}>
                <div className="space-y-2 px-4 pb-3">
                  {surfacePolicies.map((policy) => (
                    <div key={policy.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{policy.label}</span>
                        <span className="text-[10px] text-muted-foreground">{policy.audience}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>identity≤{policy.max_identity_badges ?? '∞'}</span>
                        <span>proof≤{policy.max_proof_badges ?? '∞'}</span>
                        <span>owner_only: {policy.allows_owner_only ? '是' : '否'}</span>
                        <span>icon_wall: {policy.allows_icon_wall ? '是' : '否'}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{policy.notes}</p>
                    </div>
                  ))}
                </div>
              </SectionToggle>

              <SectionToggle title="徽章目录" count={items.length} defaultOpen>
                <div className="divide-y divide-border/30">
                  {items.map((item) => {
                    const expanded = expandedBadge === item.key
                    return (
                      <div key={item.key}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
                          onClick={() => setExpandedBadge(expanded ? null : item.key)}
                        >
                          <BadgeIcon item={item} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-medium text-foreground">{item.name}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">{readSourceLabel(item.source_kind)}</span>
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">#{item.priority_rank}</span>
                          <ChevronDown className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? '' : '-rotate-90'}`} />
                        </button>
                        {expanded && (
                          <div className="space-y-1 bg-muted/10 px-4 py-2.5 pl-[3.75rem]">
                            <div className="mb-1.5 flex flex-wrap gap-1.5">
                              <Badge variant="secondary" className="text-[9px]">{item.badge_type}</Badge>
                              <Badge variant="outline" className="text-[9px]">{item.visibility}</Badge>
                              <Badge variant="outline" className="text-[9px]">{item.scope}</Badge>
                            </div>
                            <KV label="Family" value={`${item.family_name} / ${item.family_code}${item.tier ? ` / T${item.tier}` : ''}`} />
                            <KV label="触发" value={`${item.trigger_mode} — ${joinOrFallback(item.trigger_signals)}`} />
                            <KV label="指标" value={item.metric ?? '无'} />
                            <KV label="阈值" value={item.threshold === null ? '固定身份规则' : String(item.threshold)} />
                            <KV label="达成条件" value={item.condition_summary} />
                            <KV label="判断依据" value={item.evidence_summary} />
                            <KV label="去重" value={item.dedupe_rule} />
                            <KV label="治理过滤" value={item.governance_filter ?? '无'} />
                            <KV label="展示优先级" value={item.display_priority} />
                            <KV label="面位" value={joinOrFallback(item.public_surfaces)} />
                            <KV label="状态" value={item.implementation_status} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </SectionToggle>
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[11px]">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground/80">{value}</span>
    </div>
  )
}

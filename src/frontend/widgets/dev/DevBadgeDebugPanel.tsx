import { useState } from 'react'
import { AlertCircle, Medal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useBadgeDebugCatalog } from '@/api/hooks/dev'
import type { BadgeDebugCatalogItem, BadgeDebugConsistencyCheck } from '@/api/types'

function readSourceLabel(sourceKind: BadgeDebugCatalogItem['source_kind']) {
  switch (sourceKind) {
    case 'system_display':
      return '系统展示'
    case 'default_display':
      return '默认展示'
    case 'achievement':
      return '成就勋章'
  }
}

function BadgeIcon({ item }: { item: BadgeDebugCatalogItem }) {
  if (item.icon_src) {
    return (
      <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
        <img src={item.icon_src} alt="" aria-hidden="true" className="size-full object-contain p-1.5" />
      </span>
    )
  }

  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/30 text-muted-foreground">
      <Medal className="size-4" />
    </span>
  )
}

function DebugField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-3">
      <p className="text-[11px] font-medium tracking-[0.02em] text-muted-foreground">{label}</p>
      <p className="text-xs leading-relaxed text-foreground/80">{value}</p>
    </div>
  )
}

function joinOrFallback(values: string[] | undefined, fallback = '无') {
  if (!values || values.length === 0) return fallback
  return values.join(' / ')
}

function readCheckTone(status: BadgeDebugConsistencyCheck['status']) {
  switch (status) {
    case 'pass':
      return 'default'
    case 'warn':
      return 'secondary'
    case 'fail':
      return 'destructive'
  }
}

export function DevBadgeDebugPanel() {
  const [open, setOpen] = useState(false)
  const badgeCatalog = useBadgeDebugCatalog(open)
  const items = badgeCatalog.data?.data ?? []
  const consistencyChecks = Array.isArray(badgeCatalog.data?.meta?.consistency_checks)
    ? badgeCatalog.data?.meta?.consistency_checks as BadgeDebugConsistencyCheck[]
    : []

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
          勋章调试
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
        <SheetHeader className="gap-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <SheetTitle>Launch 徽章校验台</SheetTitle>
            <Badge variant="outline" className="text-[10px]">
              {badgeCatalog.isLoading ? '加载中' : `${items.length} 条`}
            </Badge>
          </div>
          <SheetDescription className="sr-only">launch 徽章定义与一致性检查</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8.5rem)]">
          {badgeCatalog.isLoading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">正在读取勋章目录…</div>
          ) : badgeCatalog.error ? (
            <div className="flex items-start gap-3 px-4 py-6 text-sm text-foreground/80">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">勋章目录读取失败</p>
                <p className="text-xs text-muted-foreground">
                  {badgeCatalog.error instanceof Error ? badgeCatalog.error.message : '未知错误'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 px-4 py-4">
              <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">定义一致性检查</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {consistencyChecks.length} 项
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {consistencyChecks.map((check) => (
                    <div
                      key={check.key}
                      className="rounded-xl border border-border/60 bg-background/80 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-foreground">{check.label}</p>
                        <Badge variant={readCheckTone(check.status)} className="text-[10px]">
                          {check.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-background/60">
              {items.map((item) => (
                <section key={item.key} className="py-4">
                  <div className="flex items-start gap-3 px-4">
                    <BadgeIcon item={item} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
                            <span className="text-[11px] text-muted-foreground">
                              {readSourceLabel(item.source_kind)}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {item.badge_type}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {item.visibility}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {item.scope}
                            </Badge>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          rank {item.priority_rank}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <DebugField
                          label="Family"
                          value={`${item.family_name} / ${item.family_code}${item.tier ? ` / T${item.tier}` : ''}`}
                        />
                        <DebugField label="触发模式" value={item.trigger_mode} />
                        <DebugField
                          label="触发/指标"
                          value={`${joinOrFallback(item.trigger_signals)} / ${item.metric ?? '无'}`}
                        />
                        <DebugField label="阈值" value={item.threshold === null ? '固定身份规则' : String(item.threshold)} />
                        <DebugField label="达成条件" value={item.condition_summary} />
                        <DebugField label="判断依据" value={item.evidence_summary} />
                        <DebugField label="前置条件" value={joinOrFallback(item.prerequisites)} />
                        <DebugField label="冷却" value={item.cooldown_rule} />
                        <DebugField label="证据规则" value={item.evidence_rule} />
                        <DebugField label="成功口径" value={item.success_rule} />
                        <DebugField label="去重规则" value={item.dedupe_rule} />
                        <DebugField label="治理过滤" value={item.governance_filter ?? '无'} />
                        <DebugField label="展示优先级" value={item.display_priority} />
                        <DebugField label="公开面位" value={joinOrFallback(item.public_surfaces)} />
                        <DebugField label="产品目标" value={item.product_goal} />
                        <DebugField label="实现状态" value={item.implementation_status} />
                      </div>
                    </div>
                  </div>
                </section>
              ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

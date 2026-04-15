import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  readFrontendFlagDebugEntries,
  type FrontendFlagDebugEntry,
} from '@/shared/config/frontend-flags'

interface DevFrontendFlagsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DevFrontendFlagsPanel({ open, onOpenChange }: DevFrontendFlagsPanelProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const entries = useMemo(() => readFrontendFlagDebugEntries(), [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="w-full p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm">Frontend Flags</SheetTitle>
            <Badge variant="outline" className="text-[10px]">
              dev-only
            </Badge>
          </div>
          <SheetDescription className="text-xs">
            只读展示当前前端功能门状态与调试指令，不再在浏览器里覆写 VITE 值。
          </SheetDescription>
        </SheetHeader>

        <div className="h-[calc(100vh-10rem)] overflow-y-auto">
          <div className="min-w-0 w-full">
            <div className="divide-y divide-border/40">
              {entries.map((entry) => {
                const expanded = expandedKey === entry.key

                return (
                  <div key={entry.key}>
                    <div className="px-4 py-2.5">
                      <button
                        type="button"
                        className="flex w-full min-w-0 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        onClick={() => setExpandedKey(expanded ? null : entry.key)}
                      >
                        <ChevronDown
                          className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? '' : '-rotate-90'}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                          {entry.label}
                          <span className="font-normal text-muted-foreground">：{entry.summary}</span>
                        </span>
                        <span
                          className={cn(
                            'ml-auto shrink-0 whitespace-nowrap pl-3 text-[11px] font-medium',
                            entry.value === 'true' ? 'text-success' : 'text-destructive',
                          )}
                        >
                          {entry.value === 'true' ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>
                    {expanded && (
                      <div className="space-y-1 px-4 pb-3 pl-9 text-[11px] text-muted-foreground">
                        <p className="font-mono text-[10px]">{entry.key}</p>
                        <p>当前值: {entry.value}</p>
                        <p>来源: {renderSourceLabel(entry)}</p>
                        <p>{entry.feature}</p>
                        <p>界面: {entry.surfaces.join(', ')}</p>
                        <p>效果: {entry.effect}</p>
                        <p>建议: {entry.recommendation}</p>
                        {entry.debugCommands && entry.debugCommands.length > 0 && (
                          <div className="pt-1">
                            <p className="mb-1 text-foreground">调试方式</p>
                            <div className="space-y-2">
                              {entry.debugCommands.map((item) => (
                                <div
                                  key={`${entry.key}-${item.label}`}
                                  className="max-w-full rounded-md border border-border/60 px-3 py-2"
                                >
                                  <p className="mb-1 text-xs font-medium text-foreground">{item.label}</p>
                                  <pre className="max-w-full overflow-x-auto rounded bg-muted/60 px-2 py-1.5 text-[10px] text-foreground">
                                    <code>{item.command}</code>
                                  </pre>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {entry.contractStatus === 'declared' && (
                          <Badge variant="outline" className="mt-1 text-[9px]">
                            contract
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function renderSourceLabel(entry: FrontendFlagDebugEntry) {
  return entry.source === 'vite-env' ? 'VITE env' : 'repo default'
}

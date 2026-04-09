import { useState } from 'react'
import { RotateCcw, RefreshCw, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DEV_FRONTEND_FLAG_PRESET_LABELS,
  FRONTEND_FLAG_DEFINITIONS,
  type DevFrontendFlagPreset,
  type FrontendFlagValue,
  resolveFrontendFlagValuesForConfig,
} from '@/shared/config/frontend-flags'
import { useDevFrontendFlagsStore } from '@/shared/stores/dev-frontend-flags-store'

function areConfigsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

interface DevFrontendFlagsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DevFrontendFlagsPanel({ open, onOpenChange }: DevFrontendFlagsPanelProps) {
  const draftConfig = useDevFrontendFlagsStore((state) => state.draftConfig)
  const activeConfig = useDevFrontendFlagsStore((state) => state.activeConfig)
  const setPreset = useDevFrontendFlagsStore((state) => state.setPreset)
  const setFlagValue = useDevFrontendFlagsStore((state) => state.setFlagValue)
  const resetToInherit = useDevFrontendFlagsStore((state) => state.resetToInherit)
  const resetToActive = useDevFrontendFlagsStore((state) => state.resetToActive)

  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const activeValues = resolveFrontendFlagValuesForConfig(activeConfig)
  const nextValues = resolveFrontendFlagValuesForConfig(draftConfig)
  const hasPendingChanges = !areConfigsEqual(draftConfig, activeConfig)
  const pendingCount = FRONTEND_FLAG_DEFINITIONS.filter(
    (d) => activeValues[d.key] !== nextValues[d.key],
  ).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="w-full p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm">Frontend Flags</SheetTitle>
            <Badge variant="outline" className="text-[10px]">dev-only</Badge>
          </div>
          <SheetDescription className="text-xs">
            覆写本地 dev 前端功能门，刷新后生效。
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
          <Select
            value={draftConfig.preset}
            onValueChange={(value) => setPreset(value as DevFrontendFlagPreset)}
          >
            <SelectTrigger size="sm" className="h-7 min-w-36 text-xs">
              <SelectValue placeholder="选择模式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">{DEV_FRONTEND_FLAG_PRESET_LABELS.inherit}</SelectItem>
              <SelectItem value="launch">{DEV_FRONTEND_FLAG_PRESET_LABELS.launch}</SelectItem>
              <SelectItem value="custom">{DEV_FRONTEND_FLAG_PRESET_LABELS.custom}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetToInherit}>
              <RotateCcw className="size-3" />
              重置
            </Button>
            {hasPendingChanges && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetToActive}>
                撤销
              </Button>
            )}
            <Button type="button" size="sm" className="h-7 px-2.5 text-xs" onClick={() => window.location.reload()}>
              <RefreshCw className="size-3" />
              刷新
            </Button>
          </div>
        </div>

        {hasPendingChanges && (
          <div className="border-b border-border/60 bg-warning/10 px-4 py-1.5 text-[11px] text-foreground/70">
            {pendingCount} 项变更待刷新
          </div>
        )}

        <ScrollArea className="h-[calc(100vh-10rem)]">
          <div className="divide-y divide-border/40">
            {FRONTEND_FLAG_DEFINITIONS.map((definition) => {
              const activeValue = activeValues[definition.key]
              const nextValue = nextValues[definition.key]
              const pending = activeValue !== nextValue
              const expanded = expandedKey === definition.key

              return (
                <div key={definition.key}>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      onClick={() => setExpandedKey(expanded ? null : definition.key)}
                    >
                      <ChevronDown className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? '' : '-rotate-90'}`} />
                      <span className="truncate text-xs font-medium text-foreground">{definition.label}</span>
                      {pending && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    </button>
                    <FlagToggle value={nextValue} onChange={(v) => setFlagValue(definition.key, v)} />
                  </div>
                  {expanded && (
                    <div className="space-y-1 px-4 pb-3 pl-9 text-[11px] text-muted-foreground">
                      <p className="font-mono text-[10px]">{definition.key}</p>
                      <p>{definition.feature}</p>
                      <p>界面: {definition.surfaces.join(', ')}</p>
                      <p>效果: {definition.effect}</p>
                      {definition.contractStatus === 'declared' && (
                        <Badge variant="outline" className="mt-1 text-[9px]">contract</Badge>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function FlagToggle({
  value,
  onChange,
}: {
  value: FrontendFlagValue
  onChange: (value: FrontendFlagValue) => void
}) {
  const isOn = value === 'true'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 ${isOn ? 'bg-primary' : 'bg-muted'}`}
      onClick={() => onChange(isOn ? 'false' : 'true')}
    >
      <span className={`pointer-events-none inline-block size-3.5 rounded-full bg-background shadow-sm ring-0 transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

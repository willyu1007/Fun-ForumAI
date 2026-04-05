import { RotateCcw, RefreshCw, SlidersHorizontal } from 'lucide-react'
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
  SheetTrigger,
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

function readFlagLabel(value: FrontendFlagValue) {
  return value === 'true' ? '开启' : '关闭'
}

export function DevFrontendFlagsPanel() {
  const panelOpen = useDevFrontendFlagsStore((state) => state.panelOpen)
  const draftConfig = useDevFrontendFlagsStore((state) => state.draftConfig)
  const activeConfig = useDevFrontendFlagsStore((state) => state.activeConfig)
  const setPanelOpen = useDevFrontendFlagsStore((state) => state.setPanelOpen)
  const setPreset = useDevFrontendFlagsStore((state) => state.setPreset)
  const setFlagValue = useDevFrontendFlagsStore((state) => state.setFlagValue)
  const resetToInherit = useDevFrontendFlagsStore((state) => state.resetToInherit)
  const resetToActive = useDevFrontendFlagsStore((state) => state.resetToActive)

  const activeValues = resolveFrontendFlagValuesForConfig(activeConfig)
  const nextValues = resolveFrontendFlagValuesForConfig(draftConfig)
  const hasPendingChanges = !areConfigsEqual(draftConfig, activeConfig)

  return (
    <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
          <SlidersHorizontal className="size-3.5" />
          VITE 功能
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
        <SheetHeader className="gap-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              dev-only
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              staging 不暴露
            </Badge>
          </div>
          <SheetTitle>Frontend Flags</SheetTitle>
          <SheetDescription>
            这里只覆写本地 dev 的前端功能门。staging 保持固定 surface，不提供选择入口。
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">当前模式</p>
            <p className="text-xs text-muted-foreground">
              `Launch / staging-like` 会复用 canonical launch build profile 的前端组合。
            </p>
          </div>
          <Select
            value={draftConfig.preset}
            onValueChange={(value) => setPreset(value as DevFrontendFlagPreset)}
          >
            <SelectTrigger size="sm" className="min-w-44">
              <SelectValue placeholder="选择模式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">{DEV_FRONTEND_FLAG_PRESET_LABELS.inherit}</SelectItem>
              <SelectItem value="launch">{DEV_FRONTEND_FLAG_PRESET_LABELS.launch}</SelectItem>
              <SelectItem value="custom">{DEV_FRONTEND_FLAG_PRESET_LABELS.custom}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">应用方式</p>
            <p className="text-xs text-muted-foreground">
              修改会先保存到本地。点击刷新后，新页面会按这组 flags 重新加载。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={resetToInherit}>
              <RotateCcw className="size-3.5" />
              清空覆写
            </Button>
            {hasPendingChanges ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={resetToActive}
              >
                恢复已加载值
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="size-3.5" />
              刷新应用
            </Button>
          </div>
        </div>

        {hasPendingChanges ? (
          <div className="border-b border-border/60 bg-warning/10 px-4 py-2 text-xs text-foreground/80">
            当前有未应用的 frontend flag 变更。刷新页面后才会真正生效。
          </div>
        ) : null}

        <ScrollArea className="h-[calc(100vh-13rem)]">
          <div className="space-y-3 px-4 py-4">
            {FRONTEND_FLAG_DEFINITIONS.map((definition) => {
              const activeValue = activeValues[definition.key]
              const nextValue = nextValues[definition.key]
              const pending = activeValue !== nextValue

              return (
                <section key={definition.key} className="space-y-3 rounded-xl border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground">{definition.label}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {definition.key}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          当前 {readFlagLabel(activeValue)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          刷新后 {readFlagLabel(nextValue)}
                        </Badge>
                        {pending ? (
                          <Badge className="text-[10px]">
                            待刷新
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-[10px]">
                          {definition.contractStatus === 'declared' ? 'contract 已声明' : 'code-only'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{definition.feature}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={nextValue === 'false' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setFlagValue(definition.key, 'false')}
                      >
                        关
                      </Button>
                      <Button
                        type="button"
                        variant={nextValue === 'true' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setFlagValue(definition.key, 'true')}
                      >
                        开
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>界面：{definition.surfaces.join(' / ')}</p>
                    <p>效果：{definition.effect}</p>
                    <p>建议：{definition.recommendation}</p>
                  </div>
                </section>
              )
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

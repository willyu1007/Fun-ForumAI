import { useQueryClient } from '@tanstack/react-query'
interface NewContentBannerProps {
  count: number
  onRefresh: () => void
  queryKey: readonly unknown[]
}
export function NewContentBanner({ count, onRefresh, queryKey }: NewContentBannerProps) {
  const qc = useQueryClient()
  if (count <= 0) return null
  return (
    <div className="mb-3 flex items-center gap-2 px-[18px]">
      <button
        type="button"
        onClick={() => {
          qc.invalidateQueries({ queryKey })
          onRefresh()
        }}
        className="inline-flex shrink-0 items-center text-[11px] font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground"
      >
        {count} 条更新
      </button>
      <div className="h-px flex-1 bg-border/60" aria-hidden="true" />
    </div>
  )
}

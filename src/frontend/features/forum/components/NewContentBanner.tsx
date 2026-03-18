import { useQueryClient } from '@tanstack/react-query'
interface NewContentBannerProps {
  count: number
  label: string
  onRefresh: () => void
  queryKey: readonly unknown[]
}
export function NewContentBanner({ count, label, onRefresh, queryKey }: NewContentBannerProps) {
  const qc = useQueryClient()
  if (count <= 0) return null
  return (
    <button
      onClick={() => {
        qc.invalidateQueries({ queryKey })
        onRefresh()
      }}
      className={"mb-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"}
    >
      <span className={"inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"}>{count}</span>
      {label}，点击查看
    </button>
  )
}

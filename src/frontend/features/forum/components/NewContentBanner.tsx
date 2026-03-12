import { useQueryClient } from '@tanstack/react-query'
import { uix } from '@/shared/utils/uix'
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
      className={uix('uix-58b120703b')}
    >
      <span className={uix('uix-d75efe1183')}>{count}</span>
      {label}，点击查看
    </button>
  )
}

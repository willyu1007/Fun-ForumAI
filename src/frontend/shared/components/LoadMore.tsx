import { Button } from '@/components/ui/button'

interface LoadMoreProps {
  hasMore: boolean
  isLoading: boolean
  onLoad: () => void
}

export function LoadMore({ hasMore, isLoading, onLoad }: LoadMoreProps) {
  if (!hasMore) return null
  return (
    <div className="flex justify-center py-4">
      <Button variant="outline" size="sm" onClick={onLoad} disabled={isLoading}>
        {isLoading ? '加载中…' : '加载更多'}
      </Button>
    </div>
  )
}

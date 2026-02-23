import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface LoadMoreProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore?: () => void
  onLoad?: () => void
}

export function LoadMore({ hasMore, isLoading, onLoadMore, onLoad }: LoadMoreProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadFn = onLoadMore ?? onLoad

  useEffect(() => {
    if (!hasMore || isLoading || !loadFn) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadFn()
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoading, loadFn])

  if (!hasMore) return null

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      <Button variant="outline" size="sm" onClick={loadFn} disabled={isLoading}>
        {isLoading ? '加载中…' : '加载更多'}
      </Button>
    </div>
  )
}

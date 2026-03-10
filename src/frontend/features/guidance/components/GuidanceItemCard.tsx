import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GuidanceItemCard as GuidanceItemCardView } from '@/api/types'
import { relativeTime } from '@/shared/utils/relative-time'
import { useGuidanceItemAction } from '@/api/hooks'

export function GuidanceItemCard({ item }: { item: GuidanceItemCardView }) {
  const itemAction = useGuidanceItemAction()

  const handleOpen = () => {
    itemAction.mutate({ item_id: item.id, action: 'open' })
  }

  return (
    <Card className={item.unread ? 'border-amber-300/80 bg-amber-50/40' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{item.module_type === 'RECEIPT' ? '回执' : '提示'}</Badge>
              {item.unread && <Badge className="bg-amber-600 text-white">New</Badge>}
            </div>
            <CardTitle className="mt-2 text-base">{item.title}</CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground">{relativeTime(item.updated_at)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{item.body}</p>
        <div className="flex flex-wrap items-center gap-2">
          {item.cta && (
            <Button asChild size="sm" onClick={handleOpen}>
              <Link to={item.cta.target}>{item.cta.label}</Link>
            </Button>
          )}
          {item.status === 'ACTIVE' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => itemAction.mutate({ item_id: item.id, action: 'dismiss' })}
            >
              暂时收起
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

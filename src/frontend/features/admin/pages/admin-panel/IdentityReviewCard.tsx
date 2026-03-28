import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminPanelController } from './use-admin-panel-controller'

type ReviewSlice = AdminPanelController['review']

export function IdentityReviewCard({ review }: { review: ReviewSlice }) {
  const latestByUser = [] as NonNullable<ReviewSlice['identityReviews']>['data']
  const seenUserIds = new Set<string>()
  for (const item of review.identityReviews?.data ?? []) {
    if (seenUserIds.has(item.user_id)) continue
    seenUserIds.add(item.user_id)
    latestByUser.push(item)
  }

  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>实名审核</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {latestByUser.slice(0, 8).map((item) => (
          <div key={item.id} className={"flex items-center justify-between rounded-md border bg-card px-3 py-2"}>
            <div>
              <p className={"text-xs font-medium"}>{item.user_id}</p>
              <p className={"text-[10px] text-muted-foreground"}>{item.status}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  review.resolveIdentity.mutate({
                    user_id: item.user_id,
                    status: 'VERIFIED',
                  })
                }
              >
                通过
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  review.resolveIdentity.mutate({
                    user_id: item.user_id,
                    status: 'REJECTED',
                  })
                }
              >
                驳回
              </Button>
            </div>
          </div>
        ))}
        {latestByUser.length === 0 && (
          <p className={"text-[10px] text-muted-foreground"}>暂无实名审核记录。</p>
        )}
      </CardContent>
    </Card>
  )
}

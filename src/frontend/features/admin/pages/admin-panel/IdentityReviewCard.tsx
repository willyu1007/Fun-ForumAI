import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { uix } from '@/shared/utils/uix'
import type { AdminPanelController } from './use-admin-panel-controller'

type ReviewSlice = AdminPanelController['review']

export function IdentityReviewCard({ review }: { review: ReviewSlice }) {
  return (
    <Card>
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>实名审核</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(review.identityReviews?.data ?? []).slice(0, 8).map((item) => (
          <div key={item.id} className={uix('uix-81af913189')}>
            <div>
              <p className={uix('uix-da8bf29040')}>{item.user_id}</p>
              <p className={uix('uix-abda0153e3')}>{item.status}</p>
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
        {(review.identityReviews?.data ?? []).length === 0 && (
          <p className={uix('uix-abda0153e3')}>暂无实名审核记录。</p>
        )}
      </CardContent>
    </Card>
  )
}

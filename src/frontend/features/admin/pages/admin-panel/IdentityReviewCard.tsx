import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useReviewController } from './use-review-controller'

export function IdentityReviewCard() {
  const review = useReviewController()
  const latestByUser = [] as NonNullable<ReturnType<typeof useReviewController>['identityReviews']>['data']
  const seenUserIds = new Set<string>()
  for (const item of review.identityReviews?.data ?? []) {
    if (seenUserIds.has(item.user_id)) continue
    seenUserIds.add(item.user_id)
    latestByUser.push(item)
  }

  return (
    <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
      <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">实名认证审核</h2>
      <div data-ui="stack" data-direction="col" data-gap="4">
        <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
          {latestByUser.slice(0, 8).map((item) => (
            <li key={item.id} data-ui="card" data-variant="outlined" data-padding="sm" className="flex items-center justify-between">
              <div>
                <p data-ui="text" data-variant="caption" className="font-medium">{item.user_id}</p>
                <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">{item.status}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={review.resolveIdentity.isPending}
                  onClick={() =>
                    review.resolveIdentity.mutate({
                      user_id: item.user_id,
                      status: 'VERIFIED',
                    })
                  }
                >
                  通过
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={review.resolveIdentity.isPending}>
                      驳回
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>确认驳回</DialogTitle>
                      <DialogDescription>
                        您确定要驳回用户 {item.user_id} 的实名认证吗？
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">取消</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          variant="destructive"
                          onClick={() =>
                            review.resolveIdentity.mutate({
                              user_id: item.user_id,
                              status: 'REJECTED',
                            })
                          }
                        >
                          确认驳回
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </li>
          ))}
        </ul>
        {latestByUser.length === 0 && (
          <p data-ui="text" data-variant="caption" data-tone="muted">暂无实名审核记录。</p>
        )}
      </div>
    </section>
  )
}

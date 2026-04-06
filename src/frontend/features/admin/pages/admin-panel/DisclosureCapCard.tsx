import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { renderCapOverrideSummary } from './constants'
import type { AdminPanelController } from './use-admin-panel-controller'

type DisclosureCapsSlice = AdminPanelController['disclosureCaps']

export function DisclosureCapCard({
  disclosureCaps,
}: {
  disclosureCaps: DisclosureCapsSlice
}) {
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>Disclosure Cap 管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <label htmlFor="disclosure-cap-scope-type" className="sr-only">
            Cap 作用域类型
          </label>
          <select
            id="disclosure-cap-scope-type"
            name="disclosure-cap-scope-type"
            value={disclosureCaps.scopeType}
            onChange={(event) =>
              disclosureCaps.setScopeType(event.target.value as 'agent' | 'community')
            }
            className={"h-8 w-full rounded-md border bg-background px-2 text-xs"}
          >
            <option value="agent">agent</option>
            <option value="community">community</option>
          </select>
          <label htmlFor="disclosure-cap-scope-id" className="sr-only">
            Cap 作用域 ID
          </label>
          <Input
            id="disclosure-cap-scope-id"
            name="disclosure-cap-scope-id"
            placeholder="scope id"
            value={disclosureCaps.scopeId}
            onChange={(event) => disclosureCaps.setScopeId(event.target.value)}
          />
          <label htmlFor="disclosure-cap-level" className="sr-only">
            Cap 级别
          </label>
          <select
            id="disclosure-cap-level"
            name="disclosure-cap-level"
            value={disclosureCaps.capLevel}
            onChange={(event) => disclosureCaps.setCapLevel(event.target.value)}
            className={"h-8 w-full rounded-md border bg-background px-2 text-xs"}
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <label htmlFor="disclosure-cap-reason" className="sr-only">
          设置原因
        </label>
        <Input
          id="disclosure-cap-reason"
          name="disclosure-cap-reason"
          placeholder="设置原因（选填）"
          value={disclosureCaps.capReason}
          onChange={(event) => disclosureCaps.setCapReason(event.target.value)}
        />
        <Button
          size="sm"
          onClick={() => {
            void disclosureCaps.handleCreateCapOverride()
          }}
          disabled={disclosureCaps.createMutation.isPending || !disclosureCaps.scopeId.trim()}
        >
          {disclosureCaps.createMutation.isPending ? '设置中…' : '设置 Cap Override'}
        </Button>
        <label htmlFor="disclosure-cap-release-reason" className="sr-only">
          释放原因
        </label>
        <Input
          id="disclosure-cap-release-reason"
          name="disclosure-cap-release-reason"
          placeholder="释放原因（选填）"
          value={disclosureCaps.releaseCapReason}
          onChange={(event) => disclosureCaps.setReleaseCapReason(event.target.value)}
        />
        {disclosureCaps.query?.data?.active_override && (
          <div className={"rounded-md border p-3"}>
            <p className={"text-xs font-medium"}>Active Override</p>
            <p className={"text-[10px] text-muted-foreground"}>
              {renderCapOverrideSummary(disclosureCaps.query.data.active_override)}
            </p>
            <Button
              size="sm"
              variant="outline"
              className={"mt-2"}
              onClick={() =>
                disclosureCaps.handleReleaseCapOverride(
                  disclosureCaps.query!.data.active_override!.id,
                )
              }
              disabled={disclosureCaps.releaseMutation.isPending}
            >
              {disclosureCaps.releaseMutation.isPending ? '释放中…' : '释放当前 Override'}
            </Button>
          </div>
        )}
        <div className="space-y-2">
          <p className={"text-xs font-medium"}>Recent Override History</p>
          {(disclosureCaps.query?.data?.history ?? []).slice(0, 4).map((item) => (
            <div key={item.id} className={"rounded-md border p-3"}>
              <p className={"text-xs font-medium"}>{renderCapOverrideSummary(item)}</p>
              <p className={"text-[10px] text-muted-foreground"}>{item.reason ?? '无原因'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { uix } from '@/shared/utils/uix'
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
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Disclosure Cap 管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            value={disclosureCaps.scopeType}
            onChange={(event) =>
              disclosureCaps.setScopeType(event.target.value as 'agent' | 'community')
            }
            className={uix('uix-34e5554f24')}
          >
            <option value="agent">agent</option>
            <option value="community">community</option>
          </select>
          <Input
            placeholder="scope id"
            value={disclosureCaps.scopeId}
            onChange={(event) => disclosureCaps.setScopeId(event.target.value)}
          />
          <select
            value={disclosureCaps.capLevel}
            onChange={(event) => disclosureCaps.setCapLevel(event.target.value)}
            className={uix('uix-34e5554f24')}
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <Input
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
        <Input
          placeholder="释放原因（选填）"
          value={disclosureCaps.releaseCapReason}
          onChange={(event) => disclosureCaps.setReleaseCapReason(event.target.value)}
        />
        {disclosureCaps.query?.data?.active_override && (
          <div className={uix('uix-3ff7f9f76c')}>
            <p className={uix('uix-da8bf29040')}>Active Override</p>
            <p className={uix('uix-abda0153e3')}>
              {renderCapOverrideSummary(disclosureCaps.query.data.active_override)}
            </p>
            <Button
              size="sm"
              variant="outline"
              className={uix('uix-4d2deea2bf')}
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
          <p className={uix('uix-da8bf29040')}>Recent Override History</p>
          {(disclosureCaps.query?.data?.history ?? []).slice(0, 4).map((item) => (
            <div key={item.id} className={uix('uix-3ff7f9f76c')}>
              <p className={uix('uix-da8bf29040')}>{renderCapOverrideSummary(item)}</p>
              <p className={uix('uix-abda0153e3')}>{item.reason ?? '无原因'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

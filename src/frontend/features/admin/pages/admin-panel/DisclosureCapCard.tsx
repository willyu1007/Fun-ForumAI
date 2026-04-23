import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { renderCapOverrideSummary } from './constants'
import { useDisclosureCapsController } from './use-governance-controller'

export function DisclosureCapCard() {
  const disclosureCaps = useDisclosureCapsController()

  return (
    <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
      <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">曝光限流管理</h2>
      <div data-ui="stack" data-direction="col" data-gap="4">
        <div data-ui="grid" data-gap="2" className="sm:grid-cols-3">
          <label htmlFor="disclosure-cap-scope-type" className="sr-only">
            Cap 作用域类型
          </label>
          <Select
            value={disclosureCaps.scopeType}
            onValueChange={(value) => disclosureCaps.setScopeType(value as 'agent' | 'community')}
          >
            <SelectTrigger id="disclosure-cap-scope-type" aria-label="Cap 作用域类型">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">agent</SelectItem>
              <SelectItem value="community">community</SelectItem>
            </SelectContent>
          </Select>
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
          <Select
            value={disclosureCaps.capLevel}
            onValueChange={(value) => disclosureCaps.setCapLevel(value)}
          >
            <SelectTrigger id="disclosure-cap-level" aria-label="Cap 级别">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {disclosureCaps.createMutation.isPending ? '设置中…' : '设置限流规则'}
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
          <div className="rounded-md border p-3">
            <p data-ui="text" data-variant="caption" className="font-medium">当前生效的限流规则</p>
            <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
              {renderCapOverrideSummary(disclosureCaps.query.data.active_override)}
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={disclosureCaps.releaseMutation.isPending}
                >
                  {disclosureCaps.releaseMutation.isPending ? '释放中…' : '释放当前规则'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>确认释放规则</DialogTitle>
                  <DialogDescription>
                    您确定要释放此限流规则吗？
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
                        disclosureCaps.handleReleaseCapOverride(
                          disclosureCaps.query!.data.active_override!.id,
                        )
                      }
                    >
                      确认释放
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        <div data-ui="stack" data-direction="col" data-gap="2">
          <p data-ui="text" data-variant="caption" className="font-medium">历史限流记录</p>
          <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
            {(disclosureCaps.query?.data?.history ?? []).slice(0, 4).map((item) => (
              <li key={item.id} className="flex flex-col justify-center rounded-md border bg-card px-3 py-2">
                <p data-ui="text" data-variant="caption" className="font-medium">{renderCapOverrideSummary(item)}</p>
                <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">{item.reason ?? '无原因'}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

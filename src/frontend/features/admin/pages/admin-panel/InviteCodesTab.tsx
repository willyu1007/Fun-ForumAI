import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAdminInviteCodes } from '@/api/hooks'

export function InviteCodesTab() {
  const { data, isLoading, error } = useAdminInviteCodes()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const inviteCodes = data?.data ?? []

  const handleCopy = async (sharePath: string, code: string) => {
    const absoluteLink = `${window.location.origin}${sharePath}`
    await navigator.clipboard.writeText(absoluteLink)
    setCopiedCode(code)
    window.setTimeout(() => {
      setCopiedCode((current) => (current === code ? null : current))
    }, 1500)
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">邀请码加载中…</p>
  }

  if (error) {
    return <p className="text-sm text-destructive">邀请码加载失败，请刷新重试。</p>
  }

  return (
    <div data-ui="stack" data-direction="col" data-gap="0">
      <section data-ui="section" className="border-b border-border pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">邀请码列表</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          当前固定开放 10 个 6 位数字邀请码。注册链接会自动带上同一组 code。
        </p>

        <ul data-ui="list" data-variant="admin-rows">
          {inviteCodes.map((inviteCode) => (
            <li
              key={inviteCode.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3"
              data-testid={`invite-code-${inviteCode.code}`}
            >
              <div data-ui="stack" data-direction="col" data-gap="1">
                <div data-ui="stack" data-direction="row" data-align="center" data-gap="2">
                  <span className="font-mono text-base font-semibold">{inviteCode.code}</span>
                  <Badge variant={inviteCode.status === 'ACTIVE' ? 'outline' : 'secondary'}>
                    {inviteCode.status === 'ACTIVE' ? '可用' : '停用'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  已用 {inviteCode.usedCount} / {inviteCode.maxUses}
                  {' · '}
                  剩余 {inviteCode.remainingUses}
                </p>
                <p data-ui="text" data-variant="caption" data-tone="muted">
                  {inviteCode.note ?? '未备注'}
                  {' · '}
                  最近使用{' '}
                  {inviteCode.lastUsedAt ? new Date(inviteCode.lastUsedAt).toLocaleString('zh-CN') : '暂无'}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy(inviteCode.sharePath, inviteCode.code)}
              >
                {copiedCode === inviteCode.code ? '已复制' : '复制邀请链接'}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

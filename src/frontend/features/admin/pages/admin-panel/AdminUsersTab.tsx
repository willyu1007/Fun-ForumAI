import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminUsers, useGrantAdminAccess, useRevokeAdminAccess } from '@/api/hooks'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return fallback
}

export function AdminUsersTab() {
  const { data, isLoading, error } = useAdminUsers()
  const grantAdminAccess = useGrantAdminAccess()
  const revokeAdminAccess = useRevokeAdminAccess()

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  const admins = data?.data ?? []
  const hasEmail = email.trim().length > 0
  const hasPhone = phone.trim().length > 0
  const canSubmit = (hasEmail || hasPhone) && !(hasEmail && hasPhone)

  const handleGrant = async () => {
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()
    if ((!trimmedEmail && !trimmedPhone) || (trimmedEmail && trimmedPhone)) {
      setErrorText('请填写邮箱或手机号其一。')
      setNotice(null)
      return
    }

    try {
      const result = await grantAdminAccess.mutateAsync({
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      })
      setEmail('')
      setPhone('')
      setErrorText(null)
      setNotice(`已授予管理员：${result.data.displayName}`)
    } catch (mutationError) {
      setNotice(null)
      setErrorText(getErrorMessage(mutationError, '管理员授予失败，请确认账号已存在。'))
    }
  }

  const handleRevoke = async (userId: string, displayName: string) => {
    try {
      await revokeAdminAccess.mutateAsync({ userId })
      setErrorText(null)
      setNotice(`已撤销管理员：${displayName}`)
    } catch (mutationError) {
      setNotice(null)
      setErrorText(getErrorMessage(mutationError, '撤销管理员失败，请稍后重试。'))
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">管理员列表加载中…</p>
  }

  if (error) {
    return <p className="text-sm text-destructive">管理员列表加载失败，请刷新重试。</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input
            aria-label="管理员邮箱"
            placeholder="通过邮箱授予管理员"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            aria-label="管理员手机号"
            placeholder="通过手机号授予管理员"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Button
            type="button"
            onClick={() => void handleGrant()}
            disabled={!canSubmit || grantAdminAccess.isPending}
          >
            {grantAdminAccess.isPending ? '授予中…' : '授予管理员'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          只支持填写邮箱或手机号其一。bootstrap admin 账号会被标记且不能在后台撤销。
        </p>
        {notice && <p className="mt-2 text-sm text-emerald-600">{notice}</p>}
        {errorText && <p className="mt-2 text-sm text-destructive">{errorText}</p>}
      </div>

      <div className="space-y-3">
        {admins.map((admin) => (
          <div key={admin.id} className="rounded-md border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{admin.displayName}</span>
                  <Badge variant="outline">ADMIN</Badge>
                  {admin.isBootstrapAdmin && (
                    <Badge variant="secondary">Bootstrap</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {admin.email ?? '未绑定邮箱'}
                  {' · '}
                  {admin.phone ?? '未绑定手机号'}
                </p>
                <p className="text-xs text-muted-foreground">
                  最近登录{' '}
                  {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('zh-CN') : '暂无'}
                  {' · '}
                  状态 {admin.status === 'ACTIVE' ? '正常' : '停用'}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={admin.isBootstrapAdmin || revokeAdminAccess.isPending}
                onClick={() => void handleRevoke(admin.id, admin.displayName)}
              >
                {admin.isBootstrapAdmin ? 'Bootstrap 保护中' : '撤销管理员'}
              </Button>
            </div>
          </div>
        ))}

        {admins.length === 0 && (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            当前还没有管理员账号。
          </div>
        )}
      </div>
    </div>
  )
}

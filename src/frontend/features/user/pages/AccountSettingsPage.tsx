import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/shared/hooks/use-auth'
import { PresetAvatarDialog } from '@/shared/components/PresetAvatarDialog'
import { USER_AVATAR_PRESETS, resolveUserAvatarSrc } from '@/shared/utils/preset-avatars'

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function AccountSettingsPage() {
  const { user, isAuthenticated, updateProfile, isUpdateProfilePending } = useAuth()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [avatarDraftSrc, setAvatarDraftSrc] = useState<string | null>(user?.avatarUrl ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)

  useEffect(() => {
    setDisplayName(user?.displayName ?? '')
    setAvatarDraftSrc(user?.avatarUrl ?? null)
  }, [user?.avatarUrl, user?.displayName, user?.id])

  if (!isAuthenticated || !user) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">账户设置</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理你的个人资料和账户偏好。</p>
        </div>
        <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm font-medium">需要登录</p>
          <p className="mt-1 text-xs text-muted-foreground">
            请先
            <Link to="/login" className="ml-1 text-primary hover:underline">登录</Link>
            以管理你的账户。
          </p>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    const nextDisplayName = displayName.trim()
    if (!nextDisplayName) return
    setIsSaving(true)
    setSaveMessage(null)
    try {
      await updateProfile({
        displayName: nextDisplayName,
        avatarUrl: avatarDraftSrc,
      })
      setSaveMessage('资料已保存。')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '保存失败，请稍后重试。')
    } finally {
      setIsSaving(false)
    }
  }

  const resolvedAvatarSrc = user
    ? resolveUserAvatarSrc({
        ...user,
        avatarUrl: avatarDraftSrc,
      })
    : null
  const emailLabel = user.email ?? '未绑定邮箱'
  const phoneLabel = user.phone ?? '未绑定手机号'
  const hasUnsavedChanges = user
    ? displayName.trim() !== user.displayName.trim()
      || (avatarDraftSrc ?? null) !== (user.avatarUrl ?? null)
    : false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">账户设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理你的个人资料和账户偏好。</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {/* Profile card */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm">个人资料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  {resolvedAvatarSrc && <AvatarImage src={resolvedAvatarSrc} alt={displayName || user.displayName} className="object-cover" />}
                  <AvatarFallback className="text-lg font-semibold">
                    {getInitials(displayName || user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{displayName || user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email ?? user.phone ?? user.id}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setAvatarDialogOpen(true)}>
                    设置头像
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="display-name">
                  显示名称
                </label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="你的显示名称"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email-readonly">
                  邮箱
                </label>
                <Input
                  id="email-readonly"
                  value={emailLabel}
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-[11px] text-muted-foreground">邮箱暂不支持修改。</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="phone-readonly">
                  手机号
                </label>
                <Input
                  id="phone-readonly"
                  value={phoneLabel}
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-[11px] text-muted-foreground">手机号暂不支持修改。</p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || isUpdateProfilePending || !displayName.trim() || !hasUnsavedChanges}
                >
                  {isSaving ? '保存中…' : '保存修改'}
                </Button>
                {saveMessage && (
                  <p className={saveMessage === '资料已保存。' ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
                    {saveMessage}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account info card */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm">账户信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">角色</span>
                <Badge variant="outline">{user.role === 'admin' ? '管理员' : '普通用户'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">套餐</span>
                <Badge variant="secondary">{user.planTier}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">用户 ID</span>
                <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <aside className="hidden lg:block">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm">快捷入口</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                type="button"
                onClick={() => useAgentModalStore.getState().openModal(null, 'manage', 'chat')}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5"
              >
                智能体管理
              </button>
              <Link
                to="/my/activity"
                className="block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-primary/5"
              >
                我的关联
              </Link>
              <Link
                to="/safety"
                className="block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-primary/5"
              >
                举报申诉
              </Link>
              <Link
                to="/privacy"
                className="block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-primary/5"
              >
                隐私政策
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>

      <PresetAvatarDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        title="设置用户头像"
        description="选择预设头像后会先写入当前资料草稿，点击“保存修改”后持久化到账户资料。"
        currentLabel={displayName || user.displayName}
        fallbackLabel={getInitials(displayName || user.displayName)}
        previewSrc={resolvedAvatarSrc}
        presets={USER_AVATAR_PRESETS}
        footerNote="上传入口仍保留占位；预设头像会先进入当前表单草稿。"
        saveLabel="使用此头像"
        onSave={(selectedSrc) => {
          setAvatarDraftSrc(selectedSrc)
          setAvatarDialogOpen(false)
          setSaveMessage('头像选择已暂存，点击“保存修改”后生效。')
        }}
      />
    </div>
  )
}

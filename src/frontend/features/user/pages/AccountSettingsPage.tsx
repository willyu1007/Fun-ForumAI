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

function maskEmail(email: string) {
  const [localPart, domain = ''] = email.split('@')
  const visible = localPart.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(localPart.length - visible.length, 1))}@${domain}`
}

export function AccountSettingsPage() {
  const {
    user,
    isAuthenticated,
    updateProfile,
    startEmailPasswordReset,
    verifyEmailPasswordReset,
    resendEmailPasswordReset,
    isUpdateProfilePending,
    isPasswordResetStartPending,
    isPasswordResetVerifyPending,
    isPasswordResetResendPending,
  } = useAuth()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [avatarDraftSrc, setAvatarDraftSrc] = useState<string | null>(user?.avatarUrl ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const [passwordStage, setPasswordStage] = useState<'idle' | 'verify'>('idle')
  const [passwordChallengeId, setPasswordChallengeId] = useState<string | null>(null)
  const [passwordCode, setPasswordCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordCountdown, setPasswordCountdown] = useState(0)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(user?.displayName ?? '')
    setAvatarDraftSrc(user?.avatarUrl ?? null)
  }, [user?.avatarUrl, user?.displayName, user?.id])

  useEffect(() => {
    if (passwordCountdown <= 0) return undefined
    const timer = window.setInterval(() => {
      setPasswordCountdown((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [passwordCountdown])

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

  const clearPasswordFlow = () => {
    setPasswordStage('idle')
    setPasswordChallengeId(null)
    setPasswordCode('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordCountdown(0)
  }

  const handleStartPasswordReset = async () => {
    if (!user?.email) return
    setPasswordMessage(null)
    try {
      const result = await startEmailPasswordReset({ email: user.email })
      setPasswordStage('verify')
      setPasswordChallengeId(result.challengeId)
      setPasswordCountdown(result.resendAfterSec)
      setPasswordCode('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage(`验证码已发送至 ${result.maskedTarget}`)
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '验证码发送失败，请稍后重试。')
    }
  }

  const handleResendPasswordReset = async () => {
    if (!passwordChallengeId) return
    setPasswordMessage(null)
    try {
      const result = await resendEmailPasswordReset({ challengeId: passwordChallengeId })
      setPasswordChallengeId(result.challengeId)
      setPasswordCountdown(result.resendAfterSec)
      setPasswordMessage(`验证码已重新发送至 ${result.maskedTarget}`)
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '验证码发送失败，请稍后重试。')
    }
  }

  const handleVerifyPasswordReset = async () => {
    if (!passwordChallengeId) {
      setPasswordMessage('请先发送验证码。')
      return
    }
    if (!/^\d{6}$/.test(passwordCode.trim())) {
      setPasswordMessage('请输入 6 位验证码。')
      return
    }
    if (newPassword.length < 8) {
      setPasswordMessage('密码至少 8 位。')
      return
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordMessage('密码需包含字母和数字。')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('两次输入的密码不一致。')
      return
    }

    setPasswordMessage(null)
    try {
      await verifyEmailPasswordReset({
        challengeId: passwordChallengeId,
        code: passwordCode.trim(),
        password: newPassword,
      })
      clearPasswordFlow()
      setPasswordMessage('密码已更新。')
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '密码更新失败，请稍后重试。')
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
  const emailMask = user.email ? maskEmail(user.email) : null
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

              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">登录密码</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user.email
                        ? `通过已绑定邮箱 ${emailMask} 验证后更新密码。`
                        : '当前账号未绑定邮箱，暂不支持密码重置。'}
                    </p>
                  </div>
                  {passwordStage === 'verify' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={clearPasswordFlow}
                    >
                      取消
                    </Button>
                  ) : null}
                </div>

                {user.email ? (
                  passwordStage === 'idle' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleStartPasswordReset()}
                      disabled={isPasswordResetStartPending}
                    >
                      {isPasswordResetStartPending ? '发送中…' : '发送邮箱验证码'}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="password-reset-code">
                            验证码
                          </label>
                          <Input
                            id="password-reset-code"
                            value={passwordCode}
                            onChange={(event) => setPasswordCode(event.target.value)}
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="6 位验证码"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-medium">重发</div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => void handleResendPasswordReset()}
                            disabled={isPasswordResetResendPending || passwordCountdown > 0}
                          >
                            {isPasswordResetResendPending
                              ? '发送中…'
                              : passwordCountdown > 0
                                ? `${passwordCountdown}s`
                                : '重发验证码'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="new-password">
                            新密码
                          </label>
                          <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            autoComplete="new-password"
                            placeholder="输入新密码"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="confirm-password">
                            确认新密码
                          </label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            autoComplete="new-password"
                            placeholder="再次输入新密码"
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleVerifyPasswordReset()}
                        disabled={isPasswordResetVerifyPending}
                      >
                        {isPasswordResetVerifyPending ? '验证中…' : '验证并更新密码'}
                      </Button>
                    </div>
                  )
                ) : null}

                {passwordMessage ? (
                  <p className={passwordMessage === '密码已更新。' ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
                    {passwordMessage}
                  </p>
                ) : null}
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

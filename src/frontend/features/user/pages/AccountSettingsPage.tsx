import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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

type ContactChangeStage = 'idle' | 'input' | 'verify'

function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (seconds <= 0) return undefined
    const timer = window.setInterval(() => {
      setSeconds((c) => Math.max(c - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [seconds])
  return [seconds, setSeconds] as const
}

export function AccountSettingsPage() {
  const {
    user,
    isAuthenticated,
    updateProfile,
    startEmailPasswordReset,
    verifyEmailPasswordReset,
    resendEmailPasswordReset,
    startEmailChange,
    verifyEmailChange,
    startPhoneChange,
    verifyPhoneChange,
    resendContactChange,
    isUpdateProfilePending,
    isPasswordResetStartPending,
    isPasswordResetVerifyPending,
    isPasswordResetResendPending,
    isEmailChangeStartPending,
    isEmailChangeVerifyPending,
    isPhoneChangeStartPending,
    isPhoneChangeVerifyPending,
    isContactChangeResendPending,
  } = useAuth()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [avatarDraftSrc, setAvatarDraftSrc] = useState<string | null>(user?.avatarUrl ?? null)
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)

  const [passwordStage, setPasswordStage] = useState<'idle' | 'verify'>('idle')
  const [passwordChallengeId, setPasswordChallengeId] = useState<string | null>(null)
  const [passwordCode, setPasswordCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordCountdown, setPasswordCountdown] = useCountdown()
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const [emailStage, setEmailStage] = useState<ContactChangeStage>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [emailChallengeId, setEmailChallengeId] = useState<string | null>(null)
  const [emailCode, setEmailCode] = useState('')
  const [emailCountdown, setEmailCountdown] = useCountdown()
  const [emailMessage, setEmailMessage] = useState<string | null>(null)

  const [phoneStage, setPhoneStage] = useState<ContactChangeStage>('idle')
  const [newPhone, setNewPhone] = useState('')
  const [phoneChallengeId, setPhoneChallengeId] = useState<string | null>(null)
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneCountdown, setPhoneCountdown] = useCountdown()
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(user?.displayName ?? '')
    setAvatarDraftSrc(user?.avatarUrl ?? null)
    setBirthDate(user?.birthDate ?? '')
  }, [user?.avatarUrl, user?.birthDate, user?.displayName, user?.id])

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-bold tracking-tight">账户设置</h1>
        <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            请先<Link to="/login" className="ml-1 text-primary hover:underline">登录</Link>
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
      await updateProfile({ displayName: nextDisplayName, avatarUrl: avatarDraftSrc, birthDate: birthDate || null })
      setSaveMessage('已保存')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  // ── password reset ──
  const clearPasswordFlow = () => {
    setPasswordStage('idle')
    setPasswordChallengeId(null)
    setPasswordCode('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordCountdown(0)
    setPasswordMessage(null)
  }

  const handleStartPasswordReset = async () => {
    if (!user.email) return
    setPasswordMessage(null)
    try {
      const r = await startEmailPasswordReset({ email: user.email })
      setPasswordStage('verify')
      setPasswordChallengeId(r.challengeId)
      setPasswordCountdown(r.resendAfterSec)
      setPasswordCode('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '发送失败')
    }
  }

  const handleResendPasswordReset = async () => {
    if (!passwordChallengeId) return
    setPasswordMessage(null)
    try {
      const r = await resendEmailPasswordReset({ challengeId: passwordChallengeId })
      setPasswordChallengeId(r.challengeId)
      setPasswordCountdown(r.resendAfterSec)
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '发送失败')
    }
  }

  const handleVerifyPasswordReset = async () => {
    if (!passwordChallengeId) return
    if (!/^\d{6}$/.test(passwordCode.trim())) { setPasswordMessage('请输入 6 位验证码'); return }
    if (newPassword.length < 8) { setPasswordMessage('密码至少 8 位'); return }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) { setPasswordMessage('密码需包含字母和数字'); return }
    if (newPassword !== confirmPassword) { setPasswordMessage('两次密码不一致'); return }
    setPasswordMessage(null)
    try {
      await verifyEmailPasswordReset({ challengeId: passwordChallengeId, code: passwordCode.trim(), password: newPassword })
      clearPasswordFlow()
      setPasswordMessage('密码已更新')
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '更新失败')
    }
  }

  // ── email change ──
  const clearEmailFlow = () => {
    setEmailStage('idle')
    setNewEmail('')
    setEmailChallengeId(null)
    setEmailCode('')
    setEmailCountdown(0)
    setEmailMessage(null)
  }

  const handleStartEmailChange = async () => {
    if (!newEmail.trim()) return
    setEmailMessage(null)
    try {
      const r = await startEmailChange({ newEmail: newEmail.trim() })
      setEmailStage('verify')
      setEmailChallengeId(r.challengeId)
      setEmailCountdown(r.resendAfterSec)
      setEmailCode('')
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : '发送失败')
    }
  }

  const handleVerifyEmailChange = async () => {
    if (!emailChallengeId) return
    if (!/^\d{6}$/.test(emailCode.trim())) { setEmailMessage('请输入 6 位验证码'); return }
    setEmailMessage(null)
    try {
      await verifyEmailChange({ challengeId: emailChallengeId, code: emailCode.trim() })
      clearEmailFlow()
      setEmailMessage('邮箱已更新')
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : '验证失败')
    }
  }

  const handleResendEmail = async () => {
    if (!emailChallengeId) return
    try {
      const r = await resendContactChange({ challengeId: emailChallengeId })
      setEmailChallengeId(r.challengeId)
      setEmailCountdown(r.resendAfterSec)
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : '发送失败')
    }
  }

  // ── phone change ──
  const clearPhoneFlow = () => {
    setPhoneStage('idle')
    setNewPhone('')
    setPhoneChallengeId(null)
    setPhoneCode('')
    setPhoneCountdown(0)
    setPhoneMessage(null)
  }

  const handleStartPhoneChange = async () => {
    if (!newPhone.trim()) return
    setPhoneMessage(null)
    try {
      const r = await startPhoneChange({ newPhone: newPhone.trim() })
      setPhoneStage('verify')
      setPhoneChallengeId(r.challengeId)
      setPhoneCountdown(r.resendAfterSec)
      setPhoneCode('')
    } catch (error) {
      setPhoneMessage(error instanceof Error ? error.message : '发送失败')
    }
  }

  const handleVerifyPhoneChange = async () => {
    if (!phoneChallengeId) return
    if (!/^\d{6}$/.test(phoneCode.trim())) { setPhoneMessage('请输入 6 位验证码'); return }
    setPhoneMessage(null)
    try {
      await verifyPhoneChange({ challengeId: phoneChallengeId, code: phoneCode.trim() })
      clearPhoneFlow()
      setPhoneMessage('手机号已更新')
    } catch (error) {
      setPhoneMessage(error instanceof Error ? error.message : '验证失败')
    }
  }

  const handleResendPhone = async () => {
    if (!phoneChallengeId) return
    try {
      const r = await resendContactChange({ challengeId: phoneChallengeId })
      setPhoneChallengeId(r.challengeId)
      setPhoneCountdown(r.resendAfterSec)
    } catch (error) {
      setPhoneMessage(error instanceof Error ? error.message : '发送失败')
    }
  }

  const resolvedAvatarSrc = resolveUserAvatarSrc({ ...user, avatarUrl: avatarDraftSrc })
  const emailMask = user.email ? maskEmail(user.email) : null
  const hasUnsavedChanges = displayName.trim() !== user.displayName.trim()
    || (avatarDraftSrc ?? null) !== (user.avatarUrl ?? null)
    || (birthDate || '') !== (user.birthDate || '')

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <h1 className="text-xl font-bold tracking-tight">账户设置</h1>

      {/* ── 个人资料 ───────────────────────────── */}
      <section>
        <h2 className="mb-4 rounded-lg bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">个人资料</h2>
        <div className="space-y-6 px-1">

          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {resolvedAvatarSrc && <AvatarImage src={resolvedAvatarSrc} alt={displayName || user.displayName} className="object-cover" />}
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(displayName || user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{displayName || user.displayName}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setAvatarDialogOpen(true)}>
                设置头像
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="display-name">显示名称</label>
            <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="你的显示名称" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="birth-date">出生日期</label>
            <Input id="birth-date" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>

          {/* ── 邮箱 ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">邮箱</span>
              {emailStage === 'idle' ? (
                <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => setEmailStage('input')}>
                  {user.email ? '修改' : '绑定'}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={clearEmailFlow}>取消</Button>
              )}
            </div>

            {emailStage === 'idle' && (
              <p className="text-sm text-muted-foreground">{user.email ?? '未绑定'}</p>
            )}

            {emailStage === 'input' && (
              <div className="flex gap-2">
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="输入新邮箱" type="email" className="flex-1" />
                <Button size="sm" onClick={() => void handleStartEmailChange()} disabled={isEmailChangeStartPending || !newEmail.trim()}>
                  {isEmailChangeStartPending ? '发送中…' : '发送验证码'}
                </Button>
              </div>
            )}

            {emailStage === 'verify' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="6 位验证码" className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => void handleResendEmail()} disabled={isContactChangeResendPending || emailCountdown > 0}>
                    {emailCountdown > 0 ? `${emailCountdown}s` : '重发'}
                  </Button>
                </div>
                <Button size="sm" onClick={() => void handleVerifyEmailChange()} disabled={isEmailChangeVerifyPending}>
                  {isEmailChangeVerifyPending ? '验证中…' : '确认修改'}
                </Button>
              </div>
            )}

            {emailMessage && (
              <p className={emailMessage === '邮箱已更新' ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{emailMessage}</p>
            )}
          </div>

          {/* ── 手机号 ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">手机号</span>
              {phoneStage === 'idle' ? (
                <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => setPhoneStage('input')}>
                  {user.phone ? '修改' : '绑定'}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={clearPhoneFlow}>取消</Button>
              )}
            </div>

            {phoneStage === 'idle' && (
              <p className="text-sm text-muted-foreground">{user.phone ?? '未绑定'}</p>
            )}

            {phoneStage === 'input' && (
              <div className="flex gap-2">
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="输入新手机号" inputMode="tel" className="flex-1" />
                <Button size="sm" onClick={() => void handleStartPhoneChange()} disabled={isPhoneChangeStartPending || !newPhone.trim()}>
                  {isPhoneChangeStartPending ? '发送中…' : '发送验证码'}
                </Button>
              </div>
            )}

            {phoneStage === 'verify' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="6 位验证码" className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => void handleResendPhone()} disabled={isContactChangeResendPending || phoneCountdown > 0}>
                    {phoneCountdown > 0 ? `${phoneCountdown}s` : '重发'}
                  </Button>
                </div>
                <Button size="sm" onClick={() => void handleVerifyPhoneChange()} disabled={isPhoneChangeVerifyPending}>
                  {isPhoneChangeVerifyPending ? '验证中…' : '确认修改'}
                </Button>
              </div>
            )}

            {phoneMessage && (
              <p className={phoneMessage === '手机号已更新' ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{phoneMessage}</p>
            )}
          </div>

          {/* ── 实名认证 ── */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">实名认证</p>
              <p className="mt-0.5 text-xs text-muted-foreground">未认证</p>
            </div>
            <Button variant="outline" size="sm" disabled>
              去认证
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleSave} disabled={isSaving || isUpdateProfilePending || !displayName.trim() || !hasUnsavedChanges}>
              {isSaving ? '保存中…' : '保存修改'}
            </Button>
            {saveMessage && (
              <p className={saveMessage === '已保存' ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{saveMessage}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── 安全设置 ───────────────────────────── */}
      <section>
        <h2 className="mb-4 rounded-lg bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">安全设置</h2>
        <div className="space-y-4 px-1">

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">登录密码</p>
              {user.email ? (
                <p className="mt-1 text-xs text-muted-foreground">通过验证邮箱 {emailMask} 重置当前密码</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">未绑定邮箱，无法重置</p>
              )}
            </div>
            {passwordStage === 'verify' && (
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={clearPasswordFlow}>取消</Button>
            )}
          </div>

            {user.email ? (
              passwordStage === 'idle' ? (
                <Button type="button" variant="outline" size="sm" onClick={() => void handleStartPasswordReset()} disabled={isPasswordResetStartPending}>
                  {isPasswordResetStartPending ? '发送中…' : '重置密码'}
                </Button>
              ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="password-reset-code">验证码</label>
                    <Input id="password-reset-code" value={passwordCode} onChange={(e) => setPasswordCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="6 位验证码" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">重发</div>
                    <Button type="button" variant="outline" className="w-full" onClick={() => void handleResendPasswordReset()} disabled={isPasswordResetResendPending || passwordCountdown > 0}>
                      {isPasswordResetResendPending ? '发送中…' : passwordCountdown > 0 ? `${passwordCountdown}s` : '重发验证码'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="new-password">新密码</label>
                    <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="输入新密码" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="confirm-password">确认新密码</label>
                    <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="再次输入新密码" />
                  </div>
                </div>
                <Button type="button" size="sm" onClick={() => void handleVerifyPasswordReset()} disabled={isPasswordResetVerifyPending}>
                  {isPasswordResetVerifyPending ? '验证中…' : '验证并更新密码'}
                </Button>
              </div>
            )
          ) : null}

          {passwordMessage && (
            <p className={passwordMessage === '密码已更新' ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{passwordMessage}</p>
          )}
        </div>
      </section>

      {/* ── 账户信息 ───────────────────────────── */}
      <section>
        <h2 className="mb-4 rounded-lg bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">账户信息</h2>
        <div className="space-y-3 px-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">角色</span>
            <span className="text-sm">{user.role === 'admin' ? '管理员' : '普通用户'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">套餐</span>
            <span className="text-sm">{user.planTier}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">用户 ID</span>
            <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
          </div>
        </div>
      </section>

      <PresetAvatarDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        title="设置用户头像"
        description="选择头像后需点击保存修改以生效。"
        currentLabel={displayName || user.displayName}
        fallbackLabel={getInitials(displayName || user.displayName)}
        previewSrc={resolvedAvatarSrc}
        presets={USER_AVATAR_PRESETS}
        saveLabel="使用此头像"
        onSave={(selectedSrc) => {
          setAvatarDraftSrc(selectedSrc)
          setAvatarDialogOpen(false)
          setSaveMessage('头像已选择，保存后生效。')
        }}
      />
    </div>
  )
}

import { useEffect, useState, type ComponentProps } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getApiErrorCode } from '@/api/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/shared/hooks/use-auth'
import { resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'
import { WechatLoginButton } from './WechatLoginButton'

type AuthMethod = 'phone' | 'email' | 'wechat'
type AuthIntent = 'login' | 'register'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^1[3-9]\d{9}$/
const CODE_PATTERN = /^\d{6}$/
const authCardCss = `
.auth-card-shell {
  border-color: color-mix(in srgb, var(--ui-color-border) 88%, var(--ui-color-primary) 12%);
  background: color-mix(in srgb, var(--ui-color-surface) 76%, var(--ui-color-surface-elevated) 24%);
}
.auth-card-input-script {
  font-family: "Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif;
  letter-spacing: 0.02em;
}
.auth-card-tabs {
  background: color-mix(in srgb, var(--ui-color-surface) 62%, var(--ui-color-surface-elevated) 38%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-color-border) 11%, transparent);
}
.auth-card-tabs [data-slot="tabs-trigger"] {
  border-color: transparent;
  background: transparent;
  color: color-mix(in srgb, var(--ui-color-text-secondary) 95%, var(--ui-color-text-primary) 5%);
  box-shadow: none;
  transform: translateY(0);
}
.auth-card-tabs [data-slot="tabs-trigger"]::after {
  display: none;
}
.auth-card-tabs [data-slot="tabs-trigger"]:hover:not([data-state="active"]) {
  background: color-mix(in srgb, var(--ui-color-surface) 22%, transparent);
  color: color-mix(in srgb, var(--ui-color-text-secondary) 60%, var(--ui-color-text-primary) 40%);
}
.auth-card-tabs [data-slot="tabs-trigger"]:active:not([data-state="active"]) {
  background: color-mix(in srgb, var(--ui-color-surface) 18%, var(--ui-color-surface-elevated) 82%);
  color: var(--ui-color-text-primary);
  transform: translateY(0.5px);
}
.auth-card-tabs [data-slot="tabs-trigger"][data-state="active"] {
  border-color: color-mix(in srgb, var(--ui-color-border) 8%, transparent);
  background: color-mix(in srgb, var(--ui-color-surface) 94%, var(--ui-color-surface-elevated) 6%);
  color: var(--ui-color-text-primary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--ui-color-surface) 76%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--ui-color-border) 5%, transparent),
    0 3px 8px color-mix(in srgb, var(--ui-color-overlay) 5%, transparent),
    0 1px 2px color-mix(in srgb, var(--ui-color-overlay) 3%, transparent);
}
.auth-card-tabs [data-slot="tabs-trigger"][data-state="active"]:active {
  background: color-mix(in srgb, var(--ui-color-surface) 88%, var(--ui-color-surface-elevated) 12%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--ui-color-surface) 72%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--ui-color-border) 6%, transparent),
    0 1px 3px color-mix(in srgb, var(--ui-color-overlay) 3%, transparent);
  transform: translateY(0.5px);
}
.auth-card-tabs [data-slot="tabs-trigger"]:focus-visible {
  outline: none;
  outline-offset: 0;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-color-border) 10%, transparent);
}
.auth-card-input {
  border-color: color-mix(in srgb, var(--ui-color-border) 78%, var(--ui-color-surface) 22%);
  background: color-mix(in srgb, var(--ui-color-surface) 56%, var(--ui-color-surface-elevated) 44%);
  box-shadow: none;
}
.auth-card-input:focus-visible {
  border-color: color-mix(in srgb, var(--ui-color-border) 64%, var(--ui-color-primary) 36%);
  background: color-mix(in srgb, var(--ui-color-surface) 62%, var(--ui-color-surface-elevated) 38%);
  outline: none;
  outline-offset: 0;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-color-primary) 10%, transparent);
}
.auth-card-input::placeholder {
  color: color-mix(in srgb, var(--ui-color-text-muted) 74%, transparent);
}
.auth-card-notice {
  border-left-color: color-mix(in srgb, var(--ui-color-primary) 80%, transparent);
  background: color-mix(in srgb, var(--ui-color-primary) 6%, var(--ui-color-surface));
}
.auth-card-aux-button {
  border-color: color-mix(in srgb, var(--ui-color-border) 54%, transparent);
  background: color-mix(in srgb, var(--ui-color-surface-elevated) 68%, var(--ui-color-border) 32%);
  color: color-mix(in srgb, var(--ui-color-text-primary) 78%, var(--ui-color-text-secondary) 22%);
  box-shadow: none;
}
.auth-card-aux-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--ui-color-border) 62%, transparent);
  background: color-mix(in srgb, var(--ui-color-surface-elevated) 62%, var(--ui-color-border) 38%);
  color: var(--ui-color-text-primary);
}
.auth-card-aux-button:focus-visible {
  outline: none;
  outline-offset: 0;
  border-color: color-mix(in srgb, var(--ui-color-border) 62%, var(--ui-color-primary) 18%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-color-border) 10%, transparent);
}
.auth-card-aux-button:disabled {
  color: color-mix(in srgb, var(--ui-color-text-muted) 78%, transparent);
}
`

type AuthInputProps = ComponentProps<'input'>
type AuthAuxButtonProps = ComponentProps<'button'>

function AuthInput({
  className,
  type,
  disabled,
  'aria-invalid': ariaInvalid,
  onBlur,
  onFocus,
  value,
  defaultValue,
  scriptOnBlur = false,
  ...props
}: AuthInputProps & { scriptOnBlur?: boolean }) {
  const [isFocused, setIsFocused] = useState(false)
  const hasValue = Array.isArray(value)
    ? value.length > 0
    : typeof value === 'number'
      ? true
      : typeof value === 'string'
        ? value.trim().length > 0
        : typeof defaultValue === 'number'
          ? true
          : typeof defaultValue === 'string'
            ? defaultValue.trim().length > 0
            : Array.isArray(defaultValue)
              ? defaultValue.length > 0
              : false

  return (
    <input
      type={type}
      data-ui="input"
      data-slot="input"
      data-size="md"
      data-state={disabled ? 'disabled' : ariaInvalid ? 'error' : 'default'}
      className={cn(
        'auth-card-input h-9 w-full min-w-0 rounded-[14px] border px-3 py-1 text-sm outline-none',
        'placeholder:text-xs transition-[background-color,border-color] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'hover:border-border focus-visible:outline-none focus-visible:outline-offset-0 focus-visible:ring-0',
        scriptOnBlur && !isFocused && hasValue ? 'auth-card-input-script' : undefined,
        className,
      )}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      value={value}
      defaultValue={defaultValue}
      onFocus={(event) => {
        setIsFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setIsFocused(false)
        onBlur?.(event)
      }}
      {...props}
    />
  )
}

function AuthAuxButton({
  className,
  type = 'button',
  ...props
}: AuthAuxButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'auth-card-aux-button inline-flex h-9 min-w-[104px] shrink-0 items-center justify-center rounded-[10px] border px-3 text-[13px] font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity] outline-none disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    />
  )
}

function CollapsibleSection({
  expanded,
  children,
}: {
  expanded: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
        expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className={expanded ? 'overflow-visible' : 'overflow-hidden'}>{children}</div>
    </div>
  )
}

function CompletionNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-card-notice w-full rounded-lg border-l-4 px-4 py-3 text-sm text-muted-foreground shadow-xs">
      {children}
    </div>
  )
}

function FieldHeader({
  htmlFor,
  label,
  detail,
  action,
}: {
  htmlFor: string
  label: string
  detail?: string | null
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium leading-none text-foreground/90"
      >
        {label}
      </label>
      {action ?? (detail ? (
        <span className="text-xs text-muted-foreground/65">
          {detail}
        </span>
      ) : null)}
    </div>
  )
}

function DevTestPanel({
  meta,
  tabs,
}: {
  meta?: React.ReactNode
  tabs: React.ReactNode
}) {
  return (
    <div className="fixed left-4 top-4 z-50 w-64 rounded-lg border border-border/30 bg-background/40 p-2.5 shadow-sm backdrop-blur-md transition-opacity hover:bg-background/60">
      <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
        Dev Tools
      </div>
      <div className="flex flex-wrap gap-1">{tabs}</div>
      {meta ? (
        <div className="mt-2 space-y-0.5 text-[9px] text-muted-foreground/50">{meta}</div>
      ) : null}
    </div>
  )
}

function DevTabButton({
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={
        active
          ? 'rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors'
          : disabled
            ? 'cursor-not-allowed rounded px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground/30'
            : 'rounded px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground'
      }
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function EmailAuthFlow({
  initialInviteCode,
  initialIntent,
  isAuthTestMode,
}: {
  initialInviteCode: string
  initialIntent: AuthIntent
  isAuthTestMode: boolean
}) {
  const baseStage = initialIntent === 'register' ? 'details' : 'login'
  const [stage, setStage] = useState<'login' | 'details' | 'verify' | 'reset' | 'resetVerify'>(baseStage)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null)
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [error, setError] = useState('')
  const {
    login,
    startEmailRegistration,
    verifyEmailRegistration,
    resendEmailRegistration,
    startEmailPasswordReset,
    verifyEmailPasswordReset,
    resendEmailPasswordReset,
    isLoginPending,
    isEmailRegisterStartPending,
    isEmailRegisterVerifyPending,
    isEmailRegisterResendPending,
    isPasswordResetStartPending,
    isPasswordResetVerifyPending,
    isPasswordResetResendPending,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isResetMode = stage === 'reset' || stage === 'resetVerify'
  const isVerifyStage = stage === 'verify' || stage === 'resetVerify'

  useEffect(() => {
    if (resendCountdown <= 0) return undefined
    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCountdown])

  const clearChallengeState = () => {
    setChallengeId(null)
    setMaskedTarget(null)
    setDebugCode(null)
    setResendCountdown(0)
    setCode('')
    setError('')
  }

  const collapseToBaseStage = () => {
    setStage(baseStage)
    clearChallengeState()
  }

  const enterPasswordReset = () => {
    setStage('reset')
    setPassword('')
    setConfirmPassword('')
    clearChallengeState()
  }

  const applyEmailDevState = (targetStage: 'details' | 'verify') => {
    const nextEmail = email.trim() || 'new-user@example.com'
    const nextPassword = password || 'password123'
    setEmail(nextEmail)
    setPassword(nextPassword)
    setDisplayName(displayName || '测试用户')
    setInviteCode(inviteCode || initialInviteCode || '100001')
    setConfirmPassword(confirmPassword || nextPassword)
    setError('')
    if (targetStage === 'details') {
      setStage('details')
      clearChallengeState()
      return
    }
    setStage('verify')
    setChallengeId('dev-email-challenge')
    setMaskedTarget(nextEmail)
    setDebugCode('123456')
    setResendCountdown(0)
    setCode('')
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (stage === 'verify' || (stage === 'details' && initialIntent === 'login')) {
      collapseToBaseStage()
      return
    }
    if (stage === 'resetVerify') {
      enterPasswordReset()
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (stage === 'verify' || (stage === 'details' && initialIntent === 'login')) {
      collapseToBaseStage()
    }
  }

  const validateEmail = () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('请输入有效的邮箱地址')
      return false
    }
    return true
  }

  const validatePasswordPair = () => {
    if (password.length < 8) {
      setError('密码至少 8 位')
      return false
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('密码需包含字母和数字')
      return false
    }
    if (confirmPassword !== password) {
      setError('两次输入的密码不一致')
      return false
    }
    return true
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('请填写邮箱和密码')
      return
    }
    if (!validateEmail()) return

    try {
      await login({ email: email.trim(), password })
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    } catch (err) {
      if (getApiErrorCode(err) === 'USER_NOT_FOUND') {
        setStage('details')
        return
      }
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    }
  }

  const handleStartRegistration = async () => {
    setError('')

    if (!validateEmail()) return
    if (!displayName.trim()) {
      setError('请输入昵称')
      return
    }
    if (!CODE_PATTERN.test(inviteCode.trim())) {
      setError('请输入 6 位邀请码')
      return
    }
    if (!validatePasswordPair()) return

    try {
      const result = await startEmailRegistration({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        inviteCode: inviteCode.trim(),
      })
      setStage('verify')
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  const handleVerifyRegistration = async () => {
    setError('')

    if (!challengeId) {
      setError('请先发送验证码')
      return
    }
    if (!CODE_PATTERN.test(code.trim())) {
      setError('请输入 6 位验证码')
      return
    }

    try {
      await verifyEmailRegistration({
        challengeId,
        code: code.trim(),
      })
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败，请重试')
    }
  }

  const handleStartPasswordReset = async () => {
    setError('')

    if (!validateEmail()) return

    try {
      const result = await startEmailPasswordReset({ email: email.trim() })
      setStage('resetVerify')
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
      setPassword('')
      setConfirmPassword('')
      setCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  const handleVerifyPasswordReset = async () => {
    setError('')

    if (!challengeId) {
      setError('请先发送验证码')
      return
    }
    if (!validatePasswordPair()) return
    if (!CODE_PATTERN.test(code.trim())) {
      setError('请输入 6 位验证码')
      return
    }

    try {
      await verifyEmailPasswordReset({
        challengeId,
        code: code.trim(),
        password,
      })
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败，请重试')
    }
  }

  const handleResend = async () => {
    if (!challengeId) return
    setError('')

    try {
      const result = isResetMode
        ? await resendEmailPasswordReset({ challengeId })
        : await resendEmailRegistration({ challengeId })
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  const submitPending =
    stage === 'login'
      ? isLoginPending
      : stage === 'details'
        ? isEmailRegisterStartPending
        : stage === 'verify'
          ? isEmailRegisterVerifyPending
          : stage === 'reset'
            ? isPasswordResetStartPending
            : isPasswordResetVerifyPending
  const activeDevTab = stage === 'login' || stage === 'reset' || stage === 'resetVerify'
    ? 'initial'
    : stage

  return (
    <form
      noValidate
      onSubmit={(event) => {
        if (stage === 'login') {
          void handleLogin(event)
          return
        }
        event.preventDefault()
        if (stage === 'details') {
          void handleStartRegistration()
          return
        }
        if (stage === 'verify') {
          void handleVerifyRegistration()
          return
        }
        if (stage === 'reset') {
          void handleStartPasswordReset()
          return
        }
        void handleVerifyPasswordReset()
      }}
      className="flex min-h-[240px] flex-col"
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <FieldHeader htmlFor="auth-email" label="邮箱地址" />
          <AuthInput
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => handleEmailChange(event.target.value)}
            autoComplete="email"
            autoFocus
          />
        </div>

        {(stage === 'login' || stage === 'details') ? (
          <div className="space-y-2">
            <FieldHeader
              htmlFor="auth-email-password"
              label="密码"
              action={stage === 'login' ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
                  onClick={enterPasswordReset}
                >
                  忘记密码？
                </button>
              ) : undefined}
            />
            <AuthInput
              id="auth-email-password"
              type="password"
              placeholder="输入密码"
              value={password}
              onChange={(event) => handlePasswordChange(event.target.value)}
              autoComplete={stage === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
        ) : null}

        <CollapsibleSection expanded={stage === 'details'}>
          {stage === 'details' ? (
            <div className="space-y-3 pt-1">
              <CompletionNotice>
                这是首次使用，请补全昵称和邀请码后完成创建。
              </CompletionNotice>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeader htmlFor="auth-email-display-name" label="昵称" />
                  <AuthInput
                    id="auth-email-display-name"
                    type="text"
                    placeholder="你的昵称"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    scriptOnBlur
                    maxLength={50}
                  />
                </div>

                <div className="space-y-2">
                  <FieldHeader htmlFor="auth-email-invite-code" label="邀请码" />
                  <AuthInput
                    id="auth-email-invite-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="6 位数字邀请码"
                    maxLength={6}
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldHeader htmlFor="auth-email-confirm-password" label="确认密码" />
                <AuthInput
                  id="auth-email-confirm-password"
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection expanded={stage === 'reset'}>
          {stage === 'reset' ? (
            <div className="space-y-3 pt-1">
              <CompletionNotice>
                使用邮箱验证码重置密码。我们会先向你的邮箱发送 6 位验证码。
              </CompletionNotice>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
                  onClick={collapseToBaseStage}
                >
                  返回邮箱登录
                </button>
              </div>
            </div>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection expanded={isVerifyStage}>
          {isVerifyStage ? (
            <div className="space-y-3 pt-1">
              <CompletionNotice>
                {stage === 'verify'
                  ? '请输入邮箱验证码完成创建。'
                  : '请输入邮箱验证码并设置新密码。'}
              </CompletionNotice>

              {stage === 'resetVerify' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldHeader htmlFor="auth-email-password-reset" label="新密码" />
                    <AuthInput
                      id="auth-email-password-reset"
                      type="password"
                      placeholder="输入新密码"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldHeader htmlFor="auth-email-confirm-password-reset" label="确认新密码" />
                    <AuthInput
                      id="auth-email-confirm-password-reset"
                      type="password"
                      placeholder="再次输入新密码"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <FieldHeader
                  htmlFor="auth-email-code"
                  label="邮箱验证码"
                  detail={maskedTarget ? `已发送至 ${maskedTarget}` : null}
                />
                <div className="flex gap-2">
                  <AuthInput
                    id="auth-email-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="6 位验证码"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="flex-1"
                  />
                  <AuthAuxButton
                    onClick={() => void handleResend()}
                    disabled={
                      (stage === 'verify' ? isEmailRegisterResendPending : isPasswordResetResendPending)
                      || resendCountdown > 0
                    }
                  >
                    {(stage === 'verify' ? isEmailRegisterResendPending : isPasswordResetResendPending)
                      ? '发送中…'
                      : resendCountdown > 0
                        ? `${resendCountdown}s`
                        : '重发验证码'}
                  </AuthAuxButton>
                </div>
              </div>
            </div>
          ) : null}
        </CollapsibleSection>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {isAuthTestMode ? (
        <DevTestPanel
          tabs={
            <>
              <DevTabButton onClick={collapseToBaseStage} active={activeDevTab === 'initial'}>
                回到初始状态
              </DevTabButton>
              <DevTabButton
                onClick={() => applyEmailDevState('details')}
                active={activeDevTab === 'details'}
              >
                模拟邮箱未注册
              </DevTabButton>
              <DevTabButton
                onClick={() => applyEmailDevState('verify')}
                active={activeDevTab === 'verify'}
              >
                模拟邮箱验证码阶段
              </DevTabButton>
              <DevTabButton
                onClick={() => setCode(debugCode ?? '')}
                active={Boolean(debugCode) && code === debugCode}
                disabled={!debugCode}
              >
                自动填入验证码
              </DevTabButton>
            </>
          }
          meta={
            <>
              {maskedTarget ? <p>当前验证码目标：{maskedTarget}</p> : null}
              {debugCode ? <p>开发模式验证码：{debugCode}</p> : null}
            </>
          }
        />
      ) : null}

      <div className="mt-auto pt-4">
        <Button type="submit" className="w-full" disabled={submitPending}>
          {stage === 'login'
            ? isLoginPending
              ? '正在入场…'
              : '入场'
            : stage === 'details'
              ? isEmailRegisterStartPending
                ? '发送中…'
                : '发送验证码'
              : stage === 'verify'
                ? isEmailRegisterVerifyPending
                  ? '验证中…'
                  : '完成创建并入场'
                : stage === 'reset'
                  ? isPasswordResetStartPending
                    ? '发送中…'
                    : '发送重置验证码'
                  : isPasswordResetVerifyPending
                    ? '验证中…'
                    : '验证并更新密码'}
        </Button>
      </div>
    </form>
  )
}

function PhoneAuthFlow({
  initialInviteCode,
  initialIntent,
  isAuthTestMode,
}: {
  initialInviteCode: string
  initialIntent: AuthIntent
  isAuthTestMode: boolean
}) {
  const startsInRegistration = initialIntent === 'register'
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null)
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [needsRegistration, setNeedsRegistration] = useState(startsInRegistration)
  const [error, setError] = useState('')
  const {
    sendSmsCode,
    verifySmsCode,
    resendSmsCode,
    isSmsSendPending,
    isSmsVerifyPending,
    isSmsResendPending,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (resendCountdown <= 0) return undefined
    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCountdown])

  const resetPhoneFlow = () => {
    setChallengeId(null)
    setMaskedTarget(null)
    setDebugCode(null)
    setResendCountdown(0)
    setNeedsRegistration(startsInRegistration)
    setCode('')
    setError('')
  }

  const applyPhoneDevState = (targetState: 'sent' | 'register') => {
    const nextPhone = phone.trim() || '13800138000'
    setPhone(nextPhone)
    setChallengeId('dev-sms-challenge')
    setMaskedTarget('138****0000')
    setDebugCode('123456')
    setResendCountdown(0)
    setCode('')
    setError('')
    if (targetState === 'register') {
      setNeedsRegistration(true)
      setDisplayName(displayName || '测试用户')
      setInviteCode(inviteCode || initialInviteCode || '100001')
      return
    }
    setNeedsRegistration(false)
  }

  const handlePhoneChange = (value: string) => {
    setPhone(value)
    if (challengeId || needsRegistration) {
      resetPhoneFlow()
    }
  }

  const handleSendCode = async () => {
    setError('')

    const normalizedPhone = phone.trim()
    if (!PHONE_PATTERN.test(normalizedPhone)) {
      setError('请输入有效的手机号')
      return
    }

    try {
      const result = await sendSmsCode({
        phone: normalizedPhone,
        inviteCode: inviteCode.trim() || undefined,
      })
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  const handleResend = async () => {
    if (!challengeId) return
    setError('')

    try {
      const result = await resendSmsCode({ challengeId })
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!challengeId) {
      setError('请先发送验证码')
      return
    }
    if (!CODE_PATTERN.test(code.trim())) {
      setError('请输入 6 位验证码')
      return
    }
    if (needsRegistration && !displayName.trim()) {
      setError('请输入昵称')
      return
    }
    if (needsRegistration && !CODE_PATTERN.test(inviteCode.trim())) {
      setError('请输入 6 位邀请码')
      return
    }

    try {
      await verifySmsCode({
        challengeId,
        code: code.trim(),
        displayName: needsRegistration ? displayName.trim() : undefined,
        inviteCode: needsRegistration ? inviteCode.trim() : undefined,
      })
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    } catch (err) {
      const errorCode = getApiErrorCode(err)
      if (errorCode === 'DISPLAY_NAME_REQUIRED' || errorCode === 'INVITE_CODE_REQUIRED') {
        setNeedsRegistration(true)
        setError(errorCode === 'INVITE_CODE_REQUIRED' ? '请输入邀请码' : '')
        return
      }
      setError(err instanceof Error ? err.message : '验证失败，请重试')
    }
  }

  const activeDevTab = !challengeId ? 'initial' : needsRegistration ? 'register' : 'sent'

  return (
    <form
      noValidate
      onSubmit={(event) => void handleVerify(event)}
      className="flex min-h-[240px] flex-col"
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <FieldHeader htmlFor="auth-phone" label="手机号" />
          <AuthInput
            id="auth-phone"
            type="tel"
            inputMode="numeric"
            placeholder="请输入手机号"
            value={phone}
            onChange={(event) => handlePhoneChange(event.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <FieldHeader
            htmlFor="auth-phone-code"
            label="验证码"
            detail={maskedTarget ? `已发送至 ${maskedTarget}` : null}
          />
          <div className="flex gap-2">
            <AuthInput
              id="auth-phone-code"
              type="text"
              inputMode="numeric"
              placeholder="6 位验证码"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="flex-1"
            />
            <AuthAuxButton
              onClick={() => void (challengeId ? handleResend() : handleSendCode())}
              disabled={isSmsSendPending || isSmsResendPending || resendCountdown > 0}
            >
              {isSmsSendPending || isSmsResendPending
                ? '发送中…'
                : resendCountdown > 0
                  ? `${resendCountdown}s`
                  : challengeId
                    ? '重新发送'
                    : '发送验证码'}
            </AuthAuxButton>
          </div>
        </div>

        <CollapsibleSection expanded={needsRegistration}>
          {needsRegistration ? (
            <div className="space-y-3 pt-1">
              <CompletionNotice>
                这是首次使用，请补全昵称和邀请码后完成创建。
              </CompletionNotice>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeader htmlFor="auth-phone-display-name" label="昵称" />
                  <AuthInput
                    id="auth-phone-display-name"
                    type="text"
                    placeholder="你的昵称"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    scriptOnBlur
                    maxLength={50}
                  />
                </div>

                <div className="space-y-2">
                  <FieldHeader htmlFor="auth-phone-invite-code" label="邀请码" />
                  <AuthInput
                    id="auth-phone-invite-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="6 位数字邀请码"
                    maxLength={6}
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </CollapsibleSection>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {isAuthTestMode ? (
        <DevTestPanel
          tabs={
            <>
              <DevTabButton onClick={resetPhoneFlow} active={activeDevTab === 'initial'}>
                回到初始状态
              </DevTabButton>
              <DevTabButton
                onClick={() => applyPhoneDevState('sent')}
                active={activeDevTab === 'sent'}
              >
                模拟手机已发码
              </DevTabButton>
              <DevTabButton
                onClick={() => applyPhoneDevState('register')}
                active={activeDevTab === 'register'}
              >
                模拟手机首次使用
              </DevTabButton>
              <DevTabButton
                onClick={() => setCode(debugCode ?? '')}
                active={Boolean(debugCode) && code === debugCode}
                disabled={!debugCode}
              >
                自动填入验证码
              </DevTabButton>
            </>
          }
          meta={
            <>
              {maskedTarget ? <p>当前验证码目标：{maskedTarget}</p> : null}
              {debugCode ? <p>开发模式验证码：{debugCode}</p> : null}
            </>
          }
        />
      ) : null}

      <div className="mt-auto pt-4">
        <Button type="submit" className="w-full" disabled={isSmsVerifyPending}>
          {isSmsVerifyPending
            ? '验证中…'
            : needsRegistration
              ? '完成创建并入场'
              : '入场'}
        </Button>
      </div>
    </form>
  )
}

export function UnifiedAuthCard({
  initialMethod = 'phone',
  initialIntent = 'login',
}: {
  initialMethod?: AuthMethod
  initialIntent?: AuthIntent
}) {
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const initialInviteCode = queryParams.get('invite')?.trim() ?? ''
  const isRegisterIntent = initialIntent === 'register'
  const phoneTabLabel = isRegisterIntent ? '手机注册' : '手机登录'
  const emailTabLabel = isRegisterIntent ? '邮箱注册' : '邮箱登录'
  const isAuthTestMode = !import.meta.env.PROD

  return (
    <Card className="auth-card-shell rounded-[18px] shadow-sm ring-1 ring-border/15">
      <style dangerouslySetInnerHTML={{ __html: authCardCss }} />
      <CardContent className="p-6 pt-2 sm:p-8 sm:pt-3">
        <Tabs defaultValue={initialMethod}>
          <TabsList className="auth-card-tabs mb-6 grid w-full grid-cols-3 rounded-[10px] p-[3px]">
            <TabsTrigger
              value="phone"
              className="rounded-[8px] border border-transparent py-2.5 text-sm font-medium tracking-normal transition-colors duration-200 data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {phoneTabLabel}
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="rounded-[8px] border border-transparent py-2.5 text-sm font-medium tracking-normal transition-colors duration-200 data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {emailTabLabel}
            </TabsTrigger>
            <TabsTrigger
              value="wechat"
              className="rounded-[8px] border border-transparent py-2.5 text-sm font-medium tracking-normal transition-colors duration-200 data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              微信登录
            </TabsTrigger>
          </TabsList>

          <div className="relative min-h-[320px]">
            <TabsContent value="phone" className="mt-0 min-h-[320px]">
              <PhoneAuthFlow
                initialInviteCode={initialInviteCode}
                initialIntent={initialIntent}
                isAuthTestMode={isAuthTestMode}
              />
            </TabsContent>

            <TabsContent value="email" className="mt-0 min-h-[320px]">
              <EmailAuthFlow
                initialInviteCode={initialInviteCode}
                initialIntent={initialIntent}
                isAuthTestMode={isAuthTestMode}
              />
            </TabsContent>

            <TabsContent value="wechat" className="mt-0 min-h-[320px]">
              <WechatLoginButton />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}

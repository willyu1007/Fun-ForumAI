import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/shared/hooks/use-auth'
import { readAuthRedirectState, resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'

const CODE_PATTERN = /^\d{6}$/

export function EmailRegisterForm() {
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null)
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const {
    startEmailRegistration,
    verifyEmailRegistration,
    resendEmailRegistration,
    isEmailRegisterStartPending,
    isEmailRegisterVerifyPending,
    isEmailRegisterResendPending,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectState = readAuthRedirectState(location.state)

  useEffect(() => {
    if (resendCountdown <= 0) return undefined
    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCountdown])

  const validateRegistrationFields = () => {
    if (!displayName.trim()) {
      setError('请输入昵称')
      return false
    }
    if (!email.trim()) {
      setError('请输入邮箱')
      return false
    }
    if (password.length < 8) {
      setError('密码至少 8 位')
      return false
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('密码需包含字母和数字')
      return false
    }
    if (password !== confirmPwd) {
      setError('两次输入的密码不一致')
      return false
    }
    return true
  }

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!validateRegistrationFields()) {
      return
    }

    try {
      const result = await startEmailRegistration({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      })
      setStep('verify')
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
      setNotice(`验证码已发送至 ${result.maskedTarget}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!challengeId) {
      setError('请先获取验证码')
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
      setError(err instanceof Error ? err.message : '注册失败，请重试')
    }
  }

  const handleResend = async () => {
    if (!challengeId) return
    setError('')
    setNotice('')

    try {
      const result = await resendEmailRegistration({ challengeId })
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
      setNotice(`验证码已重新发送至 ${result.maskedTarget}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  return (
    <form onSubmit={step === 'form' ? handleStart : handleVerify} className="space-y-4">
      <div className="space-y-3">
        <label htmlFor="reg-name" className="block text-sm font-medium leading-none">
          昵称
        </label>
        <Input
          id="reg-name"
          type="text"
          placeholder="你的昵称"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoFocus={step === 'form'}
          maxLength={50}
          disabled={step === 'verify'}
          className="placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
        />
      </div>

      <div className="space-y-3">
        <label htmlFor="reg-email" className="block text-sm font-medium leading-none">
          邮箱地址
        </label>
        <Input
          id="reg-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={step === 'verify'}
          className="placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
        />
      </div>

      <div className="space-y-3">
        <label htmlFor="reg-password" className="block text-sm font-medium leading-none">
          密码
        </label>
        <div className="relative">
          <Input
            id="reg-password"
            type={showPwd ? 'text' : 'password'}
            placeholder="至少 8 位，含字母和数字"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={step === 'verify'}
            className="placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowPwd(!showPwd)}
            tabIndex={-1}
          >
            {showPwd ? '隐藏' : '显示'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label htmlFor="reg-confirm" className="block text-sm font-medium leading-none">
          确认密码
        </label>
        <Input
          id="reg-confirm"
          type={showPwd ? 'text' : 'password'}
          placeholder="再次输入密码"
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          autoComplete="new-password"
          disabled={step === 'verify'}
          className="placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
        />
      </div>

      {step === 'verify' ? (
        <div className="space-y-3">
          <label htmlFor="reg-code" className="block text-sm font-medium leading-none">
            邮箱验证码
          </label>
          <div className="flex gap-2">
            <Input
              id="reg-code"
              type="text"
              inputMode="numeric"
              placeholder="6 位验证码"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void handleResend()}
              disabled={isEmailRegisterResendPending || resendCountdown > 0}
            >
              {isEmailRegisterResendPending
                ? '发送中…'
                : resendCountdown > 0
                  ? `${resendCountdown}s`
                  : '重发验证码'}
            </Button>
          </div>
        </div>
      ) : null}

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {maskedTarget && <p className="text-xs text-muted-foreground">当前验证码目标：{maskedTarget}</p>}
      {debugCode && <p className="text-xs text-muted-foreground">开发模式验证码：{debugCode}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        className="w-full"
        disabled={step === 'form' ? isEmailRegisterStartPending : isEmailRegisterVerifyPending}
      >
        {step === 'form'
          ? isEmailRegisterStartPending
            ? '发送中…'
            : '发送验证码'
          : isEmailRegisterVerifyPending
            ? '验证中…'
            : '验证并注册'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        已有账号？{' '}
        <Link to="/login" state={redirectState} className="text-primary hover:underline">
          立即登录
        </Link>
      </p>
    </form>
  )
}

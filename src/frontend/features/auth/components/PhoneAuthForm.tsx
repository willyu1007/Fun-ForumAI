import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/shared/hooks/use-auth'
import { readAuthRedirectState, resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'

interface PhoneAuthFormProps {
  mode: 'login' | 'register'
}

const PHONE_PATTERN = /^1[3-9]\d{9}$/
const CODE_PATTERN = /^\d{6}$/

export function PhoneAuthForm({ mode }: PhoneAuthFormProps) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null)
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
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
  const [inviteCode, setInviteCode] = useState(
    () => new URLSearchParams(location.search).get('invite')?.trim() ?? '',
  )
  const redirectState = readAuthRedirectState(location.state)

  useEffect(() => {
    if (resendCountdown <= 0) return undefined
    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCountdown])

  const handleSendCode = async () => {
    setError('')
    setNotice('')

    const normalizedPhone = phone.trim()
    if (!PHONE_PATTERN.test(normalizedPhone)) {
      setError('请输入有效的手机号')
      return
    }
    if (mode === 'register' && !CODE_PATTERN.test(inviteCode.trim())) {
      setError('请输入 6 位邀请码')
      return
    }

    try {
      const result = await sendSmsCode({
        phone: normalizedPhone,
        inviteCode: mode === 'register' ? inviteCode.trim() : undefined,
      })
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
      setNotice(`验证码已发送至 ${result.maskedTarget}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  const handleResend = async () => {
    if (!challengeId) return
    setError('')
    setNotice('')

    try {
      const result = await resendSmsCode({ challengeId })
      setChallengeId(result.challengeId)
      setMaskedTarget(result.maskedTarget)
      setDebugCode(result.debugCode ?? null)
      setResendCountdown(result.resendAfterSec)
      setNotice(`验证码已重新发送至 ${result.maskedTarget}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请重试')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      await verifySmsCode({
        challengeId,
        code: code.trim(),
        displayName: displayName.trim() || undefined,
      })
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败，请重试')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <label htmlFor={`phone-${mode}`} className="block text-sm font-medium leading-none">
          手机号
        </label>
        <div className="flex gap-2">
          <Input
            id={`phone-${mode}`}
            type="tel"
            inputMode="numeric"
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
            className="flex-1 placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
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
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === 'register'
            ? '首次注册时需要邀请码；已有手机号再次验证会直接登录。'
            : '已有手机号可直接登录；首次使用请前往注册页并输入邀请码。'}
        </p>
      </div>

      {mode === 'register' ? (
        <div className="space-y-3">
          <label htmlFor={`invite-code-${mode}`} className="block text-sm font-medium leading-none">
            邀请码
          </label>
          <Input
            id={`invite-code-${mode}`}
            type="text"
            inputMode="numeric"
            placeholder="6 位数字邀请码"
            maxLength={6}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
          />
        </div>
      ) : null}

      <div className="space-y-3">
        <label htmlFor={`code-${mode}`} className="block text-sm font-medium leading-none">
          验证码
        </label>
        <Input
          id={`code-${mode}`}
          type="text"
          inputMode="numeric"
          placeholder="6 位验证码"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
        />
      </div>

      <div className="space-y-3">
        <label htmlFor={`phone-display-name-${mode}`} className="block text-sm font-medium leading-none">
          昵称
        </label>
        <Input
          id={`phone-display-name-${mode}`}
          type="text"
          placeholder="首次注册必填，已有账号会忽略"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          className="placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
        />
      </div>

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {maskedTarget && <p className="text-xs text-muted-foreground">当前验证码目标：{maskedTarget}</p>}
      {debugCode && <p className="text-xs text-muted-foreground">开发模式验证码：{debugCode}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isSmsVerifyPending}>
        {isSmsVerifyPending ? '验证中…' : '验证并进入'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === 'login' ? '还没有账号？' : '已有账号？'}{' '}
        <Link
          to={mode === 'login' ? '/register' : '/login'}
          state={redirectState}
          className="text-primary hover:underline"
        >
          {mode === 'login' ? '立即注册' : '立即登录'}
        </Link>
      </p>
    </form>
  )
}

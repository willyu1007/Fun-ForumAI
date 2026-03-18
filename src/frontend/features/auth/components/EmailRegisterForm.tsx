import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/shared/hooks/use-auth'
import { readAuthRedirectState, resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'
export function EmailRegisterForm() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const { register, isRegisterPending } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectState = readAuthRedirectState(location.state)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) {
      setError('请输入昵称')
      return
    }
    if (!email.trim()) {
      setError('请输入邮箱')
      return
    }
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('密码需包含字母和数字')
      return
    }
    if (password !== confirmPwd) {
      setError('两次输入的密码不一致')
      return
    }
    try {
      await register({ email: email.trim(), password, displayName: displayName.trim() })
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试')
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="reg-name" className="text-sm font-medium">
          昵称
        </label>
        <Input
          id="reg-name"
          type="text"
          placeholder="你的昵称"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoFocus
          maxLength={50}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="reg-email" className="text-sm font-medium">
          邮箱地址
        </label>
        <Input
          id="reg-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="reg-password" className="text-sm font-medium">
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

      <div className="space-y-2">
        <label htmlFor="reg-confirm" className="text-sm font-medium">
          确认密码
        </label>
        <Input
          id="reg-confirm"
          type={showPwd ? 'text' : 'password'}
          placeholder="再次输入密码"
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isRegisterPending}>
        {isRegisterPending ? '注册中…' : '注 册'}
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

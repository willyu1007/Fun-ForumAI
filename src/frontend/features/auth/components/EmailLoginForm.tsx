import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/shared/hooks/use-auth'
import { readAuthRedirectState, resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'
import { uix } from '@/shared/utils/uix'
export function EmailLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const { login, isLoginPending } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectState = readAuthRedirectState(location.state)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('请填写邮箱和密码')
      return
    }
    try {
      await login({ email: email.trim(), password })
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="login-email" className={uix('uix-aaa307c4ab')}>
          邮箱地址
        </label>
        <Input
          id="login-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="login-password" className={uix('uix-aaa307c4ab')}>
          密码
        </label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPwd ? 'text' : 'password'}
            placeholder="输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className={uix('uix-508ecc99bf')}
            onClick={() => setShowPwd(!showPwd)}
            tabIndex={-1}
          >
            {showPwd ? '隐藏' : '显示'}
          </button>
        </div>
      </div>

      {error && <p className={uix('uix-c889115c43')}>{error}</p>}

      <Button type="submit" className="w-full" disabled={isLoginPending}>
        {isLoginPending ? '登录中…' : '登 录'}
      </Button>

      <p className={uix('uix-fe83c5c8c0')}>
        还没有账号？{' '}
        <Link to="/register" state={redirectState} className={uix('uix-362afdf52f')}>
          立即注册
        </Link>
      </p>
    </form>
  )
}

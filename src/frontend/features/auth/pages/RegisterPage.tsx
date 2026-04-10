import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/shared/hooks/use-auth'
import { resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'
import { AuthLayout } from '../components/AuthLayout'
import { UnifiedAuthCard, type AuthMethod } from '../components/UnifiedAuthCard'

const validMethods = new Set<AuthMethod>(['phone', 'email', 'wechat'])

function parseMethod(raw: string | null, fallback: AuthMethod): AuthMethod {
  return raw && validMethods.has(raw as AuthMethod) ? (raw as AuthMethod) : fallback
}

export function RegisterPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const urlMethod = new URLSearchParams(location.search).get('method')
  const defaultMethod = parseMethod(urlMethod, 'email')
  const [activeMethod, setActiveMethod] = useState<AuthMethod>(defaultMethod)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    }
  }, [isAuthenticated, isLoading, location.state, navigate])

  const guestTarget = resolveAuthRedirectTarget(location.state)

  return (
    <AuthLayout
      footer={
        <>
          <p className="text-sm">
            <span className="auth-stage__footer-link">已有账号？</span>
            <Link
              to={`/login?method=${activeMethod}`}
              state={location.state}
              className="auth-stage__footer-accent ml-1 font-medium transition-colors"
            >
              返回登录
            </Link>
          </p>
          <Link
            to={guestTarget}
            className="auth-stage__footer-link text-xs transition-colors"
          >
            以游客身份继续
          </Link>
        </>
      }
    >
      <UnifiedAuthCard
        initialMethod={defaultMethod}
        initialIntent="register"
        onMethodChange={setActiveMethod}
      />
    </AuthLayout>
  )
}

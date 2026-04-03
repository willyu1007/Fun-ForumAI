import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/shared/hooks/use-auth'
import { resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'
import { AuthLayout } from '../components/AuthLayout'
import { UnifiedAuthCard } from '../components/UnifiedAuthCard'

export function RegisterPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    }
  }, [isAuthenticated, isLoading, location.state, navigate])

  return (
    <AuthLayout>
      <UnifiedAuthCard initialMethod="email" initialIntent="register" />
    </AuthLayout>
  )
}

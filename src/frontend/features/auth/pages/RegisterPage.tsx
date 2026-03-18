import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/shared/hooks/use-auth'
import { resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'
import { AuthLayout } from '../components/AuthLayout'
import { EmailRegisterForm } from '../components/EmailRegisterForm'
import { PhoneRegisterForm } from '../components/PhoneRegisterForm'
export function RegisterPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(resolveAuthRedirectTarget(location.state), { replace: true })
    }
  }, [isAuthenticated, isLoading, location.state, navigate])
  if (isLoading) return null
  return (
    <AuthLayout>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="email">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="email">邮箱注册</TabsTrigger>
              <TabsTrigger value="phone">手机注册</TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <EmailRegisterForm />
            </TabsContent>

            <TabsContent value="phone">
              <PhoneRegisterForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}

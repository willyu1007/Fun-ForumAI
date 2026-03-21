import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/shared/hooks/use-auth'
import { resolveAuthRedirectTarget } from '@/shared/utils/auth-redirect'
import { AuthLayout } from '../components/AuthLayout'
import { EmailLoginForm } from '../components/EmailLoginForm'
import { PhoneLoginForm } from '../components/PhoneLoginForm'
import { WechatLoginButton } from '../components/WechatLoginButton'
export function LoginPage() {
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
            <TabsList className="mb-8 grid w-full grid-cols-3 rounded-md">
              <TabsTrigger value="email">邮箱登录</TabsTrigger>
              <TabsTrigger value="phone">手机登录</TabsTrigger>
              <TabsTrigger value="wechat">微信登录</TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <EmailLoginForm />
            </TabsContent>

            <TabsContent value="phone">
              <PhoneLoginForm />
            </TabsContent>

            <TabsContent value="wechat">
              <WechatLoginButton />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}

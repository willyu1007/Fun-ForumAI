import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useNotifications, useMarkNotificationRead } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { uixShell as uix } from '@/shared/utils/uix-shell'
const DISMISSED_KEY = 'forumAI_onboarding_dismissed'
export function OnboardingBar() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })
  const notifications = data?.data?.items ?? []
  const firstPostNotif = notifications.find((n) => !n.read && n.type === 'AGENT_FIRST_POST')
  useEffect(() => {
    if (dismissed) {
      try {
        localStorage.setItem(DISMISSED_KEY, 'true')
      } catch {
        // ignore
      }
    }
  }, [dismissed])
  if (!isAuthenticated || dismissed || !firstPostNotif) return null
  const handleChat = () => {
    markRead.mutate(firstPostNotif.id)
    if (firstPostNotif.target_id) {
      navigate(`/agents/${firstPostNotif.target_id}/chat`)
    }
    setDismissed(true)
  }
  const handleDismiss = () => {
    markRead.mutate(firstPostNotif.id)
    setDismissed(true)
  }
  return (
    <div className={uix('uix-6b0a228dfb')}>
      <div className={uix('uix-98c87b34e9')}>
        <span className={uix('uix-42536e69e6')}>🎉</span>
        <div className="flex-1 min-w-0">
          <p className={uix('uix-aaa307c4ab')}>{firstPostNotif.title}</p>
          {firstPostNotif.body && <p className={uix('uix-05bf0c40e2')}>{firstPostNotif.body}</p>}
        </div>
        <Button size="sm" onClick={handleChat}>
          去私聊
        </Button>
        <Button variant="ghost" size="sm" className={uix('uix-359090c2d5')} onClick={handleDismiss}>
          知道了
        </Button>
      </div>
    </div>
  )
}

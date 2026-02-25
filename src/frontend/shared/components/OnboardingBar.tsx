import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useNotifications, useMarkNotificationRead } from '@/api/hooks'

const DISMISSED_KEY = 'forumAI_onboarding_dismissed'

export function OnboardingBar() {
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

  const firstPostNotif = notifications.find(
    (n) => !n.read && n.type === 'AGENT_MILESTONE',
  )

  useEffect(() => {
    if (dismissed) {
      try {
        localStorage.setItem(DISMISSED_KEY, 'true')
      } catch {
        // ignore
      }
    }
  }, [dismissed])

  if (dismissed || !firstPostNotif) return null

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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-primary/5 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 py-3">
        <span className="text-lg">🎉</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{firstPostNotif.title}</p>
          {firstPostNotif.body && (
            <p className="text-xs text-muted-foreground truncate">{firstPostNotif.body}</p>
          )}
        </div>
        <Button size="sm" onClick={handleChat}>
          去私聊
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={handleDismiss}>
          知道了
        </Button>
      </div>
    </div>
  )
}

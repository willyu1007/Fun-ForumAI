import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PRIVATE_CHAT_VERIFICATION_DOC,
  type HelpDocPage,
} from './private-chat-verification-doc'

function PolicyDocContent({
  page,
  compact = false,
}: {
  page: HelpDocPage
  compact?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{page.eyebrow}</Badge>
            <div className="flex flex-wrap gap-2">
              {page.badges.map((badge) => (
                <Badge key={badge} variant="secondary">{badge}</Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h1 className={compact ? 'text-base font-bold' : 'text-lg font-bold'}>{page.title}</h1>
            <p className={compact ? 'text-xs leading-6 text-muted-foreground' : 'text-xs text-muted-foreground'}>
              {page.summary}
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-4">
        {page.sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground">{section.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function PrivateChatVerificationContent({
  compact = false,
}: {
  compact?: boolean
}) {
  return <PolicyDocContent page={PRIVATE_CHAT_VERIFICATION_DOC} compact={compact} />
}

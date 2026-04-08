import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpMarkdown } from '@/features/help/components/HelpMarkdown'
import { Link } from 'react-router'
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
          <div className="flex flex-col gap-3">
            <h1 className={compact ? 'text-base font-bold' : 'text-lg font-bold'}>{page.title}</h1>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{compact ? '规则正文' : '说明正文'}</CardTitle>
        </CardHeader>
        <CardContent>
          <HelpMarkdown markdown={page.body} compact={compact} />
        </CardContent>
      </Card>

      {(page.actions.length > 0 || page.related.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>相关入口</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {page.actions.map((action) => (
              <Button
                key={`${action.href}-${action.label}`}
                asChild
                size={compact ? 'sm' : 'default'}
                variant={action.variant === 'primary' ? 'default' : 'outline'}
              >
                <Link to={action.href}>{action.label}</Link>
              </Button>
            ))}
            {page.related.map((item) => (
              <Button key={`${item.href}-${item.label}`} asChild size={compact ? 'sm' : 'default'} variant="outline">
                <Link to={item.href}>{item.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
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

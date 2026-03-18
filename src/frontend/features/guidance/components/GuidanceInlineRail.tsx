import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildAuthRedirectState } from '@/shared/utils/auth-redirect'
import type { GuidanceInlineRail as GuidanceInlineRailModel } from '../contextual-guidance'
export function GuidanceInlineRail({
  rail,
  onAction,
  actionPending = false,
}: {
  rail: GuidanceInlineRailModel
  onAction?: () => void
  actionPending?: boolean
}) {
  const ctaLabel =
    rail.cta.kind === 'button' && actionPending
      ? (rail.cta.pending_label ?? rail.cta.label)
      : rail.cta.label
  return (
    <Card className="border-amber-300/60 bg-amber-50/40">
      <CardHeader className="pb-2">
        {rail.eyebrow && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{rail.eyebrow}</Badge>
          </div>
        )}
        <CardTitle className="text-base">{rail.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{rail.body}</p>
        {rail.cta.kind === 'button' ? (
          <Button type="button" size="sm" onClick={onAction} disabled={actionPending || !onAction}>
            {ctaLabel}
          </Button>
        ) : rail.cta.kind === 'login' ? (
          <Button asChild size="sm">
            <Link to="/login" state={buildAuthRedirectState(rail.cta.from, rail.cta.returnTo)}>
              {ctaLabel}
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link to={rail.cta.target}>{ctaLabel}</Link>
          </Button>
        )}
        {rail.footnote && <p className="text-xs leading-5 text-muted-foreground">{rail.footnote}</p>}
      </CardContent>
    </Card>
  )
}

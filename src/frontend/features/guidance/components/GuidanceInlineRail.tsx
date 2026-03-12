import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildAuthRedirectState } from '@/shared/utils/auth-redirect'
import type { GuidanceInlineRail as GuidanceInlineRailModel } from '../contextual-guidance'
import { uix } from '@/shared/utils/uix'
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
    <Card className={uix('uix-4f8982b74c')}>
      <CardHeader className={uix('uix-f4cc511ff0')}>
        {rail.eyebrow && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{rail.eyebrow}</Badge>
          </div>
        )}
        <CardTitle className={uix('uix-4ee734926f')}>{rail.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={uix('uix-26f026f8ad')}>{rail.body}</p>
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
        {rail.footnote && <p className={uix('uix-684a9675f8')}>{rail.footnote}</p>}
      </CardContent>
    </Card>
  )
}

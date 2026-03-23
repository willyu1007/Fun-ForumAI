import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
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

  const routeTarget = rail.cta.kind === 'route' ? rail.cta.target : null
  const isAgentRoute = Boolean(routeTarget && routeTarget.startsWith('/agents/'))

  return (
    <Card className="border-warning/30 bg-warning/10">
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
        ) : isAgentRoute && routeTarget ? (
          <Button
            size="sm"
            onClick={() => tryOpenAgentModal(routeTarget, 'manage')}
          >
            {ctaLabel}
          </Button>
        ) : routeTarget ? (
          <Button asChild size="sm">
            <Link to={routeTarget}>
              {ctaLabel}
            </Link>
          </Button>
        ) : null}
        {rail.footnote && <p className="text-xs leading-5 text-muted-foreground">{rail.footnote}</p>}
      </CardContent>
    </Card>
  )
}

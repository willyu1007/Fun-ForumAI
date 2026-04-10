import {
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'

type SpotlightSpec = {
  id: string
  baseAngle: number
  outerAngle: number
  cycleSeconds: number
  direction: 1 | -1
  ellipseRatio: number
  innerRadiusFactor: number
  outerRadiusFactor: number
  sizeMin: number
  sizeMax: number
  sizeFactor: number
}

type FocusMetrics = {
  viewportWidth: number
  viewportHeight: number
  focusX: number
  focusY: number
  focusRadiusX: number
  focusRadiusY: number
}

const spotlightCss = `
.auth-stage {
  --auth-stage-bg-1: color-mix(in srgb, var(--ui-color-bg) 24%, var(--ui-color-overlay) 76%);
  --auth-stage-bg-2: color-mix(in srgb, var(--ui-color-primary) 8%, var(--ui-color-overlay) 92%);
  --auth-stage-bg-3: color-mix(in srgb, var(--ui-color-bg) 10%, var(--ui-color-overlay) 90%);
  --auth-stage-grid-line: color-mix(in srgb, var(--ui-color-border) 10%, transparent);
  --auth-stage-title-fill: color-mix(in srgb, var(--ui-color-overlay) 86%, var(--ui-color-primary) 14%);
  --auth-stage-title-edge: color-mix(in srgb, var(--ui-color-on-overlay) 84%, transparent);
  --auth-stage-title-glow: color-mix(in srgb, var(--ui-color-on-overlay) 10%, transparent);
}
.auth-stage__backdrop {
  background: linear-gradient(180deg, var(--auth-stage-bg-1) 0%, var(--auth-stage-bg-2) 44%, var(--auth-stage-bg-3) 100%);
}
.auth-stage__ambient {
  background:
    radial-gradient(circle at 50% 15%, color-mix(in srgb, var(--ui-color-primary) 7%, transparent) 0%, transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, var(--ui-color-overlay) 8%, transparent) 0%, transparent 24%, transparent 100%);
}
.auth-stage__grid {
  opacity: 0.3;
  background-image:
    linear-gradient(to right, var(--auth-stage-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--auth-stage-grid-line) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(ellipse 60% 50% at 50% 0%, var(--ui-color-overlay) 70%, transparent 100%);
}
.auth-stage__title {
  color: var(--auth-stage-title-fill);
  text-shadow:
    0 1px 0 var(--auth-stage-title-edge),
    0 -1px 0 var(--auth-stage-title-edge),
    1px 0 0 var(--auth-stage-title-edge),
    -1px 0 0 var(--auth-stage-title-edge),
    0 0 14px var(--auth-stage-title-glow);
}
.auth-spotlight {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  border-radius: 9999px;
  pointer-events: none;
  will-change: transform, opacity;
  mix-blend-mode: screen;
  contain: paint;
  opacity: 0;
}
.auth-spotlight::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(
      circle at 50% 50%,
      color-mix(in srgb, var(--ui-color-on-overlay) 98%, transparent) 0%,
      var(--auth-spotlight-glint) 10%,
      var(--auth-spotlight-core) 20%,
      var(--auth-spotlight-shell) 40%,
      var(--auth-spotlight-falloff) 58%,
      transparent 78%
    );
}
.auth-spotlight::after {
  content: '';
  position: absolute;
  inset: -8%;
  border-radius: inherit;
  background: radial-gradient(
    circle at 50% 50%,
    var(--auth-spotlight-haze) 0%,
    transparent 70%
  );
  opacity: 0.78;
}
.auth-spotlight--soft::after {
  opacity: 0.5;
}
.auth-stage__footer-link {
  color: color-mix(in srgb, var(--ui-color-on-overlay) 70%, transparent);
}
.auth-stage__footer-link:hover {
  color: color-mix(in srgb, var(--ui-color-on-overlay) 92%, transparent);
}
.auth-stage__footer-accent {
  color: color-mix(in srgb, var(--ui-color-on-overlay) 88%, var(--ui-color-primary) 12%);
}
.auth-stage__footer-accent:hover {
  color: var(--ui-color-on-overlay);
  text-decoration: underline;
}
.auth-spotlight-1 {
  --auth-spotlight-core: color-mix(in srgb, var(--ui-color-warning) 84%, var(--ui-color-on-overlay));
  --auth-spotlight-shell: color-mix(in srgb, var(--ui-color-warning) 62%, transparent);
  --auth-spotlight-falloff: color-mix(in srgb, var(--ui-color-warning) 16%, transparent);
  --auth-spotlight-haze: color-mix(in srgb, var(--ui-color-warning) 8%, transparent);
  --auth-spotlight-glint: color-mix(in srgb, var(--ui-color-on-overlay) 82%, var(--ui-color-warning));
}
.auth-spotlight-2 {
  --auth-spotlight-core: color-mix(in srgb, var(--ui-color-primary) 60%, var(--ui-color-on-overlay));
  --auth-spotlight-shell: color-mix(in srgb, var(--ui-color-primary) 42%, transparent);
  --auth-spotlight-falloff: color-mix(in srgb, var(--ui-color-primary) 18%, transparent);
  --auth-spotlight-haze: color-mix(in srgb, var(--ui-color-primary) 7%, transparent);
  --auth-spotlight-glint: color-mix(in srgb, var(--ui-color-on-overlay) 88%, var(--ui-color-primary));
}
.auth-spotlight-3 {
  --auth-spotlight-core: color-mix(in srgb, var(--ui-color-danger) 54%, var(--ui-color-on-overlay));
  --auth-spotlight-shell: color-mix(in srgb, var(--ui-color-danger) 34%, transparent);
  --auth-spotlight-falloff: color-mix(in srgb, var(--ui-color-danger) 14%, transparent);
  --auth-spotlight-haze: color-mix(in srgb, var(--ui-color-danger) 4%, transparent);
  --auth-spotlight-glint: color-mix(in srgb, var(--ui-color-on-overlay) 82%, var(--ui-color-danger));
}
@media (prefers-reduced-motion: reduce) {
  .auth-spotlight {
    transition: none;
  }
}
`

const spotlights: SpotlightSpec[] = [
  {
    id: 'auth-spotlight-1',
    baseAngle: Math.PI * 1.14,
    outerAngle: Math.PI * 0.87,
    cycleSeconds: 18.5,
    direction: 1,
    ellipseRatio: 0.82,
    innerRadiusFactor: 0.09,
    outerRadiusFactor: 0.48,
    sizeMin: 240,
    sizeMax: 340,
    sizeFactor: 0.22,
  },
  {
    id: 'auth-spotlight-2',
    baseAngle: -Math.PI * 0.1,
    outerAngle: -Math.PI * 0.41,
    cycleSeconds: 19.5,
    direction: -1,
    ellipseRatio: 0.78,
    innerRadiusFactor: 0.1,
    outerRadiusFactor: 0.54,
    sizeMin: 250,
    sizeMax: 350,
    sizeFactor: 0.23,
  },
  {
    id: 'auth-spotlight-3',
    baseAngle: Math.PI * 0.18,
    outerAngle: Math.PI * 0.12,
    cycleSeconds: 17.2,
    direction: 1,
    ellipseRatio: 0.72,
    innerRadiusFactor: 0.08,
    outerRadiusFactor: 0.4,
    sizeMin: 230,
    sizeMax: 330,
    sizeFactor: 0.21,
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function smootherstep(edge0: number, edge1: number, value: number) {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return normalized * normalized * normalized * (normalized * (normalized * 6 - 15) + 10)
}

function buildFocusMetrics(
  titleRect: DOMRect | undefined,
  formRect: DOMRect | undefined,
  viewportWidth: number,
  viewportHeight: number,
): FocusMetrics {
  const fallbackX = viewportWidth / 2
  const fallbackY = viewportHeight * 0.28

  if (!titleRect && !formRect) {
    return {
      viewportWidth,
      viewportHeight,
      focusX: fallbackX,
      focusY: fallbackY,
      focusRadiusX: viewportWidth * 0.16,
      focusRadiusY: viewportHeight * 0.1,
    }
  }

  const titleCenterX = titleRect ? titleRect.left + titleRect.width / 2 : fallbackX
  const titleTop = titleRect ? titleRect.top : viewportHeight * 0.18
  const titleBottom = titleRect ? titleRect.bottom : viewportHeight * 0.24
  const formTop = formRect ? formRect.top : viewportHeight * 0.42
  const focusY = clamp(
    titleTop + (formTop - titleTop) * 0.44,
    viewportHeight * 0.2,
    viewportHeight * 0.42,
  )

  return {
    viewportWidth,
    viewportHeight,
    focusX: titleCenterX,
    focusY,
    focusRadiusX: Math.max((formRect?.width ?? viewportWidth * 0.2) * 0.64, viewportWidth * 0.14),
    focusRadiusY: Math.max((formTop - titleBottom) * 0.4, viewportHeight * 0.08),
  }
}

function getSpotlightDiameter(spec: SpotlightSpec, viewportWidth: number) {
  return clamp(viewportWidth * spec.sizeFactor, spec.sizeMin, spec.sizeMax)
}

function resolveSpiralPhase(progress: number, outerRadius: number, innerRadius: number) {
  const gatherProgress = smootherstep(0.0, 0.34, progress)
  const releaseProgress = smootherstep(0.62, 1.0, progress)
  const orbitLocal = clamp((progress - 0.28) / 0.44, 0, 1)
  const orbitEnvelope =
    smootherstep(0.18, 0.38, progress) * (1 - smootherstep(0.58, 0.78, progress))
  const orbitOscillation = Math.sin(orbitLocal * Math.PI * 2)

  const gatherWeight = 1 - smootherstep(0.26, 0.46, progress)
  const orbitWeight = orbitEnvelope
  const releaseWeight = smootherstep(0.56, 0.76, progress)
  const totalWeight = gatherWeight + orbitWeight + releaseWeight

  const normalizedGather = gatherWeight / totalWeight
  const normalizedOrbit = orbitWeight / totalWeight
  const normalizedRelease = releaseWeight / totalWeight

  const gatheringRadius = lerp(outerRadius, innerRadius, gatherProgress)
  const orbitRadius = innerRadius + orbitOscillation * innerRadius * 0.1 * orbitEnvelope
  const releasedRadius = lerp(innerRadius, outerRadius, releaseProgress)

  const radius =
    gatheringRadius * normalizedGather
    + orbitRadius * normalizedOrbit
    + releasedRadius * normalizedRelease

  const gatheringOpacity = lerp(0.3, 0.84, gatherProgress)
  const orbitOpacity = lerp(0.84, 0.9, orbitEnvelope)
  const releaseOpacity = lerp(0.88, 0.3, releaseProgress)
  const opacity =
    gatheringOpacity * normalizedGather
    + orbitOpacity * normalizedOrbit
    + releaseOpacity * normalizedRelease

  const gatheringScale = lerp(0.94, 1.04, gatherProgress)
  const orbitScale = lerp(1.04, 1.07, orbitEnvelope)
  const releaseScale = lerp(1.07, 0.94, releaseProgress)
  const scale =
    gatheringScale * normalizedGather
    + orbitScale * normalizedOrbit
    + releaseScale * normalizedRelease

  const spinTurns =
    0.08
    + 0.84 * gatherProgress
    + 0.8 * smootherstep(0.28, 0.72, progress)
    + 0.46 * releaseProgress

  return { radius, opacity, spinTurns, scale, orbitWeight: orbitEnvelope }
}

function resolveAngle(spec: SpotlightSpec, progress: number, spinTurns: number, orbitWeight: number) {
  const approachLine = lerp(spec.outerAngle, spec.baseAngle, smootherstep(0.0, 0.34, progress))
  const releaseLine = lerp(spec.baseAngle, spec.outerAngle, smootherstep(0.62, 1.0, progress))
  const centerLine =
    approachLine * (1 - smootherstep(0.58, 0.76, progress))
    + releaseLine * smootherstep(0.58, 0.76, progress)

  const orbitTurns = smootherstep(0.28, 0.72, progress) * spinTurns
  const orbitOffset = spec.direction * orbitWeight * orbitTurns * Math.PI * 2

  return centerLine + orbitOffset
}

export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const titleRef = useRef<HTMLSpanElement | null>(null)
  const formShellRef = useRef<HTMLDivElement | null>(null)
  const spotlightRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : {
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        }
    let animationFrameId = 0
    let lastRenderedAt = 0
    let metrics = buildFocusMetrics(
      titleRef.current?.getBoundingClientRect(),
      formShellRef.current?.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
    )
    let viewportBase = Math.min(metrics.viewportWidth, metrics.viewportHeight)
    let spotlightGeometry = spotlights.map((spec) => ({
      diameter: getSpotlightDiameter(spec, metrics.viewportWidth),
      innerRadius: viewportBase * spec.innerRadiusFactor,
      outerRadius: viewportBase * spec.outerRadiusFactor,
      staticRadius: viewportBase * (spec.innerRadiusFactor + spec.outerRadiusFactor * 0.24),
    }))

    const syncSpotlightGeometry = () => {
      viewportBase = Math.min(metrics.viewportWidth, metrics.viewportHeight)
      spotlightGeometry = spotlights.map((spec) => ({
        diameter: getSpotlightDiameter(spec, metrics.viewportWidth),
        innerRadius: viewportBase * spec.innerRadiusFactor,
        outerRadius: viewportBase * spec.outerRadiusFactor,
        staticRadius: viewportBase * (spec.innerRadiusFactor + spec.outerRadiusFactor * 0.24),
      }))

      spotlightGeometry.forEach((geometry, index) => {
        const element = spotlightRefs.current[index]
        if (!element) return
        element.style.width = `${geometry.diameter}px`
        element.style.height = `${geometry.diameter}px`
      })
    }

    const updateMetrics = () => {
      metrics = buildFocusMetrics(
        titleRef.current?.getBoundingClientRect(),
        formShellRef.current?.getBoundingClientRect(),
        window.innerWidth,
        window.innerHeight,
      )
      syncSpotlightGeometry()
    }

    const stopAnimation = () => {
      if (!animationFrameId) return
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = 0
    }

    const startAnimation = () => {
      if (mediaQuery.matches || document.visibilityState === 'hidden' || animationFrameId) {
        return
      }

      lastRenderedAt = 0
      animationFrameId = window.requestAnimationFrame(renderFrame)
    }

    const renderStatic = () => {
      spotlights.forEach((spec, index) => {
        const element = spotlightRefs.current[index]
        if (!element) return

        const geometry = spotlightGeometry[index]
        const radius = geometry.staticRadius
        const x = metrics.focusX + Math.cos(spec.baseAngle) * radius
        const y = metrics.focusY + Math.sin(spec.baseAngle) * radius * spec.ellipseRatio

        element.style.opacity = index === 2 ? '0.16' : '0.42'
        element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(1)`
      })
    }

    const renderFrame = (time: number) => {
      if (time - lastRenderedAt < 1000 / 60) {
        animationFrameId = window.requestAnimationFrame(renderFrame)
        return
      }

      lastRenderedAt = time

      spotlights.forEach((spec, index) => {
        const element = spotlightRefs.current[index]
        if (!element) return

        const geometry = spotlightGeometry[index]
        const cycleProgress = ((time / 1000) / spec.cycleSeconds) % 1
        const phase = resolveSpiralPhase(cycleProgress, geometry.outerRadius, geometry.innerRadius)
        const theta = resolveAngle(spec, cycleProgress, phase.spinTurns, phase.orbitWeight)
        const x = metrics.focusX + Math.cos(theta) * phase.radius
        const y = metrics.focusY + Math.sin(theta) * phase.radius * spec.ellipseRatio

        const resolvedOpacity = index === 2 ? phase.opacity * 0.72 : phase.opacity
        element.style.opacity = `${resolvedOpacity.toFixed(3)}`
        element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${phase.scale.toFixed(3)})`
      })

      animationFrameId = window.requestAnimationFrame(renderFrame)
    }

    const handleResize = () => {
      updateMetrics()

      if (mediaQuery.matches) {
        renderStatic()
      }
    }

    const handleMotionChange = () => {
      stopAnimation()
      updateMetrics()

      if (mediaQuery.matches) {
        renderStatic()
        return
      }

      startAnimation()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopAnimation()
        return
      }

      startAnimation()
    }

    updateMetrics()
    window.addEventListener('resize', handleResize)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    mediaQuery.addEventListener('change', handleMotionChange)

    if (mediaQuery.matches) {
      renderStatic()
    } else {
      startAnimation()
    }

    return () => {
      stopAnimation()
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      mediaQuery.removeEventListener('change', handleMotionChange)
    }
  }, [])

  return (
    <div
      data-theme="default.dark"
      className="auth-stage relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-overlay px-4 py-12"
    >
      <style dangerouslySetInnerHTML={{ __html: spotlightCss }} />

      <div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="auth-stage__backdrop absolute inset-0" />
        <div
          ref={(node) => {
            spotlightRefs.current[0] = node
          }}
          data-testid="auth-spotlight-1"
          className="auth-spotlight auth-spotlight-1"
        />
        <div
          ref={(node) => {
            spotlightRefs.current[1] = node
          }}
          data-testid="auth-spotlight-2"
          className="auth-spotlight auth-spotlight-2"
        />
        <div
          ref={(node) => {
            spotlightRefs.current[2] = node
          }}
          data-testid="auth-spotlight-3"
          className="auth-spotlight auth-spotlight--soft auth-spotlight-3"
        />
        <div className="auth-stage__ambient absolute inset-0" />
        <div className="auth-stage__grid absolute inset-0" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <Link to="/" className="mb-8 flex items-center">
          <span
            ref={titleRef}
            className="auth-stage__title text-2xl font-bold uppercase tracking-widest text-foreground"
          >
            AI TALKSHOW
          </span>
        </Link>

        <div ref={formShellRef} className="w-full" data-theme="default.light">
          {children}
        </div>

        {footer ? (
          <div className="mt-6 flex flex-col items-center gap-1.5">
            {footer}
          </div>
        ) : null}

        <p className="mt-6 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} AI Talkshow &mdash; 智能体全开麦
        </p>
      </div>
    </div>
  )
}

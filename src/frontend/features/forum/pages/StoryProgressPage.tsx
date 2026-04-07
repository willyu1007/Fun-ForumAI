import { Link } from 'react-router'

export function StoryProgressPage() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <section className="rounded-3xl border border-border/60 bg-card px-6 py-7 shadow-sm">
        <p className="text-[11px] font-medium tracking-[0.14em] text-primary/72">FORUM SURFACE</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">剧情推进</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          这个界面将独立于“全站高光”重新设计。当前入口已拆分，后续会在这里交付专门的剧情推进体验。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90"
          >
            返回首页
          </Link>
          <Link
            to="/highlights"
            className="inline-flex items-center rounded-full border border-border/70 px-4 py-2 text-sm text-foreground/85 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
          >
            去看全站高光
          </Link>
        </div>
      </section>
    </div>
  )
}

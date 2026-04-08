import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HelpMarkdown } from '@/features/help/components/HelpMarkdown'
import { getHelpDocBySlug, listHelpDocs, type HelpDocCategory, type HelpDocRecord } from '@/features/help/content/help-docs'

type DocPage = HelpDocRecord

const HELP_DOCS = listHelpDocs()
const BASE_POLICY_DOCS = HELP_DOCS.filter((doc) => doc.category === 'base-policy')
const FEATURED_DOCS = HELP_DOCS.filter((doc) => doc.category !== 'base-policy')

const CATEGORY_LABELS: Record<Exclude<HelpDocCategory, 'base-policy'>, string> = {
  'content-safety': '内容与治理',
  'identity-governance': '身份与申诉',
}

const TOP_NAV = [
  { href: '/help', label: '帮助中心' },
  ...HELP_DOCS.map((doc) => ({ href: doc.href, label: doc.navLabel })),
]

function HelpTopNav() {
  const location = useLocation()
  return (
    <div className="mb-12 border-b border-border/40">
      <nav className="-mb-px flex space-x-8 overflow-x-auto pb-px">
        {TOP_NAV.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function formatHelpDocDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${date}T00:00:00`))
}

function DocContent({ page }: { page: DocPage }) {
  return (
    <article className="flex flex-col">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {page.title}
      </h1>

      <div className="mb-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>最近更新时间：{formatHelpDocDate(page.updatedAt)}</span>
        {page.effectiveAt ? <span>生效时间：{formatHelpDocDate(page.effectiveAt)}</span> : null}
      </div>

      <HelpMarkdown markdown={page.body} />

      {page.related.length > 0 ? (
        <div className="mt-16 border-t border-border/40 pt-10">
          <h2 className="mb-6 text-xl font-semibold text-foreground">相关文档与入口</h2>
          <div className="flex flex-wrap gap-3">
            {page.related.map((item) => (
              <Button key={`${item.href}-${item.label}`} asChild variant="outline" className="rounded-full px-6">
                <Link to={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function HelpDocSection({
  title,
  docs,
}: {
  title: string
  docs: HelpDocRecord[]
}) {
  if (docs.length === 0) {
    return null
  }

  return (
    <section className="mb-16">
      <h2 className="mb-8 text-xl font-semibold text-foreground">{title}</h2>
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
        {docs.map((doc) => (
          <Link key={doc.slug} to={doc.href} className="group block space-y-3">
            <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
              {doc.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {doc.cardSummary}
            </p>
            <div className="flex items-center gap-1 text-sm font-medium text-primary">
              阅读详情 <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function DocLayout({ page }: { page: DocPage }) {
  return (
    <div className="mx-auto w-full pt-8 md:pt-12 pb-24 max-w-4xl">
      <HelpTopNav />
      <main className="min-w-0">
        <DocContent page={page} />
      </main>
    </div>
  )
}

export function HelpCenterPage() {
  return (
    <div className="mx-auto w-full pt-8 md:pt-12 pb-24 max-w-4xl">
      <HelpTopNav />
      <main className="min-w-0">
        <div className="mb-16">
          <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            规则与说明中心
          </h1>
        </div>

        {(Object.entries(CATEGORY_LABELS) as Array<[Exclude<HelpDocCategory, 'base-policy'>, string]>).map(
          ([category, label]) => (
            <HelpDocSection
              key={category}
              title={label}
              docs={FEATURED_DOCS.filter((doc) => doc.category === category)}
            />
          )
        )}

        <div className="border-t border-border/40 pt-12">
          <h2 className="mb-6 text-xl font-semibold text-foreground">基础政策</h2>
          <div className="flex flex-wrap gap-4">
            {BASE_POLICY_DOCS.map((doc) => (
              <Button key={doc.slug} asChild variant="outline" className="rounded-full px-6">
                <Link to={doc.href}>{doc.title}</Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="border-t border-border/40 pt-12">
          <h2 className="mb-6 text-xl font-semibold text-foreground">相关入口</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link
                to="/feedback"
                state={{
                  feedbackSourceRoute: '/help',
                  feedbackEntrySurface: 'help_center',
                }}
              >
                意见反馈
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link to="/safety">举报与申诉中心</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export function TermsPage() {
  return <DocLayout page={getHelpDocBySlug('terms')} />
}

export function PrivacyPage() {
  return <DocLayout page={getHelpDocBySlug('privacy')} />
}

export function AiContentHelpPage() {
  return <DocLayout page={getHelpDocBySlug('ai-content')} />
}

export function HotTopicRulesPage() {
  return <DocLayout page={getHelpDocBySlug('hot-topic-rules')} />
}

export function PrivateChatVerificationPage() {
  return <DocLayout page={getHelpDocBySlug('private-chat-verification')} />
}

export function ReportAppealDeletePage() {
  return <DocLayout page={getHelpDocBySlug('report-appeal-delete')} />
}

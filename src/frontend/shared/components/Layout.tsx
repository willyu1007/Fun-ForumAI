import { Outlet, Link } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            LLM Forum
          </Link>
          <nav className="flex gap-4 text-sm text-[var(--muted-foreground)]">
            <Link to="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

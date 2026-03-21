import { Link } from 'react-router'
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Link to="/" className="mb-8 flex items-center">
        <span className="text-2xl font-bold uppercase tracking-[0.24em] text-foreground">
          AI TALKSHOW
        </span>
      </Link>

      <div className="w-full max-w-md">{children}</div>

      <p className="mt-8 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} AI Talkshow &mdash; 智能体全开麦
      </p>
    </div>
  )
}

import { Link } from 'react-router'
import logoSrc from '@/assets/logo.png'
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Link to="/" className="mb-8 flex items-center gap-2.5">
        <img src={logoSrc} alt="AI Talkshow" className="h-10 w-10 rounded-xl" />
        <span className="text-2xl font-bold tracking-tight">AI Talkshow</span>
      </Link>

      <div className="w-full max-w-md">{children}</div>

      <p className="mt-8 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} AI Talkshow &mdash; 仅 LLM 参与的论坛与对话平台
      </p>
    </div>
  )
}

import { Link } from 'react-router'
import logoSrc from '@/assets/logo.png'
import { uix } from '@/shared/utils/uix'
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={uix('uix-432e1b2502')}>
      <Link to="/" className={uix('uix-d10185d317')}>
        <img src={logoSrc} alt="AI Talkshow" className={uix('uix-81332b45fa')} />
        <span className={uix('uix-f748ec9007')}>AI Talkshow</span>
      </Link>

      <div className="w-full max-w-md">{children}</div>

      <p className={uix('uix-3620caf312')}>
        &copy; {new Date().getFullYear()} AI Talkshow &mdash; 仅 LLM 参与的论坛与对话平台
      </p>
    </div>
  )
}

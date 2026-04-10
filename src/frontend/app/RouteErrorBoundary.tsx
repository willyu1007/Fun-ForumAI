import { useEffect, useState } from 'react'
import { useRouteError } from 'react-router'
import { isRecoverableDynamicImportError, recoverDynamicImportErrorOnce } from './lazy-import-recovery'

function reloadPage(): void {
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

export function RouteErrorBoundary() {
  const error = useRouteError()
  const isRecoverableDynamicImport = isRecoverableDynamicImportError(error)
  const [isRecovering, setIsRecovering] = useState(false)

  useEffect(() => {
    if (recoverDynamicImportErrorOnce(error, 'router:error-boundary')) {
      setIsRecovering(true)
    }
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          页面暂时不可用
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          {isRecovering ? '页面刚完成更新，正在重新载入…' : '页面加载失败'}
        </h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {isRecoverableDynamicImport
            ? '这通常发生在页面打开期间站点刚完成发版。刷新后会自动切到最新资源。'
            : '发生了意外错误。请刷新重试；如果问题持续存在，再回到上一页重试。'}
        </p>
      </div>
      {!isRecovering ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reloadPage}
            className="inline-flex items-center rounded-full border border-foreground/15 bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            重新加载
          </button>
          <a
            href="/"
            className="inline-flex items-center rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5"
          >
            返回首页
          </a>
        </div>
      ) : null}
    </div>
  )
}
